import type { IRow, IViewField } from '../../../interfaces';
import { getMeaAggKey } from '../../../utils';
import { formatMeasureValue } from '../format';
import { detectIqrOutliers, outlierImpact, type ISensitiveAggregator } from '../stats/quantile';
import { EXPLAIN_COUNT_KEY, markPrescreenQuery, markRawQuery } from '../queries';
import type { IExplainContext, IExplainer, IExplanation, IExplanationStrength } from '../types';

/**
 * A-class explainer: extreme values.
 *
 * "Is the aggregate you are looking at distorted by a handful of extreme
 * row-level records?" — the most actionable explanation type: the evidence
 * is the suspicious rows themselves.
 *
 * Plan: [0] cheap pre-screen aggregate over the selected mark,
 *       [1] row-level fetch of the mark's measure values (bounded by limit).
 *
 * SCORING-FROZEN for the executor agent (see docs/explain-data-worklog.md §1).
 */

export const RAW_LIMIT = 20000;
const MIN_ROWS = 5;
const MAX_OUTLIER_SHARE = 0.2;
const MIN_IMPACT = 0.1;
const MAX_EVIDENCE_ROWS = 20;
const MAX_HISTOGRAM_POINTS = 1000;

const SENSITIVE_AGGS: ReadonlySet<string> = new Set<ISensitiveAggregator>(['mean', 'sum', 'stdev', 'variance']);

function sensitiveMeasures(ctx: IExplainContext): IViewField[] {
    const seen = new Set<string>();
    return ctx.viewMeasures.filter((m) => {
        const key = getMeaAggKey(m.fid, m.aggName ?? 'sum');
        if (seen.has(key)) return false;
        seen.add(key);
        return SENSITIVE_AGGS.has(m.aggName ?? 'sum');
    });
}

function strengthOf(impact: number): IExplanationStrength {
    if (impact >= 0.3) return 'strong';
    if (impact >= 0.15) return 'moderate';
    return 'weak';
}

/** deterministic downsample preserving outliers: every k-th value + all outliers */
function sampleForHistogram(values: number[], outlierIndices: Set<number>): number[] {
    if (values.length <= MAX_HISTOGRAM_POINTS) return values;
    const step = Math.ceil(values.length / MAX_HISTOGRAM_POINTS);
    const sampled: number[] = [];
    for (let i = 0; i < values.length; i++) {
        if (i % step === 0 || outlierIndices.has(i)) sampled.push(values[i]);
    }
    return sampled;
}

function histogramSpec(values: number[], lowerFence: number, upperFence: number, measureName: string): Record<string, unknown> {
    return {
        width: 'container',
        height: 220,
        data: { values: values.map((v) => ({ value: v })) },
        layer: [
            {
                mark: { type: 'bar', opacity: 0.85 },
                encoding: {
                    x: { field: 'value', bin: { maxbins: 30 }, type: 'quantitative', title: measureName },
                    y: { aggregate: 'count', type: 'quantitative', title: null },
                },
            },
            { mark: { type: 'rule', strokeDash: [4, 4] }, encoding: { x: { datum: lowerFence } } },
            { mark: { type: 'rule', strokeDash: [4, 4] }, encoding: { x: { datum: upperFence } } },
        ],
    };
}

export const extremeValueExplainer: IExplainer = {
    type: 'extreme-value',

    isApplicable(ctx) {
        if (Object.keys(ctx.selectedMark).length === 0) {
            return { applicable: false, reason: 'explain.skip.noMark' };
        }
        if (ctx.viewDimensions.some((d) => d.semanticType === 'temporal')) {
            // temporal marks need drill-aware equality filters; out of scope for now
            return { applicable: false, reason: 'explain.skip.temporalMark' };
        }
        if (sensitiveMeasures(ctx).length === 0) {
            return { applicable: false, reason: 'explain.skip.noSensitiveAgg' };
        }
        return { applicable: true };
    },

    plan(ctx) {
        const fids = sensitiveMeasures(ctx).map((m) => m.fid);
        return [markPrescreenQuery(ctx, fids), markRawQuery(ctx, [...new Set(fids)], RAW_LIMIT)];
    },

    analyze(ctx, results) {
        const [prescreenRows, rawRows] = results;
        const stats = prescreenRows?.[0];
        if (!stats) return [];
        const n = Number(stats[EXPLAIN_COUNT_KEY]);
        if (!Number.isFinite(n) || n < MIN_ROWS) return [];
        const truncated = rawRows.length >= RAW_LIMIT;

        const explanations: IExplanation[] = [];
        for (const measure of sensitiveMeasures(ctx)) {
            const agg = (measure.aggName ?? 'sum') as ISensitiveAggregator;
            const mean = Number(stats[getMeaAggKey(measure.fid, 'mean')]);
            const median = Number(stats[getMeaAggKey(measure.fid, 'median')]);
            const stdev = Number(stats[getMeaAggKey(measure.fid, 'stdev')]);
            const maxV = Number(stats[getMeaAggKey(measure.fid, 'max')]);
            const minV = Number(stats[getMeaAggKey(measure.fid, 'min')]);
            const signaled =
                Number.isFinite(stdev) &&
                stdev > 0 &&
                (Math.abs(mean - median) > 0.5 * stdev || maxV - median > 3 * stdev || median - minV > 3 * stdev);
            if (!signaled) continue;

            if (truncated) {
                explanations.push({
                    type: 'extreme-value',
                    score: Math.abs(mean - median) / stdev,
                    strength: 'weak',
                    field: measure,
                    measure,
                    descriptionKey: 'explain.extremeValue.truncated',
                    descriptionParams: { measure: measure.name ?? measure.fid, rowCount: n },
                    evidence: {},
                });
                continue;
            }

            const valueRows: { value: number; row: IRow }[] = rawRows
                .map((row) => ({ value: Number(row[measure.fid]), row }))
                .filter((x) => Number.isFinite(x.value));
            if (valueRows.length < MIN_ROWS) continue;
            const values = valueRows.map((x) => x.value);
            const { lowerFence, upperFence, outlierIndices } = detectIqrOutliers(values);
            if (outlierIndices.length === 0) continue;
            if (outlierIndices.length / values.length > MAX_OUTLIER_SHARE) continue; // long tail, not "a few bad rows"
            const { aggregateAll, aggregateWithout, impact } = outlierImpact(values, outlierIndices, agg);
            if (!Number.isFinite(impact) || impact < MIN_IMPACT) continue;

            const outlierSet = new Set(outlierIndices);
            explanations.push({
                type: 'extreme-value',
                score: impact,
                strength: strengthOf(impact),
                field: measure,
                measure,
                descriptionKey: 'explain.extremeValue.desc',
                descriptionParams: {
                    measure: measure.name ?? measure.fid,
                    agg,
                    outlierCount: outlierIndices.length,
                    rowCount: values.length,
                    before: formatMeasureValue(aggregateAll),
                    after: formatMeasureValue(aggregateWithout),
                    changePercent: Math.round(impact * 1000) / 10,
                },
                evidence: {
                    rows: outlierIndices.slice(0, MAX_EVIDENCE_ROWS).map((i) => valueRows[i].row),
                    chartSpec: histogramSpec(sampleForHistogram(values, outlierSet), lowerFence, upperFence, measure.name ?? measure.fid),
                },
            });
        }
        return explanations.sort((a, b) => b.score - a.score);
    },
};
