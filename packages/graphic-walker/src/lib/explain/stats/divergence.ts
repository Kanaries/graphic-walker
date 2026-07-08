/**
 * Statistical kernel for the Explain Data module.
 *
 * FROZEN for the executor agent: do not modify scoring logic here.
 * See docs/explain-data-worklog.md §1.
 */

/**
 * Laplace-smooth a non-negative mass vector into a probability vector.
 * alpha adds pseudo-mass to every category so small samples do not
 * produce spuriously extreme distributions.
 */
export function laplaceSmooth(mass: number[], alpha = 0.5): number[] {
    const total = mass.reduce((acc, v) => acc + v, 0) + alpha * mass.length;
    if (total <= 0) {
        return mass.map(() => 1 / Math.max(mass.length, 1));
    }
    return mass.map((v) => (v + alpha) / total);
}

/**
 * Jensen–Shannon divergence (base 2) between two aligned probability vectors.
 * Zero-probability categories contribute by definition (0·log0 = 0; the
 * non-zero side contributes 0.5·p). Bounded in [0, 1].
 */
export function jsDivergence(p: number[], q: number[]): number {
    if (p.length !== q.length) {
        throw new Error(`jsDivergence: length mismatch (${p.length} vs ${q.length})`);
    }
    let score = 0;
    for (let i = 0; i < p.length; i++) {
        const pi = p[i];
        const qi = q[i];
        if (pi === 0 && qi === 0) continue;
        const m = 0.5 * (pi + qi);
        if (pi > 0) score += 0.5 * pi * Math.log2(pi / m);
        if (qi > 0) score += 0.5 * qi * Math.log2(qi / m);
    }
    // clamp numeric noise
    return Math.min(1, Math.max(0, score));
}

/**
 * Jensen–Shannon distance: sqrt of the divergence. A proper metric,
 * bounded in [0, 1] and comparable across candidate dimensions of
 * different cardinalities.
 */
export function jsDistance(p: number[], q: number[]): number {
    return Math.sqrt(jsDivergence(p, q));
}

/**
 * Element-wise `total − part`, clamped at 0 (guards float noise).
 * Used to derive the siblings distribution from the all-marks totals
 * without an extra query; valid for additive masses (counts, sums).
 */
export function subtractMass(total: number[], part: number[]): number[] {
    if (total.length !== part.length) {
        throw new Error(`subtractMass: length mismatch (${total.length} vs ${part.length})`);
    }
    return total.map((t, i) => Math.max(0, t - part[i]));
}

const LANCZOS_G = 7;
const LANCZOS_COEFFS = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** log Γ(x) via Lanczos approximation, x > 0. */
export function logGamma(x: number): number {
    if (x < 0.5) {
        // reflection formula
        return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    }
    const z = x - 1;
    let acc = LANCZOS_COEFFS[0];
    for (let i = 1; i < LANCZOS_G + 2; i++) {
        acc += LANCZOS_COEFFS[i] / (z + i);
    }
    const t = z + LANCZOS_G + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(acc);
}

const MAX_ITER = 300;
const EPS = 1e-12;

/** Regularized lower incomplete gamma P(a, x) by series expansion (x < a + 1). */
function lowerGammaSeries(a: number, x: number): number {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < MAX_ITER; n++) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < Math.abs(sum) * EPS) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Regularized upper incomplete gamma Q(a, x) by continued fraction (x ≥ a + 1). */
function upperGammaCF(a: number, x: number): number {
    let b = x + 1 - a;
    let c = 1 / 1e-300;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < MAX_ITER; i++) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < 1e-300) d = 1e-300;
        c = b + an / c;
        if (Math.abs(c) < 1e-300) c = 1e-300;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPS) break;
    }
    return h * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/**
 * Upper-tail probability of the chi-square distribution:
 * P(X ≥ x) for X ~ χ²(df).
 */
export function chiSquareUpperTail(x: number, df: number): number {
    if (x <= 0) return 1;
    if (df <= 0) throw new Error('chiSquareUpperTail: df must be positive');
    const a = df / 2;
    const half = x / 2;
    if (half < a + 1) {
        return Math.min(1, Math.max(0, 1 - lowerGammaSeries(a, half)));
    }
    return Math.min(1, Math.max(0, upperGammaCF(a, half)));
}

/**
 * G-test of goodness of fit: are the observed category counts consistent
 * with the expected probabilities?
 *
 * @param observed raw counts for the selected mark, aligned with expectedProbs
 * @param expectedProbs probability vector (e.g. smoothed sibling shares)
 * @returns p-value; small p ⇒ the mark's composition differs significantly
 */
export function gTestPValue(observed: number[], expectedProbs: number[]): number {
    if (observed.length !== expectedProbs.length) {
        throw new Error(`gTestPValue: length mismatch (${observed.length} vs ${expectedProbs.length})`);
    }
    const n = observed.reduce((acc, v) => acc + v, 0);
    if (n <= 0 || observed.length < 2) return 1;
    let g = 0;
    for (let i = 0; i < observed.length; i++) {
        const obs = observed[i];
        if (obs <= 0) continue;
        const expected = expectedProbs[i] * n;
        if (expected <= 0) {
            // observed mass where the reference assigns none: infinitely surprising
            // under the model; cap via a tiny expected mass instead of Infinity.
            g += 2 * obs * Math.log(obs / (EPS * n));
            continue;
        }
        g += 2 * obs * Math.log(obs / expected);
    }
    const df = observed.length - 1;
    return chiSquareUpperTail(Math.max(0, g), df);
}
