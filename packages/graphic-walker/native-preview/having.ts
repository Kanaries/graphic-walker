import type { Plan, QueryPayload } from '@kanaries/worksheet-renderer';
import type { IDataQueryWorkflowStep, IFilterWorkflowStep, IViewWorkflowStep } from '../src/interfaces';

type Measure = Extract<IViewWorkflowStep['query'][number], { op: 'aggregate' }>['measures'][number];

/**
 * The editor's filters on aggregated values, such as sum(Sales) >= 100. The editor applies them to
 * the rows of its one aggregated query, so they hold at one grain: the dimensions that query
 * groups by. `measures` are the aggregates the filters read, under the names the filters use.
 */
export interface Having {
    groupBy: string[];
    measures: Measure[];
    filters: IFilterWorkflowStep[];
}

/**
 * Splits the workflow the editor would run into what comes before its view step, which every
 * worksheet query starts with, and the filters on aggregated values that come after it.
 */
export function splitWorkflow(steps: IDataQueryWorkflowStep[]): { before: IDataQueryWorkflowStep[]; having?: Having } {
    const at = steps.findIndex((step) => step.type === 'view');
    if (at < 0) return { before: [] };
    const before = steps.slice(0, at);
    const view = steps[at];
    const query = view.type === 'view' ? view.query[0] : undefined;
    const filters = steps.slice(at + 1).filter((step): step is IFilterWorkflowStep => step.type === 'filter');
    if (!filters.length || query?.op !== 'aggregate') return { before };
    const read = new Set(filters.flatMap((step) => step.filters.map((f) => f.fid)));
    return { before, having: { groupBy: query.groupBy, measures: query.measures.filter((m) => read.has(m.asFieldKey)), filters } };
}

const sameFields = (a: string[], b: string[]) => {
    const set = new Set(a);
    return set.size === new Set(b).size && b.every((field) => set.has(field));
};

/**
 * Whether every query the sheet draws its marks from is an aggregate at the grain the filters hold
 * at. Only then do the filters mean in the sheet what they mean in the editor's other renderers.
 * Queries that only order members are at a coarser grain and are not asked about.
 */
export function drawnAtGrain(plan: Plan, groupBy: string[]): boolean {
    const drawn = new Set(plan.bindings.map((binding) => binding.taskId));
    return plan.tasks.filter((task) => drawn.has(task.id)).every((task) => !task.raw && sameFields(task.groupBy, groupBy));
}

/**
 * The workflow sent for one worksheet query: the editor's steps before its view step, the
 * worksheet's own grouping, the filters on aggregated values where the query is at their grain,
 * and the worksheet's ordering. A query at another grain, which orders members by their totals,
 * is not filtered.
 */
export function composeWorkflow(before: IDataQueryWorkflowStep[], having: Having | undefined, aggregated: boolean, payload: QueryPayload): IDataQueryWorkflowStep[] {
    const view = payload.workflow.find((step) => step.type === 'view');
    const query = view && view.type === 'view' ? view.query[0] : undefined;
    if (!query) return [];
    // What the worksheet wants done with the result: put it in order and keep the first rows.
    const after = payload.workflow.filter((step): step is Extract<typeof step, { type: 'sort' }> => step.type === 'sort');
    // Without aggregation every source row is a mark, duplicates included, as in the other renderers.
    if (query.op === 'raw') return [...before, { type: 'view', query: [{ op: 'raw', fields: query.fields }] }, ...after];
    if (!aggregated && query.measures.length === 0) return [...before, { type: 'view', query: [{ op: 'raw', fields: query.groupBy }] }, ...after];
    const filtered = having && sameFields(query.groupBy, having.groupBy) ? having : undefined;
    // The aggregates the filters read are added under the filters' own names, next to the worksheet's.
    const measures: Measure[] = [...query.measures, ...(filtered?.measures.filter((m) => !query.measures.some((own) => own.asFieldKey === m.asFieldKey)) ?? [])];
    return [...before, { type: 'view', query: [{ op: 'aggregate', groupBy: query.groupBy, measures }] }, ...(filtered?.filters ?? []), ...after];
}
