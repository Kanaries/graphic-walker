import type { IRow, IViewField } from '../../../interfaces';
import { getMeaAggKey } from '../../../utils';
import { EXPLAIN_COUNT_KEY, complementaryDimensions, markLevelQuery } from '../queries';
import { standardize } from '../stats/ridge';
import {
    MIN_SCORE,
    PERMUTATION_P_THRESHOLD,
    baseFeatures,
    buildMarksTable,
    markKeyOf,
    modelStrength,
    scatterSpec,
    scoreCandidate,
    seedFromString,
    targetMeasure,
} from './modelCommon';
import type { IExplainContext, IExplainer, IExplanation } from '../types';

/**
 * B-class explainer: contributing dimensions.
 *
 * Does the composition of an unvisualized dimension (per-mark shares of its
 * top values) help predict the target measure across marks? Shares the
 * per-candidate markLevelQuery with the unique-mark explainer — the engine
 * dedupes, so both run off one scan per candidate.
 *
 * SCORING-FROZEN for the executor agent (see docs/explain-data-worklog.md §1).
 */

const MAX_RESULTS = 5;
const MAX_RATE_FEATURES = 6;

export const contributingDimExplainer: IExplainer = {
    type: 'contributing-dimension',

    isApplicable(ctx) {
        if (Object.keys(ctx.selectedMark).length === 0 || ctx.viewDimensions.length === 0) {
            return { applicable: false, reason: 'explain.skip.noMark' };
        }
        if (!targetMeasure(ctx)) {
            return { applicable: false, reason: 'explain.skip.noDerivableTarget' };
        }
        if (complementaryDimensions(ctx).length === 0) {
            return { applicable: false, reason: 'explain.skip.noCandidates' };
        }
        return { applicable: true };
    },

    plan(ctx) {
        // identical payloads to the unique-mark explainer → engine-level dedup
        return complementaryDimensions(ctx).map((candidate) => markLevelQuery(ctx, candidate).payload);
    },

    analyze(ctx, results) {
        const target = targetMeasure(ctx)!;
        const candidates = complementaryDimensions(ctx);
        const explanations: IExplanation[] = [];

        candidates.forEach((candidate, index) => {
            const rows = results[index];
            if (!rows || rows.length === 0) return;
            const table = buildMarksTable(ctx, rows, target);
            if (!table) return;
            const baseX = baseFeatures(ctx, table);
            const { candidateKey } = markLevelQuery(ctx, candidate);

            // global top categories by row count
            const globalCounts = new Map<string, number>();
            for (const row of rows) {
                const cat = String(row[candidateKey]);
                globalCounts.set(cat, (globalCounts.get(cat) ?? 0) + (Number(row[EXPLAIN_COUNT_KEY]) || 0));
            }
            const nTrain = table.markKeys.length - 1;
            const maxFeatures = Math.min(MAX_RATE_FEATURES, Math.max(1, Math.floor(nTrain / 4)));
            const topCategories = [...globalCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, maxFeatures + 1) // +1: the last share is redundant (sums to ~1), drop it below
                .map(([cat]) => cat)
                .slice(0, Math.max(1, Math.min(maxFeatures, globalCounts.size - 1)));
            if (topCategories.length === 0) return;

            // per-mark rate of each top category
            const rateOf = (markRows: IRow[], cat: string, total: number): number => {
                if (total <= 0) return 0;
                const catCount = markRows.reduce((acc, r) => acc + (String(r[candidateKey]) === cat ? Number(r[EXPLAIN_COUNT_KEY]) || 0 : 0), 0);
                return catCount / total;
            };
            const rateCols = topCategories.map((cat) => table.rowsByMark.map((markRows, i) => rateOf(markRows, cat, table.counts[i])));
            if (rateCols.every((col) => new Set(col).size < 2)) return; // composition constant across marks
            const zCols = rateCols.map(standardize);
            const candX = table.markKeys.map((_, r) => zCols.map((col) => col[r]));

            const scored = scoreCandidate(baseX, candX, table.y, table.selectedIndex, seedFromString(`dim:${candidate.fid}`));
            if (!scored || scored.score < MIN_SCORE || scored.pValue >= PERMUTATION_P_THRESHOLD) return;

            // most associated category: largest |correlation-ish| via rate column vs y (on standardized cols)
            const zy = standardize(table.y);
            let bestCat = 0;
            let bestAbs = -1;
            zCols.forEach((col, c) => {
                const corr = Math.abs(col.reduce((acc, v, i) => acc + v * zy[i], 0) / col.length);
                if (corr > bestAbs) {
                    bestAbs = corr;
                    bestCat = c;
                }
            });

            explanations.push({
                type: 'contributing-dimension',
                score: scored.score,
                strength: modelStrength(scored.score),
                field: candidate,
                measure: target,
                descriptionKey: 'explain.contributingDimension.desc',
                descriptionParams: {
                    dimension: candidate.name ?? candidate.fid,
                    target: target.name ?? target.fid,
                    topCategory: topCategories[bestCat],
                    cvGainPercent: Math.round(Math.max(0, scored.fitGain) * 1000) / 10,
                },
                evidence: {
                    chartSpec: scatterSpec(
                        rateCols[bestCat],
                        table.y,
                        table.selectedIndex,
                        `share of "${topCategories[bestCat]}" in ${candidate.name ?? candidate.fid}`,
                        `${target.aggName ?? 'sum'} ${target.name ?? target.fid}`
                    ),
                },
            });
        });

        return explanations.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
    },
};
