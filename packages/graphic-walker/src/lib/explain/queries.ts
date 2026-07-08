import type { IDataQueryPayload, IDataQueryWorkflowStep, IExpression, IRow, IViewField, IVisFilter } from '../../interfaces';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID } from '../../constants';
import { getMeaAggKey } from '../../utils';
import { addFilterForQuery, addTransformForQuery, createFilter, processExpression } from '../../utils/workflow';
import type { IExplainContext } from './types';

/**
 * Shared workflow-DSL query builders for all explainers.
 *
 * Explainers MUST build queries through these helpers: the engine dedupes
 * structurally identical payloads, so two explainers using the same builder
 * automatically share one query execution (this is how the contributing-
 * dimension and unique-mark explainers split a single scan per candidate).
 */

/** aggregate result key for the per-group row count */
export const EXPLAIN_COUNT_KEY = '__explain_row_count';

/** derived-field key used when a quantitative candidate dimension is binned */
export const explainBinKey = (fid: string) => `${fid}__explain_bin`;

const SPECIAL_FIDS = new Set<string>([COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID, PAINT_FIELD_ID]);

export const QUANT_BIN_NUM = 10;

/** measure aggregators whose mass composition is meaningful for D/B class analysis */
export const ADDITIVE_SAFE_AGGS = new Set(['sum', 'mean', 'count']);

export const DEFAULT_CANDIDATE_LIMIT = 20;

function allCandidateDimensions(ctx: IExplainContext): IViewField[] {
    const inView = new Set(ctx.viewDimensions.map((f) => f.fid));
    return ctx.allFields.filter(
        (f) => f.analyticType === 'dimension' && !inView.has(f.fid) && !SPECIAL_FIDS.has(f.fid) && f.semanticType !== 'temporal'
    );
}

/**
 * Candidate dimensions for composition-based explainers: every dimension
 * field not in the view, capped at ctx.candidateLimit (wide tables would
 * otherwise trigger one query per field). Temporal candidates are excluded
 * for now (drill granularity selection is an open question, worklog §6.3).
 */
export function complementaryDimensions(ctx: IExplainContext): IViewField[] {
    return allCandidateDimensions(ctx).slice(0, ctx.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT);
}

/** truncation info so the UI can say "N of M fields scanned" — no silent caps */
export function candidateTruncation(ctx: IExplainContext): { scanned: number; total: number; truncated: boolean } {
    const total = allCandidateDimensions(ctx).length;
    const scanned = Math.min(total, ctx.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT);
    return { scanned, total, truncated: scanned < total };
}

/** transform entries for all computed fields the queries may reference */
function computedFieldTransforms(ctx: IExplainContext): { key: string; expression: IExpression }[] {
    return ctx.allFields
        .filter((f) => f.computed && f.expression && !(f.expression.op === 'expr' && f.aggName === 'expr'))
        .map((f) => ({
            key: f.fid,
            expression: processExpression(f.expression!, ctx.allFields, { timezoneDisplayOffset: ctx.timezoneDisplayOffset }),
        }));
}

/** resolved row-level view filters (aggregate-level filters are not supported here) */
function resolvedViewFilters(ctx: IExplainContext): IVisFilter[] {
    return ctx.viewFilters.filter((f) => f.rule && !f.enableAgg).map(createFilter);
}

/** equality filters pinning the selected mark, over the view dimensions */
export function markFilters(ctx: IExplainContext): IVisFilter[] {
    return ctx.viewDimensions
        .filter((d) => ctx.selectedMark[d.fid] !== undefined)
        .map((d) => ({ fid: d.fid, rule: { type: 'one of', value: [ctx.selectedMark[d.fid]] } }));
}

/** wrap a view step into a full payload: transforms first, then filters, then the view */
function assemble(ctx: IExplainContext, viewStep: IDataQueryWorkflowStep, opts?: { extraTransforms?: { key: string; expression: IExpression }[]; extraFilters?: IVisFilter[]; limit?: number }): IDataQueryPayload {
    let payload: IDataQueryPayload = { workflow: [viewStep] };
    if (opts?.limit) payload = { ...payload, limit: opts.limit };
    payload = addFilterForQuery(payload, [...resolvedViewFilters(ctx), ...(opts?.extraFilters ?? [])]);
    payload = addTransformForQuery(payload, [...computedFieldTransforms(ctx), ...(opts?.extraTransforms ?? [])]);
    return payload;
}

export interface IMarkLevelQuery {
    payload: IDataQueryPayload;
    /** the group-by key holding the candidate dimension's (possibly binned) value */
    candidateKey: string;
}

