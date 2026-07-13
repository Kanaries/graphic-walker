import type {
    IComputationFunction,
    IDataQueryPayload,
    IDataQueryWorkflowStep,
    IDatasetStats,
    IField,
    IFieldStats,
    IFilterWorkflowStep,
    IKeyWord,
    IMutField,
    IRow,
    ISortWorkflowStep,
    ITransformWorkflowStep,
    IViewWorkflowStep,
    IVisFilter,
} from '../interfaces';
import { getTimeFormat } from '../lib/inferMeta';
import { newOffsetDate } from '../lib/op/offset';
import { processExpression } from '../utils/workflow';
import { binarySearchClosest, isNotEmpty, parseKeyword } from '../utils';
import { COUNT_FIELD_ID } from '../constants';
import { range } from 'lodash-es';

export const datasetStats = async (service: IComputationFunction): Promise<IDatasetStats> => {
    const res = (await service({
        workflow: [
            {
                type: 'view',
                query: [
                    {
                        op: 'aggregate',
                        groupBy: [],
                        measures: [
                            {
                                field: '*',
                                agg: 'count',
                                asFieldKey: 'count',
                            },
                        ],
                    },
                ],
            },
        ],
    })) as [{ count: number }];
    return {
        rowCount: res[0]?.count ?? 0,
    };
};

export const dataReadRaw = async (
    service: IComputationFunction,
    pageSize: number,
    pageOffset = 0,
    option?: {
        sorting?: { fid: string; sort: 'ascending' | 'descending' };
        filters?: IVisFilter[];
    }
): Promise<IRow[]> => {
    const res = await service({
        workflow: [
            ...(option?.filters && option.filters.length > 0
                ? [
                      {
                          type: 'filter',
                          filters: option.filters,
                      } as IFilterWorkflowStep,
                  ]
                : []),
            {
                type: 'view',
                query: [
                    {
                        op: 'raw',
                        fields: ['*'],
                    },
                ],
            },
            ...(option?.sorting
                ? [
                      {
                          type: 'sort',
                          by: [option.sorting.fid],
                          sort: option.sorting.sort,
                      } as ISortWorkflowStep,
                  ]
                : []),
        ],
        limit: pageSize,
        offset: pageOffset * pageSize,
    });
    return res;
};

export const dataQuery = async (service: IComputationFunction, workflow: IDataQueryWorkflowStep[], limit?: number): Promise<IRow[]> => {
    const viewWorkflow = workflow.find((x) => x.type === 'view') as IViewWorkflowStep | undefined;
    if (viewWorkflow && viewWorkflow.query.length === 1 && viewWorkflow.query[0].op === 'raw' && viewWorkflow.query[0].fields.length === 0) {
        return [];
    }
    const res = await service({
        workflow,
        limit,
    });
    return res;
};

