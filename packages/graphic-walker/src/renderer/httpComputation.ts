import type { IDataQueryPayload, IDataQueryWorkflowStep, IDatasetStats, IFieldStats, IResponse, IRow } from "../interfaces";


const defaultHost = 'https://kanaries.net';

const getRequest = async <P, R>(host: string | undefined, pathname: string, ...args: (P extends null | void ? [] : [data: P])): Promise<R> => {
    const urlencoded = new URLSearchParams();
    const data = args[0];
    if (data) {
        for (const key in data) {
            urlencoded.append(key, data[key] && typeof data[key] === 'object' ? JSON.stringify(data[key]) : `${data[key]}`);
        }
    }
    const res = await fetch(`${(host ?? defaultHost).replace(/\/$/, '')}/${pathname.replace(/^\//, '')}?${urlencoded.toString()}`, {
        method: 'GET',
        credentials: 'include',
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

const postRequest = async <P, R>(host: string | undefined, pathname: string, data: P): Promise<R> => {
    const res = await fetch(`${(host ?? defaultHost).replace(/\/$/, '')}/${pathname.replace(/^\//, '')}`, {
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

export const datasetStatsHttp = async (host: string | undefined, datasetId: string): Promise<IDatasetStats> => {
    const res = await postRequest<IServerDataQueryPayload, [{ count: number }]>(host, `/api/ce/dataset/v2/query`, {
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
    });
    return {
        rowCount: res[0].count,
    };
};

export const dataReadRawHttp = async (host: string | undefined, datasetId: string, pageSize: number, pageOffset = 0): Promise<IRow[]> => {
    const res = await postRequest<IServerDataQueryPayload, IRow[]>(host, `/api/ce/dataset/v2/query`, {
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

interface IServerDataQueryPayload {
    datasetId: string;
    query: IDataQueryPayload;
}

export const dataQueryHttp = async (host: string | undefined, datasetId: string, workflow: IDataQueryWorkflowStep[]): Promise<IRow[]> => {
    if (workflow.length === 1 && workflow[0].type === 'view' && workflow[0].query.length === 1 && workflow[0].query[0].op === 'raw' && workflow[0].query[0].fields.length === 0) {
        return [];
    }
    const res = await postRequest<IServerDataQueryPayload, IRow[]>(host, `/api/ce/dataset/v2/query`, {
        datasetId,
        query: {
            workflow,
        },
    });
    return res;
};

export const fieldStatHttp = async (host: string | undefined, datasetId: string, field: string, options: { values?: boolean; range?: boolean }): Promise<IFieldStats> => {
    const { values = true, range = true } = options;
    const COUNT_ID = `count_${field}`;
    const MIN_ID = `min_${field}`;
    const MAX_ID = `max_${field}`;
    const valuesQueryPayload: IServerDataQueryPayload = {
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
    const valuesRes = values ? await postRequest<IServerDataQueryPayload, IRow[]>(host, `/api/ce/dataset/v2/query`, valuesQueryPayload) : [];
    const rangeQueryPayload: IServerDataQueryPayload = {
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
    const [rangeRes] = range ? await postRequest<IServerDataQueryPayload, IRow[]>(host, `/api/ce/dataset/v2/query`, rangeQueryPayload) : [{
        [MIN_ID]: 0,
        [MAX_ID]: 0,
    }];

    return {
        values: valuesRes.sort((a, b) => b[COUNT_ID] - a[COUNT_ID]).slice(0, 20).map(row => ({
            value: row[field],
            count: row[COUNT_ID],
        })),
        range: [rangeRes[MIN_ID], rangeRes[MAX_ID]],
    };
};
