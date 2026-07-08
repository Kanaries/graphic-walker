import type { IRow, IViewField } from '../../../interfaces';
import { getMeaAggKey } from '../../../utils';
import { categoryLabel } from '../format';
import { gTestPValue, jsDistance, laplaceSmooth, subtractMass } from '../stats/divergence';
import { ADDITIVE_SAFE_AGGS, EXPLAIN_COUNT_KEY, complementaryDimensions, isMarkRow, markLevelQuery } from '../queries';
import type { IExplainContext, IExplainer, IExplanation, IExplanationStrength } from '../types';

/**
 * D-class explainer: what is unique about this mark?
 *
 * Compares the selected mark's composition over each unvisualized dimension
 * against the SIBLINGS (all other marks), not the parent that contains the
 * mark itself. Framed as an exploratory clue, ranked below A/B/C evidence.
 *
 * Shares its per-candidate queries with the contributing-dimension explainer
 * (same markLevelQuery builder → engine-level dedup).
 *
 * SCORING-FROZEN for the executor agent (see docs/explain-data-worklog.md §1).
 */

const MIN_MARK_ROWS = 20;
const MAX_CATEGORIES = 12; // collapse the tail into __other__ beyond this
const COUNT_P_THRESHOLD = 0.01;
const COUNT_JS_THRESHOLD = 0.15;
const MEASURE_JS_THRESHOLD = 0.25;
const MAX_RESULTS = 5;
const SMOOTH_ALPHA = 0.5;
/**
 * Guard against row-level outlier leakage: if one category's per-row mean is
 * this many times the median per-row mean, the mass concentration is likely
 * driven by a few extreme records — that is the extreme-value explainer's
 * territory, and reporting it here as "unique composition" would be a false
 * insight on every unrelated dimension.
 */
const ROW_DOMINANCE_RATIO = 10;
export const OTHER_CATEGORY = '__other__';

interface ICandidateComposition {
    categories: (string | number)[];
    markCounts: number[];
    siblingCounts: number[];
    /** per view-measure fid: additive sum masses */
    markSums: Map<string, number[]>;
    siblingSums: Map<string, number[]>;
}

function buildComposition(ctx: IExplainContext, rows: IRow[], candidateKey: string, measureFids: string[]): ICandidateComposition | null {
    type Bucket = { total: number; mark: number; totalSums: number[]; markSums: number[] };
    const buckets = new Map<string | number, Bucket>();
    for (const row of rows) {
        const category = row[candidateKey] === undefined || row[candidateKey] === null ? row[candidateKey] : categoryLabel(row[candidateKey]);
        if (category === undefined || category === null) continue;
        let bucket = buckets.get(category);
        if (!bucket) {
            bucket = { total: 0, mark: 0, totalSums: measureFids.map(() => 0), markSums: measureFids.map(() => 0) };
            buckets.set(category, bucket);
        }
        const rowCount = Number(row[EXPLAIN_COUNT_KEY]) || 0;
        const mark = isMarkRow(row, ctx);
        bucket.total += rowCount;
        if (mark) bucket.mark += rowCount;
        measureFids.forEach((fid, i) => {
            const v = Number(row[getMeaAggKey(fid, 'sum')]) || 0;
            bucket!.totalSums[i] += v;
            if (mark) bucket!.markSums[i] += v;
        });
    }
    if (buckets.size < 2) return null;

    // collapse the tail into __other__ so high-cardinality candidates stay comparable
    const entries = [...buckets.entries()].sort((a, b) => b[1].total - a[1].total);
    const kept = entries.slice(0, MAX_CATEGORIES);
    const tail = entries.slice(MAX_CATEGORIES);
    if (tail.length > 0) {
        const other: Bucket = { total: 0, mark: 0, totalSums: measureFids.map(() => 0), markSums: measureFids.map(() => 0) };
        for (const [, b] of tail) {
            other.total += b.total;
            other.mark += b.mark;
            b.totalSums.forEach((v, i) => (other.totalSums[i] += v));
            b.markSums.forEach((v, i) => (other.markSums[i] += v));
        }
        kept.push([OTHER_CATEGORY, other]);
    }

    const categories = kept.map(([c]) => c);
    const markCounts = kept.map(([, b]) => b.mark);
    const totalCounts = kept.map(([, b]) => b.total);
    const siblingCounts = subtractMass(totalCounts, markCounts);
    const markSums = new Map<string, number[]>();
    const siblingSums = new Map<string, number[]>();
    measureFids.forEach((fid, i) => {
        const mark = kept.map(([, b]) => b.markSums[i]);
        const total = kept.map(([, b]) => b.totalSums[i]);
        markSums.set(fid, mark);
        // negative sums make "share of mass" meaningless — flag by storing null-ish
        if (mark.some((v) => v < 0) || total.some((v, j) => v - mark[j] < -1e-9)) {
            siblingSums.set(fid, []);
        } else {
            siblingSums.set(fid, subtractMass(total, mark));
        }
    });
    return { categories, markCounts, siblingCounts, markSums, siblingSums };
}

function strengthOf(js: number): IExplanationStrength {
    if (js >= 0.4) return 'strong';
    if (js >= 0.25) return 'moderate';
    return 'weak';
}

