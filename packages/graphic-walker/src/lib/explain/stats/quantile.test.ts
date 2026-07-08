import { quantileSorted, detectIqrOutliers, computeAggregate, outlierImpact } from './quantile';

describe('quantileSorted', () => {
    it('computes exact quartiles on aligned data', () => {
        const sorted = [1, 2, 3, 4, 5];
        expect(quantileSorted(sorted, 0.25)).toBe(2);
        expect(quantileSorted(sorted, 0.5)).toBe(3);
        expect(quantileSorted(sorted, 0.75)).toBe(4);
    });
    it('interpolates between values (type-7)', () => {
        expect(quantileSorted([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10);
    });
    it('handles boundaries and empty input', () => {
        expect(quantileSorted([7, 9], 0)).toBe(7);
        expect(quantileSorted([7, 9], 1)).toBe(9);
        expect(Number.isNaN(quantileSorted([], 0.5))).toBe(true);
    });
});

describe('detectIqrOutliers', () => {
    it('finds a planted extreme record', () => {
        const values = [...Array.from({ length: 40 }, (_, i) => 10 + (i % 5)), 10000];
        const res = detectIqrOutliers(values);
        expect(res.outlierIndices).toEqual([40]);
    });
    it('finds nothing on clean data', () => {
        const values = Array.from({ length: 50 }, (_, i) => 100 + (i % 10));
        expect(detectIqrOutliers(values).outlierIndices).toHaveLength(0);
    });
    it('detects low-side outliers too', () => {
        const values = [-5000, ...Array.from({ length: 40 }, (_, i) => 10 + (i % 5))];
        expect(detectIqrOutliers(values).outlierIndices).toEqual([0]);
    });
});

describe('computeAggregate', () => {
    it('matches hand-computed values', () => {
        expect(computeAggregate([1, 2, 3, 4], 'sum')).toBe(10);
        expect(computeAggregate([1, 2, 3, 4], 'mean')).toBe(2.5);
        expect(computeAggregate([2, 4, 4, 4, 5, 5, 7, 9], 'stdev')).toBeCloseTo(2.138, 3);
        expect(computeAggregate([2, 4, 4, 4, 5, 5, 7, 9], 'variance')).toBeCloseTo(4.571, 3);
    });
});

describe('outlierImpact', () => {
    it('quantifies how one extreme record distorts a mean (the Tableau L-sit example)', () => {
        const values = [...Array.from({ length: 40 }, () => 60), 10000];
        const { outlierIndices } = detectIqrOutliers(values);
        const { aggregateAll, aggregateWithout, impact } = outlierImpact(values, outlierIndices, 'mean');
        expect(aggregateWithout).toBeCloseTo(60, 6);
        expect(aggregateAll).toBeGreaterThan(290);
        expect(impact).toBeGreaterThan(0.5);
    });
    it('reports near-zero impact when outliers barely move the aggregate', () => {
        const values = [...Array.from({ length: 1000 }, (_, i) => 100 + (i % 7)), 160];
        const { outlierIndices } = detectIqrOutliers(values);
        const { impact } = outlierImpact(values, outlierIndices, 'sum');
        expect(impact).toBeLessThan(0.01);
    });
});
