import { IRow, IMutField, Specification, IFilterFiledSimple, IExpression, IViewQuery, IViewField } from './interfaces';
import { INestNode } from './components/pivotTable/inteface';
/* eslint import/no-webpack-loader-syntax:0 */
// @ts-ignore
// eslint-disable-next-line
// import InsightSpaceWorker from './workers/InsightService.worker?worker';
/* eslint import/no-webpack-loader-syntax:0 */
// @ts-ignore
// eslint-disable-next-line
// import ExplainerWorker from './workers/explainer.worker?worker&inline';
import FilterWorker from './workers/filter.worker?worker&inline';
import TransformDataWorker from './workers/transform.worker?worker&inline';
import ViewQueryWorker from './workers/viewQuery.worker?worker&inline';
import BuildMetricTableWorker from './workers/buildMetricTable.worker?worker&inline';
import SortWorker from './workers/sort.worker?worker&inline';

function workerService<T, R>(worker: Worker, data: R): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        worker.postMessage(data);
        worker.onmessage = (e: MessageEvent) => {
            if (typeof e.data === 'string') {
                reject({
                    success: false,
                    message: e.data,
                });
            }
            resolve(e.data);
        };
        worker.onerror = (e: ErrorEvent) => {
            reject({
                success: false,
                message: e,
            });
        };
    });
}

// interface ExplainParams {
//     dimensions: string[];
//     measures: string[];
//     dataSource: IRow[];
//     filters?: Filters;
//     currentSpace: {
//         dimensions: string[];
//         measures: IMeasure[];
//     };
// }
export interface IVisSpace {
    dataView: IRow[];
    schema: Specification;
}
// interface ExplainReturns {
//     explainations: IExplaination[];
//     valueExp: IMeasureWithStat[];
//     visSpaces: IVisSpace[];
//     fieldsWithSemanticType: Array<{ key: string; type: SemanticType }>;
// }
// export async function getExplaination(props: ExplainParams) {
//     const worker = workerState.eWorker;
//     if (worker === null) throw new Error('init worker first.')
//     let result: ExplainReturns = {
//         explainations: [],
//         valueExp: [],
//         visSpaces: [],
//         fieldsWithSemanticType: [],
//     };
//     try {
//         result = await workerService<ExplainReturns, { type: string; data: ExplainParams }>(
//             worker,
//             {
//                 type: 'getExplaination',
//                 data: props
//             }
//         );
//         return result;
//     } catch (error) {
//         console.error(error);
//     }
//     return result;
// }

interface PreAnalysisParams {
    fields: IMutField[];
    dataSource: IRow[];
}
// export async function preAnalysis(props: PreAnalysisParams) {
//     if (workerState.eWorker !== null) {
//         workerState.eWorker.terminate();
//     }
//     try {
//         workerState.eWorker = new ExplainerWorker() as Worker;
//         const tmp = await workerService<boolean, { type: string; data: PreAnalysisParams}>(workerState.eWorker, { type: 'preAnalysis', data: props });
//     } catch (error) {
//         console.error(error)
//     }
// }

// export function destroyWorker() {
//     if (workerState.eWorker) {
//         workerState.eWorker.terminate();
//         workerState.eWorker = null;
//     }
// }

export const applyFilter = async (data: IRow[], filters: readonly IFilterFiledSimple[]): Promise<IRow[]> => {
    if (filters.length === 0) return data;
    const worker = new FilterWorker();
    try {
        const res: IRow[] = await workerService(worker, {
            dataSource: data,
            filters: filters,
        });

        return res;
    } catch (error: any) {
        throw new Error(error.message);
    } finally {
        worker.terminate();
    }
};

export const transformDataService = async (data: IRow[], trans: { key: string; expression: IExpression }[]): Promise<IRow[]> => {
    if (data.length === 0) return data;
    const worker = new TransformDataWorker();
    try {
        const res: IRow[] = await workerService(worker, {
            dataSource: data,
            trans,
        });
        return res;
    } catch (error: any) {
        throw new Error(error.message);
    } finally {
        worker.terminate();
    }
};

export const applyViewQuery = async (data: IRow[], query: IViewQuery): Promise<IRow[]> => {
    const worker = new ViewQueryWorker();
    try {
        const res: IRow[] = await workerService(worker, {
            dataSource: data,
            query: query,
        });
        return res;
    } catch (err: any) {
        throw new Error(err.message);
    } finally {
        worker.terminate();
    }
};

export const buildPivotTableService = async (
    dimsInRow: IViewField[],
    dimsInColumn: IViewField[],
    allData: IRow[],
    aggData: IRow[],
    collapsedKeyList: string[],
    showTableSummary: boolean,
    sort?: {
        fid: string;
        type: 'ascending' | 'descending';
        mode: 'row' | 'column';
    }
): Promise<{ lt: INestNode; tt: INestNode; metric: (IRow | null)[][] }> => {
    const worker = new BuildMetricTableWorker();
    try {
        const res: { lt: INestNode; tt: INestNode; metric: (IRow | null)[][] } = await workerService(worker, {
            dimsInRow,
            dimsInColumn,
            allData,
            aggData,
            collapsedKeyList,
            showTableSummary,
            sort,
        });
        return res;
    } catch (error) {
        throw new Error('Uncaught error in TableBuilderDataWorker', { cause: error });
    } finally {
        worker.terminate();
    }
};

export const applySort = async (data: IRow[], viewMeasures: string[], sort: 'ascending' | 'descending'): Promise<IRow[]> => {
    const worker = new SortWorker();
    try {
        const res: IRow[] = await workerService(worker, {
            data,
            viewMeasures,
            sort,
        });
        return res;
    } catch (err) {
        throw new Error('Uncaught error in ViewQueryWorker', { cause: err });
    } finally {
        worker.terminate();
    }
};