/**
 * The workhorse query shared by the contributing-dimension and unique-mark
 * explainers: group by [view dimensions..., candidate] over ALL marks,
 * fetching row counts plus per-measure sums. Sums and counts are additive,
 * so mark / siblings / totals are all derivable client-side from this one
 * result set.
 */
export function markLevelQuery(ctx: IExplainContext, candidate: IViewField): IMarkLevelQuery {
    const isQuant = candidate.semanticType === 'quantitative';
    const candidateKey = isQuant ? explainBinKey(candidate.fid) : candidate.fid;
    const extraTransforms = isQuant
        ? [
              {
                  key: candidateKey,
                  expression: {
                      op: 'bin',
                      as: candidateKey,
                      num: QUANT_BIN_NUM,
                      params: [{ type: 'field', value: candidate.fid }],
                  } as unknown as IExpression,
              },
          ]
        : [];
    const measureFids = [...new Set(ctx.viewMeasures.filter((m) => m.fid !== COUNT_FIELD_ID && m.aggName !== 'expr').map((m) => m.fid))];
    const viewStep: IDataQueryWorkflowStep = {
        type: 'view',
        query: [
            {
                op: 'aggregate',
                groupBy: [...ctx.viewDimensions.map((d) => d.fid), candidateKey],
                measures: [
                    { field: '*', agg: 'count', asFieldKey: EXPLAIN_COUNT_KEY },
                    ...measureFids.map((fid) => ({ field: fid, agg: 'sum' as const, asFieldKey: getMeaAggKey(fid, 'sum') })),
                ],
            },
        ],
    };
    return { payload: assemble(ctx, viewStep, { extraTransforms }), candidateKey };
}

/**
 * Pre-screen aggregates for the selected mark: cheap distribution statistics
 * that decide whether fetching row-level data is worthwhile.
 */
export function markPrescreenQuery(ctx: IExplainContext, measureFids: string[]): IDataQueryPayload {
    const viewStep: IDataQueryWorkflowStep = {
        type: 'view',
        query: [
            {
                op: 'aggregate',
                groupBy: [],
                measures: [
                    { field: '*', agg: 'count', asFieldKey: EXPLAIN_COUNT_KEY },
                    ...measureFids.flatMap((fid) =>
                        (['mean', 'median', 'stdev', 'min', 'max'] as const).map((agg) => ({
                            field: fid,
                            agg,
                            asFieldKey: getMeaAggKey(fid, agg),
                        }))
                    ),
                ],
            },
        ],
    };
    return assemble(ctx, viewStep, { extraFilters: markFilters(ctx) });
}

/** row-level values of the selected mark, for IQR outlier analysis */
export function markRawQuery(ctx: IExplainContext, fields: string[], limit: number): IDataQueryPayload {
    const viewStep: IDataQueryWorkflowStep = {
        type: 'view',
        query: [{ op: 'raw', fields }],
    };
    return assemble(ctx, viewStep, { extraFilters: markFilters(ctx), limit });
}

/**
 * Marks-level aggregation at the view's level of detail, carrying the view
 * measures plus candidate (unvisualized) measures — the single query behind
 * the contributing-measure explainer.
 */
export function marksWithMeasuresQuery(ctx: IExplainContext, candidateMeasureFids: string[]): IDataQueryPayload {
    const viewMeasureFids = [...new Set(ctx.viewMeasures.filter((m) => m.fid !== COUNT_FIELD_ID && m.aggName !== 'expr').map((m) => m.fid))];
    const fids = [...new Set([...viewMeasureFids, ...candidateMeasureFids])];
    const viewStep: IDataQueryWorkflowStep = {
        type: 'view',
        query: [
            {
                op: 'aggregate',
                groupBy: ctx.viewDimensions.map((d) => d.fid),
                measures: [
                    { field: '*', agg: 'count', asFieldKey: EXPLAIN_COUNT_KEY },
                    ...fids.map((fid) => ({ field: fid, agg: 'sum' as const, asFieldKey: getMeaAggKey(fid, 'sum') })),
                ],
            },
        ],
    };
    return assemble(ctx, viewStep);
}

/** does this aggregated row belong to the selected mark? */
export function isMarkRow(row: IRow, ctx: IExplainContext): boolean {
    return ctx.viewDimensions.every((d) => {
        const expected = ctx.selectedMark[d.fid];
        if (expected === undefined) return true;
        const actual = row[d.fid];
        // grouped values may come back as numbers vs strings depending on the
        // computation backend; compare loosely via string form
        return actual === expected || String(actual) === String(expected);
    });
}

/** stable stringify with sorted object keys — the engine's dedup key */
export function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value as Record<string, unknown>).sort();
        return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
