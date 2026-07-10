/**
 * Ridge regression kernel for the model-based explainers (B/C class).
 *
 * Operates on mark-level aggregates (tens to hundreds of rows, ≤ ~20
 * features), so closed-form solutions and brute-force leave-one-out are
 * cheap. No external dependencies.
 *
 * FROZEN for the executor agent: do not modify scoring logic here.
 * See docs/explain-data-worklog.md §1.
 */

export interface IRidgeModel {
    beta: number[];
    intercept: number;
}

/** Gaussian elimination with partial pivoting; A is modified-safe (copied). */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;
    const m = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++) {
            if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
        }
        if (Math.abs(m[pivot][col]) < 1e-12) {
            throw new Error('solveLinearSystem: singular matrix');
        }
        [m[col], m[pivot]] = [m[pivot], m[col]];
        for (let r = col + 1; r < n; r++) {
            const factor = m[r][col] / m[col][col];
            for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
        }
    }
    const x = new Array<number>(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
        let acc = m[r][n];
        for (let c = r + 1; c < n; c++) acc -= m[r][c] * x[c];
        x[r] = acc / m[r][r];
    }
    return x;
}

/**
 * Closed-form ridge fit with centered features and target (the intercept is
 * not penalized). λ = 0 reduces to OLS.
 */
export function fitRidge(X: number[][], y: number[], lambda: number): IRidgeModel {
    const n = X.length;
    if (n === 0 || n !== y.length) throw new Error('fitRidge: bad shapes');
    const p = X[0]?.length ?? 0;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    if (p === 0) {
        return { beta: [], intercept: yMean };
    }
    const colMeans = Array.from({ length: p }, (_, j) => X.reduce((acc, row) => acc + row[j], 0) / n);
    const Xc = X.map((row) => row.map((v, j) => v - colMeans[j]));
    const yc = y.map((v) => v - yMean);
    // gram = Xc'Xc + λI ; rhs = Xc'yc
    const gram = Array.from({ length: p }, (_, i) =>
        Array.from({ length: p }, (_, j) => {
            let acc = 0;
            for (let r = 0; r < n; r++) acc += Xc[r][i] * Xc[r][j];
            return i === j ? acc + lambda : acc;
        })
    );
    const rhs = Array.from({ length: p }, (_, j) => {
        let acc = 0;
        for (let r = 0; r < n; r++) acc += Xc[r][j] * yc[r];
        return acc;
    });
    const beta = solveLinearSystem(gram, rhs);
    const intercept = yMean - beta.reduce((acc, b, j) => acc + b * colMeans[j], 0);
    return { beta, intercept };
}

export function predictRidge(model: IRidgeModel, X: number[][]): number[] {
    return X.map((row) => model.intercept + model.beta.reduce((acc, b, j) => acc + b * row[j], 0));
}

/**
 * Leave-one-out cross-validated R². Negative values mean the model predicts
 * held-out marks worse than the mean — an honest overfitting signal that a
 * training-set R² would hide (per-mark dummies fit perfectly in-sample).
 */
export function looCvR2(X: number[][], y: number[], lambda: number): number {
    const n = y.length;
    if (n < 3) return Number.NEGATIVE_INFINITY;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    let sse = 0;
    let sst = 0;
    for (let i = 0; i < n; i++) {
        const Xtrain = X.filter((_, r) => r !== i);
        const ytrain = y.filter((_, r) => r !== i);
        let pred: number;
        try {
            const model = fitRidge(Xtrain, ytrain, lambda);
            pred = predictRidge(model, [X[i]])[0];
        } catch {
            pred = ytrain.reduce((a, b) => a + b, 0) / ytrain.length;
        }
        sse += (y[i] - pred) ** 2;
        sst += (y[i] - yMean) ** 2;
    }
    if (sst < 1e-12) return 0;
    return 1 - sse / sst;
}

export const DEFAULT_LAMBDA_GRID = [0.01, 0.1, 1, 10];

/** pick λ maximizing LOO-CV R² over a fixed grid — deterministic */
export function selectLambda(X: number[][], y: number[], grid: number[] = DEFAULT_LAMBDA_GRID): { lambda: number; cvR2: number } {
    let best = { lambda: grid[0], cvR2: Number.NEGATIVE_INFINITY };
    for (const lambda of grid) {
        const cvR2 = looCvR2(X, y, lambda);
        if (cvR2 > best.cvR2) best = { lambda, cvR2 };
    }
    return best;
}

/** standardize a column to zero mean / unit variance; constant columns → all zeros */
export function standardize(values: number[]): number[] {
    const n = values.length;
    if (n === 0) return [];
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n);
    if (sd < 1e-12) return values.map(() => 0);
    return values.map((v) => (v - mean) / sd);
}

/**
 * Deterministic PRNG (mulberry32). `Math.random` is forbidden in the explain
 * module: the same view state must always produce the same explanations.
 */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Fisher–Yates shuffle with an injected PRNG */
export function shuffled<T>(items: T[], rand: () => number): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * One-sided permutation p-value with add-one smoothing:
 * P(score ≥ real | null). Guards the "lucky prediction" failure mode.
 */
export function permutationPValue(realScore: number, permutedScores: number[]): number {
    const asExtreme = permutedScores.filter((s) => s >= realScore).length;
    return (1 + asExtreme) / (1 + permutedScores.length);
}
