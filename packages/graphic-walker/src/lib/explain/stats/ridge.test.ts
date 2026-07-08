import {
    solveLinearSystem,
    fitRidge,
    predictRidge,
    looCvR2,
    selectLambda,
    standardize,
    mulberry32,
    shuffled,
    permutationPValue,
} from './ridge';

describe('solveLinearSystem', () => {
    it('solves a known 3x3 system', () => {
        // x=1, y=2, z=3
        const A = [
            [2, 1, -1],
            [-3, -1, 2],
            [-2, 1, 2],
        ];
        const b = [1, 1, 6];
        const x = solveLinearSystem(A, b);
        expect(x[0]).toBeCloseTo(1, 8);
        expect(x[1]).toBeCloseTo(2, 8);
        expect(x[2]).toBeCloseTo(3, 8);
    });
    it('throws on singular matrices', () => {
        expect(() =>
            solveLinearSystem(
                [
                    [1, 2],
                    [2, 4],
                ],
                [1, 2]
            )
        ).toThrow('singular');
    });
});

describe('fitRidge', () => {
    it('recovers exact linear coefficients at λ≈0 (OLS agreement)', () => {
        // y = 3 + 2·x1 − 1·x2, no noise
        const X = [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
            [2, 1],
            [1, 2],
            [3, 2],
        ];
        const y = X.map(([a, b]) => 3 + 2 * a - b);
        const model = fitRidge(X, y, 1e-9);
        expect(model.beta[0]).toBeCloseTo(2, 6);
        expect(model.beta[1]).toBeCloseTo(-1, 6);
        expect(model.intercept).toBeCloseTo(3, 6);
        const preds = predictRidge(model, X);
        preds.forEach((p, i) => expect(p).toBeCloseTo(y[i], 6));
    });
    it('shrinks coefficients as λ grows', () => {
        const X = Array.from({ length: 20 }, (_, i) => [i, (i * 7) % 5]);
        const y = X.map(([a, b]) => 1 + 0.5 * a + 2 * b);
        const small = fitRidge(X, y, 0.01);
        const large = fitRidge(X, y, 1000);
        const norm = (m: { beta: number[] }) => Math.hypot(...m.beta);
        expect(norm(large)).toBeLessThan(norm(small));
    });
    it('handles the intercept-only case (no features)', () => {
        const model = fitRidge([[], [], []] as number[][], [1, 2, 3], 1);
        expect(model.beta).toEqual([]);
        expect(model.intercept).toBeCloseTo(2, 10);
    });
});

describe('looCvR2', () => {
    it('is high for genuinely predictive features', () => {
        const rand = mulberry32(42);
        const X = Array.from({ length: 30 }, () => [rand() * 10]);
        const y = X.map(([x]) => 2 * x + 1 + (rand() - 0.5) * 0.1);
        expect(looCvR2(X, y, 0.1)).toBeGreaterThan(0.95);
    });
    it('is ≤ 0 for pure-noise features (the overfitting detector)', () => {
        const rand = mulberry32(7);
        const X = Array.from({ length: 25 }, () => [rand(), rand(), rand()]);
        const y = Array.from({ length: 25 }, () => rand() * 100);
        expect(looCvR2(X, y, 0.1)).toBeLessThanOrEqual(0.1);
    });
});

describe('selectLambda', () => {
    it('is deterministic and returns a grid member', () => {
        const rand = mulberry32(1);
        const X = Array.from({ length: 20 }, () => [rand() * 5, rand() * 3]);
        const y = X.map(([a, b]) => a - b + (rand() - 0.5) * 0.2);
        const first = selectLambda(X, y);
        const second = selectLambda(X, y);
        expect(first).toEqual(second);
        expect([0.01, 0.1, 1, 10]).toContain(first.lambda);
    });
});

describe('standardize', () => {
    it('produces zero mean and unit variance', () => {
        const z = standardize([2, 4, 6, 8]);
        expect(z.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);
        const varz = z.reduce((acc, v) => acc + v * v, 0) / z.length;
        expect(varz).toBeCloseTo(1, 10);
    });
    it('maps constant columns to zeros instead of dividing by zero', () => {
        expect(standardize([5, 5, 5])).toEqual([0, 0, 0]);
    });
});

describe('determinism and permutation testing', () => {
    it('mulberry32 yields a reproducible sequence in [0,1)', () => {
        const a = mulberry32(123);
        const b = mulberry32(123);
        const seqA = Array.from({ length: 5 }, a);
        const seqB = Array.from({ length: 5 }, b);
        expect(seqA).toEqual(seqB);
        seqA.forEach((v) => {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        });
    });
    it('shuffled is deterministic under a fixed seed and preserves elements', () => {
        const items = [1, 2, 3, 4, 5, 6];
        const s1 = shuffled(items, mulberry32(9));
        const s2 = shuffled(items, mulberry32(9));
        expect(s1).toEqual(s2);
        expect([...s1].sort()).toEqual(items);
    });
    it('permutationPValue implements add-one smoothing', () => {
        expect(permutationPValue(10, [1, 2, 3, 4])).toBeCloseTo(1 / 5, 10);
        expect(permutationPValue(0, [1, 2, 3, 4])).toBeCloseTo(5 / 5, 10);
        expect(permutationPValue(2.5, [1, 2, 3, 4])).toBeCloseTo(3 / 5, 10);
    });
});
