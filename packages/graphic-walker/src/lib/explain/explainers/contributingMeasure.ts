import type { IViewField } from '../../../interfaces';
import { COUNT_FIELD_ID } from '../../../constants';
import { getMeaAggKey } from '../../../utils';
import { marksWithMeasuresQuery } from '../queries';
import {
    MIN_SCORE,
    PERMUTATION_P_THRESHOLD,
    baseFeatures,
    buildMarksTable,
    modelStrength,
    scatterSpec,
    scoreCandidate,
    secondOrderFeatures,
    seedFromString,
    targetMeasure,
} from './modelCommon';
import type { IExplainContext, IExplainer, IExplanation } from '../types';

/**
 * C-class explainer: contributing measures.
 *
 * Does an unvisualized measure, aggregated to the view's level of detail,
 * help predict the target measure across marks? Base model vs explain model
 * with the selected mark held out; second-order term captures simple
 * non-linear association (Tableau's "second-order modeling for measures").
 *
 * SCORING-FROZEN for the executor agent (see docs/explain-data-worklog.md §1).
 */

const MAX_RESULTS = 5;

function candidateMeasures(ctx: IExplainContext): IViewField[] {
    const inView = new Set(ctx.viewMeasures.map((m) => m.fid));
    return ctx.allFields.filter((f) => f.analyticType === 'measure' && !inView.has(f.fid) && f.fid !== COUNT_FIELD_ID && f.aggName !== 'expr' && !f.computed);
}

export const contributingMeasureExplainer: IExplainer = {
    type: 'contributing-measure',

    isApplicable(ctx) {
        if (Object.keys(ctx.selectedMark).length === 0 || ctx.viewDimensions.length === 0) {
            return { applicable: false, reason: 'explain.skip.noMark' };
        }
        if (!targetMeasure(ctx)) {
            return { applicable: false, reason: 'explain.skip.noDerivableTarget' };
        }
        if (candidateMeasures(ctx).length === 0) {
            return { applicable: false, reason: 'explain.skip.noCandidates' };
        }
        return { applicable: true };
    },

    plan(ctx) {
        return [marksWithMeasuresQuery(ctx, candidateMeasures(ctx).map((m) => m.fid))];
    },

    analyze(ctx, results) {
        const rows = results[0];
        if (!rows || rows.length === 0) return [];
        const target = targetMeasure(ctx)!;
        const table = buildMarksTable(ctx, rows, target);
        if (!table) return [];
        const baseX = baseFeatures(ctx, table);
        const explanations: IExplanation[] = [];

        for (const candidate of candidateMeasures(ctx)) {
            const sumKey = getMeaAggKey(candidate.fid, 'sum');
            // per-mark mean of the candidate measure (marks table holds one row per mark here)
            const values = table.rowsByMark.map((markRows, i) => {
                const total = markRows.reduce((acc, r) => acc + (Number(r[sumKey]) || 0), 0);
                return table.counts[i] > 0 ? total / table.counts[i] : 0;
            });
            if (new Set(values).size < 2) continue; // constant → no signal
            const candX = secondOrderFeatures(values);
            const scored = scoreCandidate(baseX, candX, table.y, table.selectedIndex, seedFromString(`measure:${candidate.fid}`));
            if (!scored || scored.score < MIN_SCORE || scored.pValue >= PERMUTATION_P_THRESHOLD) continue;
            explanations.push({
                type: 'contributing-measure',
                score: scored.score,
                strength: modelStrength(scored.score),
                field: candidate,
                measure: target,
                descriptionKey: 'explain.contributingMeasure.desc',
                descriptionParams: {
                    candidate: candidate.name ?? candidate.fid,
                    target: target.name ?? target.fid,
                    cvGainPercent: Math.round(Math.max(0, scored.fitGain) * 1000) / 10,
                },
                evidence: {
                    chartSpec: scatterSpec(values, table.y, table.selectedIndex, `mean ${candidate.name ?? candidate.fid}`, `${target.aggName ?? 'sum'} ${target.name ?? target.fid}`),
                },
            });
        }
        return explanations.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
    },
};
