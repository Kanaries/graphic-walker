import type { IComputationFunction, IDataQueryPayload, IField, IFilterField, IRow, IViewField } from '../../interfaces';

/**
 * Explain Data module — shared contracts.
 *
 * INTERFACE-FROZEN for the executor agent: propose signature changes in
 * docs/explain-data-worklog.md §5 instead of editing this file.
 *
 * Architecture rule: explainers declare ALL data needs as workflow DSL
 * payloads via `plan()`; `analyze()` is a pure function of the query
 * results. No explainer may touch a data source directly — this is what
 * keeps the module working against both the in-browser computation and a
 * server-side computation service.
 */

export type IExplanationType = 'extreme-value' | 'contributing-dimension' | 'contributing-measure' | 'unique-mark';

export type IExplanationStrength = 'strong' | 'moderate' | 'weak';

export interface IExplainContext {
    /** all dataset fields (including ones not in the view) */
    allFields: IViewField[];
    /** dimensions currently in the view — these define the mark's level of detail */
    viewDimensions: IViewField[];
    /** measures currently in the view */
    viewMeasures: IViewField[];
    /** active view filters */
    viewFilters: IFilterField[];
    /** the clicked mark: view-dimension fid → value */
    selectedMark: Record<string, string | number>;
    timezoneDisplayOffset?: number;
    /**
     * cap on candidate (unvisualized) dimensions scanned per run; defaults
     * to DEFAULT_CANDIDATE_LIMIT. UI raises it for "analyze more fields".
     * No silent truncation: read `candidateTruncation(ctx)` to tell users.
     */
    candidateLimit?: number;
}

export interface IExplanationEvidence {
    /** vega-lite spec, self-contained (inline data values); UI applies theme config only */
    chartSpec?: Record<string, unknown>;
    /** supporting rows, e.g. the outlier records */
    rows?: IRow[];
}

export interface IExplanation {
    type: IExplanationType;
    /** type-specific score; NOT comparable across types — rank within a type only */
    score: number;
    strength: IExplanationStrength;
    /** the explaining field */
    field: IField;
    /** the measure being explained, when applicable */
    measure?: IField;
    /** i18n key; UI must not hardcode explanation copy */
    descriptionKey: string;
    descriptionParams: Record<string, string | number>;
    evidence: IExplanationEvidence;
}

export interface IApplicability {
    applicable: boolean;
    /** i18n key explaining why the explainer was skipped */
    reason?: string;
}

export interface IExplainer {
    type: IExplanationType;
    isApplicable(ctx: IExplainContext): IApplicability;
    /**
     * Declare data needs as workflow DSL payloads. Must be deterministic for
     * a given context (the engine dedupes structurally identical payloads
     * across explainers). Build shared queries through `queries.ts` helpers
     * so deduplication actually fires.
     */
    plan(ctx: IExplainContext): IDataQueryPayload[];
    /**
     * Pure function: `results[i]` is the result set of `plan(ctx)[i]`.
     * Never issues queries of its own.
     */
    analyze(ctx: IExplainContext, results: IRow[][]): IExplanation[];
}

export interface IExplainerResult {
    explainer: IExplanationType;
    status: 'ok' | 'skipped' | 'error';
    /** i18n key when skipped; error message when errored */
    reason?: string;
    explanations: IExplanation[];
}

export interface IExplainOptions {
    /** max concurrent queries, default 4 */
    concurrency?: number;
    /** override the explainer set (defaults to all registered explainers) */
    explainers?: IExplainer[];
}

export type { IComputationFunction, IDataQueryPayload };
