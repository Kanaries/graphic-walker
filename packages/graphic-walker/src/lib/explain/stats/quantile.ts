/**
 * Quantile / IQR utilities for the extreme-value explainer.
 *
 * FROZEN for the executor agent: do not modify scoring logic here.
 * See docs/explain-data-worklog.md §1.
 */

/** Type-7 (linear interpolation) quantile of a pre-sorted ascending array. */
export function quantileSorted(sorted: number[], p: number): number {
    if (sorted.length === 0) return NaN;
    if (p <= 0) return sorted[0];
    if (p >= 1) return sorted[sorted.length - 1];
    const h = (sorted.length - 1) * p;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export interface IIqrOutlierResult {
    q1: number;
    q3: number;
    iqr: number;
    lowerFence: number;
    upperFence: number;
    /** indices into the ORIGINAL (unsorted) values array */
    outlierIndices: number[];
}

/** Tukey's fences: values beyond q1/q3 ± 1.5·IQR. */
export function detectIqrOutliers(values: number[], k = 1.5): IIqrOutlierResult {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quantileSorted(sorted, 0.25);
    const q3 = quantileSorted(sorted, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - k * iqr;
    const upperFence = q3 + k * iqr;
    const outlierIndices: number[] = [];
    for (let i = 0; i < values.length; i++) {
        if (values[i] < lowerFence || values[i] > upperFence) {
            outlierIndices.push(i);
        }
    }
    return { q1, q3, iqr, lowerFence, upperFence, outlierIndices };
}

export type ISensitiveAggregator = 'sum' | 'mean' | 'stdev' | 'variance';

export function computeAggregate(values: number[], agg: ISensitiveAggregator): number {
    const n = values.length;
    if (n === 0) return NaN;
    const total = values.reduce((acc, v) => acc + v, 0);
    if (agg === 'sum') return total;
    const avg = total / n;
    if (agg === 'mean') return avg;
    const sq = values.reduce((acc, v) => acc + (v - avg) * (v - avg), 0);
    const variance = n > 1 ? sq / (n - 1) : 0;
    if (agg === 'variance') return variance;
    return Math.sqrt(variance);
}

export interface IOutlierImpact {
    /** aggregate over all values */
    aggregateAll: number;
    /** aggregate with outlier values removed */
    aggregateWithout: number;
    /** relative change in the aggregate caused by the outliers, in [0, ∞) */
    impact: number;
}

/**
 * How much do the outlier rows distort the aggregate the user is looking at?
 * `impact` is relative to the full aggregate; when the full aggregate is ~0,
 * the change is scaled by the values' dispersion instead so the ratio stays
 * meaningful.
 */
export function outlierImpact(values: number[], outlierIndices: number[], agg: ISensitiveAggregator): IOutlierImpact {
    const excluded = new Set(outlierIndices);
    const kept = values.filter((_, i) => !excluded.has(i));
    const aggregateAll = computeAggregate(values, agg);
    const aggregateWithout = kept.length > 0 ? computeAggregate(kept, agg) : NaN;
    let impact = 0;
    if (Number.isFinite(aggregateAll) && Number.isFinite(aggregateWithout)) {
        const change = Math.abs(aggregateAll - aggregateWithout);
        const denom = Math.abs(aggregateAll) > 1e-12 ? Math.abs(aggregateAll) : computeAggregate(values, 'stdev') || 1;
        impact = change / denom;
    }
    return { aggregateAll, aggregateWithout, impact };
}
