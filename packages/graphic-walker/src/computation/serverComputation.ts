import type { IComputationFunction, IDataQueryPayload, IDataQueryWorkflowStep, IDatasetStats, IFieldStats, IResponse, IRow, IServerComputationOptions } from "../interfaces";


const defaultAPIPath = '/api/ce/dataset/v2/query';

const makeComputationService = (config: IServerComputationOptions): IComputationFunction => {
    if ('service' in config && typeof config.service === 'function') {
        return config.service;
    }
    const { server: _server, APIPath: _APIPath = defaultAPIPath } = config as Extract<IServerComputationOptions, { server: any }>;
    const server = _server.replace(/\/$/, '');
    const APIPath = `/${_APIPath.replace(/^\//, '')}`;
    return async function httpComputationService<R extends IRow[]>(data: IDataQueryPayload): Promise<R> {
        const res = await fetch(`${server}${APIPath}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (res.status === 200 || res.status === 500) {
            const result = await res.json() as IResponse<R>;
            if (result.success === false) {
                throw new Error(result.message);
            }
            return result.data;
        } else {
            throw new Error(`Service failed. ${res.status}: ${res.statusText}`);
        }
    };
};

export const datasetStatsServer = async (config: IServerComputationOptions, datasetId: string): Promise<IDatasetStats> => {
    const service = makeComputationService(config);
    const res = await service({
        datasetId,
        query: {
            workflow: [{
                type: 'view',
                query: [{
                    op: 'aggregate',
                    groupBy: [],
                    measures: [{
                        field: '*',
                        agg: 'count',
                        asFieldKey: 'count',
                    }],
                }],
            }],
        },
    }) as [{ count: number }];
    return {
        rowCount: res[0].count,
    };
};

export const dataReadRawServer = async (config: IServerComputationOptions, datasetId: string, pageSize: number, pageOffset = 0): Promise<IRow[]> => {
    const service = makeComputationService(config);
    const res = await service({
        datasetId,
        query: {
            workflow: [{
                type: 'view',
                query: [{
                    op: 'raw',
                    fields: ['*'],
                }],
            }],
            limit: pageSize,
            offset: pageOffset * pageSize,
        },
    });
    return res;
};

export const dataQueryServer = async (config: IServerComputationOptions, datasetId: string, workflow: IDataQueryWorkflowStep[]): Promise<IRow[]> => {
    if (workflow.length === 1 && workflow[0].type === 'view' && workflow[0].query.length === 1 && workflow[0].query[0].op === 'raw' && workflow[0].query[0].fields.length === 0) {
        return [];
    }
    const service = makeComputationService(config);
    const res = await service({
        datasetId,
        query: {
            workflow,
        },
    });
    return res;
};

export const fieldStatServer = async (config: IServerComputationOptions, datasetId: string, field: string, options: { values?: boolean; range?: boolean }): Promise<IFieldStats> => {
    const service = makeComputationService(config);
    const { values = true, range = true } = options;
    const COUNT_ID = `count_${field}`;
    const MIN_ID = `min_${field}`;
    const MAX_ID = `max_${field}`;
    const valuesQueryPayload: IDataQueryPayload = {
        datasetId,
        query: {
            workflow: [{
                type: 'view',
                query: [{
                    op: 'aggregate',
                    groupBy: [field],
                    measures: [{
                        field,
                        agg: 'count',
                        asFieldKey: COUNT_ID,
                    }],
                }],
            }],
        },
    };
    const valuesRes = values ? await service(valuesQueryPayload) : [];
    const rangeQueryPayload: IDataQueryPayload = {
        datasetId,
        query: {
            workflow: [{
                type: 'view',
                query: [{
                    op: 'aggregate',
                    groupBy: [],
                    measures: [{
                        field,
                        agg: 'min',
                        asFieldKey: MIN_ID,
                    }, {
                        field,
                        agg: 'max',
                        asFieldKey: MAX_ID,
                    }],
                }],
            }],
        },
    };
    const [rangeRes] = range ? await service(rangeQueryPayload) : [{
        [MIN_ID]: 0,
        [MAX_ID]: 0,
    }];

    return {
        values: valuesRes.sort((a, b) => b[COUNT_ID] - a[COUNT_ID]).map(row => ({
            value: row[field],
            count: row[COUNT_ID],
        })),
        range: [rangeRes[MIN_ID], rangeRes[MAX_ID]],
    };
};
