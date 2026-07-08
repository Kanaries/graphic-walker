import { laplaceSmooth, jsDivergence, jsDistance, subtractMass, chiSquareUpperTail, gTestPValue, logGamma } from './divergence';

describe('laplaceSmooth', () => {
    it('normalizes to a probability vector', () => {
        const p = laplaceSmooth([10, 20, 30]);
        expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });
    it('gives zero-mass categories non-zero probability', () => {
        const p = laplaceSmooth([0, 100]);
        expect(p[0]).toBeGreaterThan(0);
        expect(p[0]).toBeLessThan(p[1]);
    });
    it('handles an all-zero vector as uniform', () => {
        const p = laplaceSmooth([0, 0, 0, 0], 0);
        expect(p).toEqual([0.25, 0.25, 0.25, 0.25]);
    });
});

describe('jsDivergence / jsDistance', () => {
    it('is 0 for identical distributions', () => {
        expect(jsDivergence([0.2, 0.3, 0.5], [0.2, 0.3, 0.5])).toBeCloseTo(0, 10);
    });
    it('is 1 for disjoint distributions (bounded above)', () => {
        expect(jsDivergence([1, 0], [0, 1])).toBeCloseTo(1, 10);
    });
    it('counts single-sided zero categories by definition (the old implementation skipped them)', () => {
        // mark concentrated in a category siblings never hit: strong signal
        const withZeros = jsDivergence([0.9, 0.1, 0], [0, 0.1, 0.9]);
        expect(withZeros).toBeGreaterThan(0.8);
    });
    it('is symmetric', () => {
        const p = [0.7, 0.2, 0.1];
        const q = [0.1, 0.3, 0.6];
        expect(jsDivergence(p, q)).toBeCloseTo(jsDivergence(q, p), 12);
    });
    it('is bounded in [0, 1] for arbitrary inputs', () => {
        for (let trial = 0; trial < 50; trial++) {
            // deterministic pseudo-random via simple LCG
            let seed = trial * 2654435761 + 1;
            const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 2 ** 32);
            const raw1 = Array.from({ length: 6 }, next);
            const raw2 = Array.from({ length: 6 }, next);
            const p = laplaceSmooth(raw1, 0);
            const q = laplaceSmooth(raw2, 0);
            const d = jsDivergence(p, q);
            expect(d).toBeGreaterThanOrEqual(0);
            expect(d).toBeLessThanOrEqual(1);
        }
    });
    it('a concentrated distribution scores HIGHER than a mildly different one (regression for the coverage-weight bug)', () => {
        const siblings = laplaceSmooth([25, 25, 25, 25], 0);
        const concentrated = laplaceSmooth([100, 0, 0, 0], 0);
        const mild = laplaceSmooth([30, 26, 24, 20], 0);
        expect(jsDistance(concentrated, siblings)).toBeGreaterThan(jsDistance(mild, siblings));
    });
});

describe('subtractMass', () => {
    it('derives siblings from totals', () => {
        expect(subtractMass([10, 20, 30], [1, 20, 5])).toEqual([9, 0, 25]);
    });
    it('clamps float noise at zero', () => {
        expect(subtractMass([1], [1.0000001])[0]).toBe(0);
    });
});

describe('logGamma', () => {
    it('matches known factorials', () => {
        expect(Math.exp(logGamma(5))).toBeCloseTo(24, 6); // Γ(5) = 4!
        expect(Math.exp(logGamma(1))).toBeCloseTo(1, 10);
        expect(Math.exp(logGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 8);
    });
});

describe('chiSquareUpperTail', () => {
    it('matches standard critical values', () => {
        // classic table values
        expect(chiSquareUpperTail(3.841, 1)).toBeCloseTo(0.05, 3);
        expect(chiSquareUpperTail(5.991, 2)).toBeCloseTo(0.05, 3);
        expect(chiSquareUpperTail(16.919, 9)).toBeCloseTo(0.05, 3);
        expect(chiSquareUpperTail(6.635, 1)).toBeCloseTo(0.01, 3);
    });
    it('is 1 at x = 0 and decreasing in x', () => {
        expect(chiSquareUpperTail(0, 3)).toBe(1);
        expect(chiSquareUpperTail(1, 3)).toBeGreaterThan(chiSquareUpperTail(5, 3));
    });
});

describe('gTestPValue', () => {
    it('is non-significant when the mark matches the reference composition', () => {
        const p = gTestPValue([25, 25, 25, 25], [0.25, 0.25, 0.25, 0.25]);
        expect(p).toBeGreaterThan(0.9);
    });
    it('is highly significant for a strongly skewed mark with adequate sample size', () => {
        const p = gTestPValue([90, 5, 5, 0], [0.25, 0.25, 0.25, 0.25]);
        expect(p).toBeLessThan(1e-6);
    });
    it('does not flag tiny samples (guards the "2-row mark" failure mode)', () => {
        // 3 observations can look extreme but must not reach p < 0.01
        const p = gTestPValue([3, 0, 0, 0], [0.25, 0.25, 0.25, 0.25]);
        expect(p).toBeGreaterThan(0.01);
    });
});
