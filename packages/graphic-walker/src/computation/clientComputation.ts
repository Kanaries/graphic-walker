import type { IDataQueryPayload, IDataQueryWorkflowStep, IFilterFiledSimple, IMutField, IRow } from "../interfaces";
import { applyFilter, applySort, applyViewQuery, transformDataService } from "../services";

export const dataQueryClient = async (
    rawData: IRow[],
    columns: IMutField[],
    workflow: IDataQueryWorkflowStep[],
    offset?: number,
    limit?: number,
): Promise<IRow[]> => {
    let res = rawData;
    for await (const step of workflow) {
        switch (step.type) {
            case 'filter': {
                res = await applyFilter(res, step.filters.map(filter => {
                    const res: IFilterFiledSimple = {
                        fid: filter.fid,
                        rule: null,
                    };
                    if (filter.rule.type === 'one of') {
                        res.rule = {
                            type: 'one of',
                            value: new Set(filter.rule.value),
                        };
                    } else {
                        res.rule = filter.rule;
                    }
                    return res;
                }).filter(Boolean));
                break;
            }
            case 'transform': {
                res = await transformDataService(res, step.transform);
                break;
            }
            case 'view': {
                for await (const job of step.query) {
                    res = await applyViewQuery(res, columns, job);
                }
                break;
            }
            case 'sort': {
                res = await applySort(res, step.by, step.sort);
                break;
            }
            default: {
                // @ts-expect-error - runtime check
                console.warn(new Error(`Unknown step type: ${step.type}`));
                break;
            }
        }
    }
    return res.slice(offset ?? 0, limit ? ((offset ?? 0) + limit) : undefined);
};

export const getComputation = (rawData: IRow[], columns?: IMutField[] | undefined) => (payload: IDataQueryPayload) => {
    const workflow = payload.workflow.slice(0);
    let hasFolding = false;
    const workflowWithoutFolding = workflow.map<typeof workflow[number]>(w => {
        if (w.type === 'view') {
            const next = w.query.filter(q => q.op !== 'fold');
            if (next.length < w.query.length) {
                hasFolding = true;
            }
            return {
                type: 'view',
                query: next,
            };
        }
        return w;
    }).filter(w => w.type !== 'view' || w.query.length > 0);
    if (!columns && hasFolding) {
        // `columns` comes from a new prop which might be missing in the lower version of GraphicWalker,
        // and folding cannot work without a valid `columns` argument.
        console.warn('Folding is disabled because no valid `columns` prop is given.');
        return dataQueryClient(rawData, [], workflowWithoutFolding, payload.offset, payload.limit);
    }
    return dataQueryClient(rawData, columns ?? [], payload.workflow, payload.offset, payload.limit);
};