function compositionSpec(
    categories: (string | number)[],
    markShares: number[],
    siblingShares: number[],
    candidateName: string
): Record<string, unknown> {
    const values = categories.flatMap((category, i) => [
        { category: String(category), group: 'selected', share: markShares[i] },
        { category: String(category), group: 'siblings', share: siblingShares[i] },
    ]);
    return {
        width: 320,
        height: 180,
        data: { values },
        mark: { type: 'bar' },
        encoding: {
            x: { field: 'category', type: 'nominal', title: candidateName, sort: null },
            xOffset: { field: 'group' },
            y: { field: 'share', type: 'quantitative', title: 'share', axis: { format: '.0%' } },
            color: { field: 'group', type: 'nominal', legend: { orient: 'bottom', title: null } },
        },
    };
}

export const uniqueMarkExplainer: IExplainer = {
    type: 'unique-mark',

    isApplicable(ctx) {
        if (Object.keys(ctx.selectedMark).length === 0 || ctx.viewDimensions.length === 0) {
            return { applicable: false, reason: 'explain.skip.noMark' };
        }
        if (complementaryDimensions(ctx).length === 0) {
            return { applicable: false, reason: 'explain.skip.noCandidates' };
        }
        return { applicable: true };
    },

    plan(ctx) {
        return complementaryDimensions(ctx).map((candidate) => markLevelQuery(ctx, candidate).payload);
    },

    analyze(ctx, results) {
        const candidates = complementaryDimensions(ctx);
        const measureFids = [
            ...new Set(ctx.viewMeasures.filter((m) => ADDITIVE_SAFE_AGGS.has(m.aggName ?? 'sum')).map((m) => m.fid)),
        ];
        const explanations: IExplanation[] = [];

        candidates.forEach((candidate, index) => {
            const rows = results[index];
            if (!rows || rows.length === 0) return;
            const { candidateKey } = markLevelQuery(ctx, candidate);
            const composition = buildComposition(ctx, rows, candidateKey, measureFids);
            if (!composition) return;
            const { categories, markCounts, siblingCounts, markSums, siblingSums } = composition;
            const markN = markCounts.reduce((a, b) => a + b, 0);
            const siblingN = siblingCounts.reduce((a, b) => a + b, 0);
            if (markN < MIN_MARK_ROWS || siblingN < MIN_MARK_ROWS) return;

            const markProbs = laplaceSmooth(markCounts, SMOOTH_ALPHA);
            const siblingProbs = laplaceSmooth(siblingCounts, SMOOTH_ALPHA);

            let best: IExplanation | null = null;

            // count-based composition: statistically testable, preferred
            const countJs = jsDistance(markProbs, siblingProbs);
            const p = gTestPValue(markCounts, siblingProbs);
            if (p < COUNT_P_THRESHOLD && countJs > COUNT_JS_THRESHOLD) {
                const topIdx = markProbs.reduce((maxI, v, i) => (v - siblingProbs[i] > markProbs[maxI] - siblingProbs[maxI] ? i : maxI), 0);
                best = {
                    type: 'unique-mark',
                    score: countJs,
                    strength: strengthOf(countJs),
                    field: candidate,
                    descriptionKey: 'explain.uniqueMark.countDesc',
                    descriptionParams: {
                        dimension: candidate.name ?? candidate.fid,
                        topCategory: String(categories[topIdx]),
                        markShare: Math.round(markProbs[topIdx] * 1000) / 10,
                        siblingShare: Math.round(siblingProbs[topIdx] * 1000) / 10,
                        pValue: p < 1e-4 ? '<0.0001' : String(Math.round(p * 10000) / 10000),
                    },
                    evidence: { chartSpec: compositionSpec(categories, markProbs, siblingProbs, candidate.name ?? candidate.fid) },
                };
            }

            // measure-mass composition: heuristic (no significance test), higher bar
            for (const fid of measureFids) {
                const markMass = markSums.get(fid) ?? [];
                const siblingMass = siblingSums.get(fid) ?? [];
                if (markMass.length === 0 || siblingMass.length === 0) continue; // negative-mass fallback
                // row-dominance guard: per-category per-row means within the mark
                const perRowMeans = markMass.map((v, i) => (markCounts[i] > 0 ? v / markCounts[i] : NaN)).filter((v) => Number.isFinite(v));
                if (perRowMeans.length >= 2) {
                    const sortedMeans = [...perRowMeans].sort((a, b) => a - b);
                    const medianMean = sortedMeans[Math.floor(sortedMeans.length / 2)];
                    if (medianMean > 0 && Math.max(...perRowMeans) / medianMean > ROW_DOMINANCE_RATIO) continue;
                }
                const pm = laplaceSmooth(markMass, SMOOTH_ALPHA);
                const qm = laplaceSmooth(siblingMass, SMOOTH_ALPHA);
                const js = jsDistance(pm, qm);
                if (js <= MEASURE_JS_THRESHOLD || js <= (best?.score ?? 0)) continue;
                const measure = ctx.viewMeasures.find((m) => m.fid === fid)!;
                best = {
                    type: 'unique-mark',
                    score: js,
                    strength: strengthOf(js),
                    field: candidate,
                    measure,
                    descriptionKey: 'explain.uniqueMark.measureDesc',
                    descriptionParams: { dimension: candidate.name ?? candidate.fid, measure: measure.name ?? fid },
                    evidence: { chartSpec: compositionSpec(categories, pm, qm, candidate.name ?? candidate.fid) },
                };
            }

            if (best) explanations.push(best);
        });

        return explanations.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
    },
};