// TODO: refactor this function
export const fieldStat = async (
    service: IComputationFunction,
    field: IField,
    options: {
        values?: boolean;
        range?: boolean;
        valuesMeta?: boolean;
        selectedCount?: any[];
        valuesLimit?: number;
        valuesOffset?: number;
        sortBy?: 'value' | 'value_dsc' | 'count' | 'count_dsc' | 'none';
        timezoneDisplayOffset?: number;
        keyword?: IKeyWord;
    },
    allFields: IMutField[]
): Promise<IFieldStats> => {
    const { values = true, range = true, valuesMeta = true, sortBy = 'none', timezoneDisplayOffset, keyword } = options;
    const COUNT_ID = `count_${field.fid}`;
    const TOTAL_DISTINCT_ID = `total_distinct_${field.fid}`;
    const MIN_ID = `min_${field.fid}`;
    const MAX_ID = `max_${field.fid}`;
    const k = isNotEmpty(keyword) ? parseKeyword(keyword) : undefined;
    const filterWork: IFilterWorkflowStep[] = k
        ? [
              {
                  type: 'filter',
                  filters: [{ fid: field.fid, rule: { type: 'regexp', value: k.source, caseSensitive: !k.ignoreCase } }],
              },
          ]
        : [];
    const transformWork: ITransformWorkflowStep[] = field.computed
        ? [
              {
                  type: 'transform',
                  transform: [
                      {
                          expression: processExpression(field.expression!, allFields, { timezoneDisplayOffset }),
                          key: field.fid,
                      },
                  ],
              },
          ]
        : [];
    const valuesMetaQueryPayload: IDataQueryPayload = {
        workflow: [
            ...transformWork,
            ...filterWork,
            {
                type: 'view',
                query: [
                    {
                        op: 'aggregate',
                        groupBy: [field.fid],
                        measures: [
                            {
                                field: '*',
                                agg: 'count',
                                asFieldKey: COUNT_ID,
                            },
                        ],
                    },
                ],
            },
            {
                type: 'view',
                query: [
                    {
                        op: 'aggregate',
                        groupBy: [],
                        measures: [
                            {
                                field: '*',
                                agg: 'count',
                                asFieldKey: TOTAL_DISTINCT_ID,
                            },
                            {
                                field: COUNT_ID,
                                agg: 'sum',
                                asFieldKey: 'count',
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const valuesQueryPayload: IDataQueryPayload = {
        workflow: [
            ...transformWork,
            ...filterWork,
            {
                type: 'view',
                query: [
                    {
                        op: 'aggregate',
                        groupBy: [field.fid],
                        measures: [
                            {
                                field: '*',
                                agg: 'count',
                                asFieldKey: COUNT_ID,
                            },
                        ],
                    },
                ],
            },
            ...(sortBy === 'none'
                ? []
                : ([
                      {
                          type: 'sort',
                          by: [sortBy.startsWith('value') ? field.fid : COUNT_ID],
                          sort: sortBy.endsWith('dsc') ? 'descending' : 'ascending',
                      },
                  ] as ISortWorkflowStep[])),
        ],
        limit: options.valuesLimit,
        offset: options.valuesOffset,
    };
    const [valuesMetaRes = { [TOTAL_DISTINCT_ID]: 0, count: 0 }] = valuesMeta ? await service(valuesMetaQueryPayload) : [{ [TOTAL_DISTINCT_ID]: 0, count: 0 }];
    const valuesRes = values ? await service(valuesQueryPayload) : [];
    const rangeQueryPayload: IDataQueryPayload = {
        workflow: [
            ...transformWork,
            ...filterWork,
            {
                type: 'view',
                query: [
                    {
                        op: 'aggregate',
                        groupBy: [],
                        measures: [
                            {
                                field: field.fid,
                                agg: 'min',
                                asFieldKey: MIN_ID,
                            },
                            {
                                field: field.fid,
                                agg: 'max',
                                asFieldKey: MAX_ID,
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const [
        rangeRes = {
            [MIN_ID]: 0,
            [MAX_ID]: 0,
        },
    ] = range
        ? await service(rangeQueryPayload)
        : [
              {
                  [MIN_ID]: 0,
                  [MAX_ID]: 0,
              },
          ];

    const selectedCountWork: IDataQueryPayload | null = options.selectedCount?.length
        ? {
              workflow: [
                  ...transformWork,
                  ...filterWork,
                  {
                      type: 'filter',
                      filters: [
                          {
                              fid: field.fid,
                              rule: {
                                  type: 'one of',
                                  value: options.selectedCount,
                              },
                          },
                      ],
                  },
                  {
                      type: 'view',
                      query: [
                          {
                              op: 'aggregate',
                              groupBy: [],
                              measures: [
                                  {
                                      field: '*',
                                      agg: 'count',
                                      asFieldKey: 'count',
                                  },
                              ],
                          },
                      ],
                  },
              ],
          }
        : null;
    const [selectedCountRes = { count: 0 }] = selectedCountWork ? await service(selectedCountWork) : [];

    return {
        values: valuesRes.map((row) => ({
            value: row[field.fid],
            count: row[COUNT_ID],
        })),
        valuesMeta: {
            total: valuesMetaRes.count,
            distinctTotal: valuesMetaRes[TOTAL_DISTINCT_ID],
        },
        range: [rangeRes[MIN_ID], rangeRes[MAX_ID]],
        selectedCount: selectedCountRes.count,
    };
};

export async function getRange(service: IComputationFunction, field: string) {
    const MIN_ID = `min_${field}`;
    const MAX_ID = `max_${field}`;
    const rangeQueryPayload: IDataQueryPayload = {
        workflow: [
            {
                type: 'view',
                query: [
                    {
                        op: 'aggregate',
                        groupBy: [],
                        measures: [
                            {
                                field,
                                agg: 'min',
                                asFieldKey: MIN_ID,
                            },
                            {
                                field,
                                agg: 'max',
                                asFieldKey: MAX_ID,
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const [
        rangeRes = {
            [MIN_ID]: 0,
            [MAX_ID]: 0,
        },
    ] = await service(rangeQueryPayload);
    return [rangeRes[MIN_ID], rangeRes[MAX_ID]] as [number, number];
}

export function withComputedField(field: IField, allFields: IMutField[], service: IComputationFunction, config: { timezoneDisplayOffset?: number }) {
    return <T>(builder: (service: IComputationFunction) => Promise<T>) => {
        const transformWork: ITransformWorkflowStep[] = field.computed
            ? [
                  {
                      type: 'transform',
                      transform: [
                          {
                              expression: processExpression(field.expression!, allFields, config),
                              key: field.fid,
                          },
                      ],
                  },
              ]
            : [];
        return builder((queryPayload) => {
            const transformedQueryPayload: IDataQueryPayload = {
                ...queryPayload,
                workflow: [...transformWork, ...queryPayload.workflow],
            };
            return service(transformedQueryPayload);
        });
    };
}

export async function getSample(service: IComputationFunction, field: string) {
    const res = await service({
        workflow: [
            {
                type: 'view',
                query: [
                    {
                        op: 'raw',
                        fields: [field],
                    },
                ],
            },
        ],
        limit: 1,
        offset: 0,
    });
    return res?.[0]?.[field];
}

export async function getTemporalRange(service: IComputationFunction, field: string, offset?: number) {
    const sample = await getSample(service, field);
    const format = getTimeFormat(sample);
    const usedOffset = offset ?? new Date().getTimezoneOffset();
    const newDate = newOffsetDate(usedOffset);
    const MIN_ID = `min_${field}`;
    const MAX_ID = `max_${field}`;
    const rangeQueryPayload: IDataQueryPayload = {
        workflow: [
            {
                type: 'view',
                query: [
                    {
                        op: 'aggregate',
                        groupBy: [],
                        measures: [
                            {
                                field,
                                agg: 'min',
                                asFieldKey: MIN_ID,
                                format,
                                offset: usedOffset,
                            },
                            {
                                field,
                                agg: 'max',
                                asFieldKey: MAX_ID,
                                format,
                                offset: usedOffset,
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const [
        rangeRes = {
            [MIN_ID]: 0,
            [MAX_ID]: 0,
        },
    ] = await service(rangeQueryPayload);
    return [newDate(rangeRes[MIN_ID]).getTime(), newDate(rangeRes[MAX_ID]).getTime(), format] as [number, number, string];
}

export async function getFieldDistinctMeta(service: IComputationFunction, field: string) {
    const COUNT_ID = `count_${field}`;
    const TOTAL_DISTINCT_ID = `total_distinct_${field}`;
    const workflow: IDataQueryWorkflowStep[] = [
        {
            type: 'view',
            query: [
                {
                    op: 'aggregate',
                    groupBy: [field],
                    measures: [
                        {
                            field: '*',
                            agg: 'count',
                            asFieldKey: COUNT_ID,
                        },
                    ],
                },
            ],
        },
        {
            type: 'view',
            query: [
                {
                    op: 'aggregate',
                    groupBy: [],
                    measures: [
                        {
                            field: '*',
                            agg: 'count',
                            asFieldKey: TOTAL_DISTINCT_ID,
                        },
                        {
                            field: COUNT_ID,
                            agg: 'sum',
                            asFieldKey: 'count',
                        },
                    ],
                },
            ],
        },
    ];
    const [valuesMetaRes = { [TOTAL_DISTINCT_ID]: 0, count: 0 }] = await service({ workflow });
    return {
        total: valuesMetaRes.count as number,
        distinctTotal: valuesMetaRes[TOTAL_DISTINCT_ID] as number,
    };
}

export async function getFieldDistinctCounts(
    service: IComputationFunction,
    field: string,
    options: {
        sortBy?: 'value' | 'count' | 'value_dsc' | 'count_dsc' | 'none';
        valuesLimit?: number;
        valuesOffset?: number;
    } = {}
) {
    const { sortBy = 'none', valuesLimit, valuesOffset } = options;
    const COUNT_ID = `count_${field}`;
    const valuesQueryPayload: IDataQueryPayload = {
        workflow: [
            {
                type: 'view',
                query: [
                    {
                        op: 'aggregate',
                        groupBy: [field],
                        measures: [
                            {
                                field: '*',
                                agg: 'count',
                                asFieldKey: COUNT_ID,
                            },
                        ],
                    },
                ],
            },
            ...(sortBy === 'none'
                ? []
                : ([
                      {
                          type: 'sort',
                          by: [sortBy.startsWith('value') ? field : COUNT_ID],
                          sort: sortBy.endsWith('dsc') ? 'descending' : 'ascending',
                      },
                  ] as ISortWorkflowStep[])),
        ],
        limit: valuesLimit,
        offset: valuesOffset,
    };
    const valuesRes = await service(valuesQueryPayload);
    return valuesRes.map((row) => ({
        value: row[field] as string,
        count: row[COUNT_ID] as number,
    }));
}

export async function profileNonmialField(service: IComputationFunction, field: string) {
    const TOPS_NUM = 2;
    const meta = getFieldDistinctMeta(service, field);
    const tops = getFieldDistinctCounts(service, field, { sortBy: 'count_dsc', valuesLimit: TOPS_NUM });
    return Promise.all([meta, tops] as const);
}

type DataTableProfilingMode = 'nominal' | 'quantitative';

interface DataTableProfilingCacheOptions {
    cacheScope?: object;
    scopeKey?: string;
}

const DATA_TABLE_PROFILING_SCOPE_KEY = 'default';
const DATA_TABLE_PROFILING_CACHE_LIMIT = 500;
const DATA_TABLE_PROFILING_CONCURRENCY = 4;
const dataTableProfilingCache = new WeakMap<object, Map<string, Promise<unknown>>>();
const dataTableProfilingQueue: Array<() => void> = [];
let dataTableProfilingActiveCount = 0;

function getDataTableProfilingKey(mode: DataTableProfilingMode, field: string, scopeKey = DATA_TABLE_PROFILING_SCOPE_KEY) {
    return JSON.stringify([scopeKey, mode, field]);
}

function profileDataTableFieldWithCache<T>(cacheScope: object, cacheKey: string, getValue: () => Promise<T>): Promise<T> {
    let scopeCache = dataTableProfilingCache.get(cacheScope);
    if (!scopeCache) {
        scopeCache = new Map();
        dataTableProfilingCache.set(cacheScope, scopeCache);
    }
    const cached = scopeCache.get(cacheKey) as Promise<T> | undefined;
    if (cached) {
        scopeCache.delete(cacheKey);
        scopeCache.set(cacheKey, cached);
        return cached;
    }
    const pending = getValue().catch((error) => {
        scopeCache?.delete(cacheKey);
        throw error;
    });
    scopeCache.set(cacheKey, pending);
    if (scopeCache.size > DATA_TABLE_PROFILING_CACHE_LIMIT) {
        const oldestKey = scopeCache.keys().next().value;
        if (oldestKey) {
            scopeCache.delete(oldestKey);
        }
    }
    return pending;
}

export function profileNonmialFieldWithCache(service: IComputationFunction, field: string, options: DataTableProfilingCacheOptions = {}) {
    const cacheScope = options.cacheScope ?? service;
    const cacheKey = getDataTableProfilingKey('nominal', field, options.scopeKey);
    return profileDataTableFieldWithCache(cacheScope, cacheKey, () => profileNonmialField(wrapComputationWithDataTableProfilingQueue(wrapComputationWithTag(service, 'profiling')), field));
}

export async function profileQuantitativeField(service: IComputationFunction, field: string) {
    const BIN_FIELD = `bin_${field}`;
    const ROW_NUM_FIELD = `${COUNT_FIELD_ID}_sum`;
    const BIN_SIZE = 10;

    const workflow: IDataQueryWorkflowStep[] = [
        {
            type: 'transform',
            transform: [
                {
                    key: BIN_FIELD,
                    expression: {
                        op: 'bin',
                        as: BIN_FIELD,
                        params: [
                            {
                                type: 'field',
                                value: field,
                            },
                        ],
                        num: BIN_SIZE,
                    },
                },
                {
                    key: COUNT_FIELD_ID,
                    expression: {
                        op: 'one',
                        params: [],
                        as: COUNT_FIELD_ID,
                    },
                },
            ],
        },
        {
            type: 'view',
            query: [
                {
                    op: 'aggregate',
                    groupBy: [BIN_FIELD],
                    measures: [
                        {
                            field: COUNT_FIELD_ID,
                            agg: 'sum',
                            asFieldKey: ROW_NUM_FIELD,
                        },
                    ],
                },
            ],
        },
    ];

    const valuesRes = service({ workflow });
    const values = (await valuesRes).sort((x, y) => x[BIN_FIELD][0] - y[BIN_FIELD][0]);
    if (values.length === 0) {
        return {
            max: 0,
            min: 0,
            binValues: [],
        };
    }
    const min = values[0][BIN_FIELD][0];
    const max = values[values.length - 1][BIN_FIELD][1];
    const step = (max - min) / BIN_SIZE;
    const binValues = range(0, BIN_SIZE)
        .map((x) => x * step + min)
        .map((bin) => {
            const row = binarySearchClosest(values, bin, (row) => row[BIN_FIELD][0]);
            const binValue = row[BIN_FIELD][0] as number;
            if (Math.abs(binValue - bin) * 2 < step) {
                // accepted nearest (to ignore float presision)
                const count = row[ROW_NUM_FIELD] as number;
                return {
                    from: bin,
                    to: bin + step,
                    count,
                };
            } else {
                // not found
                return {
                    from: bin,
                    to: bin + step,
                    count: 0,
                };
            }
        });
    return {
        min,
        max,
        binValues,
    };
}

export function profileQuantitativeFieldWithCache(service: IComputationFunction, field: string, options: DataTableProfilingCacheOptions = {}) {
    const cacheScope = options.cacheScope ?? service;
    const cacheKey = getDataTableProfilingKey('quantitative', field, options.scopeKey);
    return profileDataTableFieldWithCache(cacheScope, cacheKey, () => profileQuantitativeField(wrapComputationWithDataTableProfilingQueue(wrapComputationWithTag(service, 'profiling')), field));
}

function scheduleDataTableProfiling<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const run = () => {
            dataTableProfilingActiveCount++;
            Promise.resolve()
                .then(task)
                .then(resolve, reject)
                .finally(() => {
                    dataTableProfilingActiveCount--;
                    dataTableProfilingQueue.shift()?.();
                });
        };
        if (dataTableProfilingActiveCount < DATA_TABLE_PROFILING_CONCURRENCY) {
            run();
        } else {
            dataTableProfilingQueue.push(run);
        }
    });
}

function wrapComputationWithDataTableProfilingQueue(service: IComputationFunction): IComputationFunction {
    return (payload) => scheduleDataTableProfiling(() => service(payload));
}

export function wrapComputationWithTag(service: IComputationFunction, tag: string) {
    return (payload: IDataQueryPayload) => {
        return service({
            ...payload,
            tag,
        });
    };
}
