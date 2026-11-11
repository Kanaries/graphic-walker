import { compileWorksheet, executePlan } from '../../../../worksheet-renderer/src/compiler';
import { resultTables, tableToCSV } from '../../../../worksheet-renderer/src/export';
import { buildModel } from '../../../../worksheet-renderer/src/model';
import type { Computation } from '../../../../worksheet-renderer/src/types';
import { filter } from '../../lib/filter';
import { sortBy } from '../../lib/sort';
import { transformData } from '../../lib/transform';
import { queryView } from '../../lib/viewQuery';
import type { IChart, IDataQueryPayload, IDataQueryWorkflowStep, IRow, IViewField } from '../../interfaces';
import { emptyEncodings, emptyVisualConfig, emptyVisualLayout } from '../../utils/save';
import { toWorkflow } from '../../utils/workflow';
import { chartToWorksheet } from './adapter';
import { composeWorkflow, splitWorkflow } from './having';

// Shared by the tests of this folder. Nothing here is loaded by the editor.

export const dim = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'nominal', analyticType: 'dimension' });
export const mea = (fid: string, aggName = 'sum'): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName });
/** A computed field as the editor stores it: an aggregate when its expression is one, otherwise a value per row. */
export const calc = (fid: string, name: string, sql: string, kind: 'aggregate' | 'row'): IViewField => ({
    fid, name, semanticType: 'quantitative', analyticType: 'measure', computed: true, aggName: kind === 'aggregate' ? 'expr' : 'sum',
    expression: { op: 'expr', as: fid, params: [{ type: 'sql', value: sql }] },
});
export function chart(encodings: Partial<IChart['encodings']>, config: Partial<IChart['config']> = {}, layout: Partial<IChart['layout']> = {}): IChart {
    return { visId: 'v', name: 'test', encodings: { ...emptyEncodings, ...encodings }, config: { ...emptyVisualConfig, ...config }, layout: { ...emptyVisualLayout, renderer: 'native', ...layout } };
}

/** The editor's local query, step by step, with the functions its workers run. */
export async function local(data: IRow[], workflow: IDataQueryWorkflowStep[], limit?: number): Promise<IRow[]> {
    let rows = data;
    for (const step of workflow) {
        if (step.type === 'filter') rows = filter(rows, step.filters);
        else if (step.type === 'transform') rows = rows.length ? await transformData(rows, step.transform) : rows;
        else if (step.type === 'view') for (const query of step.query) rows = queryView(rows, query);
        else if (step.type === 'sort') rows = sortBy(rows, step.by, step.sort);
    }
    return limit ? rows.slice(0, limit) : rows;
}

/**
 * What the native renderer does with a chart, up to the model it draws and the table it exports.
 * `host` stands for the computation a host gives the editor; every query is recorded as it is sent.
 */
export async function drawn(c: IChart, data: IRow[], host: (payload: IDataQueryPayload) => Promise<IRow[]> = (payload) => local(data, payload.workflow, payload.limit)) {
    const adapted = chartToWorksheet(c);
    if (!adapted.spec) throw new Error(adapted.error);
    const plan = compileWorksheet(adapted.spec);
    const fields = [...c.encodings.dimensions, ...c.encodings.measures];
    const around = splitWorkflow(toWorkflow(c.encodings.filters, fields, adapted.viewDimensions, adapted.viewMeasures, c.config.defaultAggregated, 'none', c.config.folds));
    const sent: IDataQueryPayload[] = [];
    const run: Computation = async (payload) => {
        const query = { workflow: composeWorkflow(around, c.config.defaultAggregated, payload), limit: payload.limit };
        sent.push(query);
        return host(query);
    };
    const results = await executePlan(plan, run);
    const model = buildModel(plan, results);
    return { plan, around, having: around.having, sent, model, marks: model.panes.flatMap((pane) => pane.records), csv: resultTables(plan, results).map(tableToCSV) };
}
