import { DEFAULT_DATASET } from '@/constants';
import type { IDataQueryPayload, IDataQueryWorkflowStep, IFilterFiledSimple, IRow, IBasicDataQueryWorkflowStep, IJoinWorkflowStep } from '../interfaces';
import { applyFilter, applySort, applyViewQuery, joinDataService, transformDataService } from '../services';

export const dataQueryClient = async (
    rawDatas: Record<string, IRow[]>,
    workflow: IDataQueryWorkflowStep[],
    datasets: string[],
    offset?: number,
    limit?: number
): Promise<IRow[]> => {
    const steps = workflow.filter((step): step is IBasicDataQueryWorkflowStep => step.type !== 'join');
    const joins = workflow.find((step): step is IJoinWorkflowStep => step.type === 'join');
    let res: IRow[];
    if (joins) {
        res = await joinDataService(rawDatas, joins.foreigns);
    } else {
        res = datasets.flatMap((dataset) => rawDatas[dataset]);
    }
    for await (const step of steps) {
        switch (step.type) {
            case 'filter': {
                res = await applyFilter(
                    res,
                    step.filters
                        .map((filter) => {
                            const res: IFilterFiledSimple = {
                                fid: filter.fid,
                                rule: filter.rule,
                            };
                            return res;
                        })
                        .filter(Boolean)
                );
                break;
            }
            case 'transform': {
                res = await transformDataService(res, step.transform);
                break;
            }
            case 'view': {
                for await (const job of step.query) {
                    res = await applyViewQuery(res, job);
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
    if (process.env.NODE_ENV !== 'production') {
        console.log('local query triggered', workflow, datasets, res);
    }

    return res.slice(offset ?? 0, limit ? (offset ?? 0) + limit : undefined);
};

export const getComputation = (rawDatas: Record<string, IRow[]> | IRow[]) => {
    if (rawDatas instanceof Array) {
        return (payload: IDataQueryPayload) =>
            dataQueryClient({ [DEFAULT_DATASET]: rawDatas }, payload.workflow, [DEFAULT_DATASET], payload.offset, payload.limit);
    }
    return (payload: IDataQueryPayload) => dataQueryClient(rawDatas, payload.workflow, payload.datasets, payload.offset, payload.limit);
};
