import type {
    IComputationFunction,
    IDataQueryPayload,
    IDataQueryWorkflowStep,
    IDatasetStats,
    IField,
    IFieldStats,
    IFilterWorkflowStep,
    IRow,
    ISortWorkflowStep,
    ITransformWorkflowStep,
    IVisFilter,
} from '../interfaces';
import { getTimeFormat } from '../lib/inferMeta';

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
    if (
        workflow.length === 1 &&
        workflow[0].type === 'view' &&
        workflow[0].query.length === 1 &&
        workflow[0].query[0].op === 'raw' &&
        workflow[0].query[0].fields.length === 0
    ) {
        return [];
    }
    const res = await service({
        workflow,
        limit,
    });
    return res;
};

export const fieldStat = async (
    service: IComputationFunction,
    field: IField,
    options: {
        values?: boolean;
        range?: boolean;
        valuesMeta?: boolean;
        selectedCount?: Set<string | number>;
        valuesLimit?: number;
        valuesOffset?: number;
        sortBy?: 'value' | 'value_dsc' | 'count' | 'count_dsc' | 'none';
    }
): Promise<IFieldStats> => {
    const { values = true, range = true, valuesMeta = true, sortBy = 'none' } = options;
    const COUNT_ID = `count_${field.fid}`;
    const TOTAL_DISTINCT_ID = `total_distinct_${field.fid}`;
    const MIN_ID = `min_${field.fid}`;
    const MAX_ID = `max_${field.fid}`;
    const transformWork: ITransformWorkflowStep[] = field.computed
        ? [
              {
                  type: 'transform',
                  transform: [
                      {
                          expression: field.expression!,
                          key: field.fid,
                      },
                  ],
              },
          ]
        : [];
    const valuesMetaQueryPayload: IDataQueryPayload = {
        workflow: [
            ...transformWork,
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

    const selectedCountWork: IDataQueryPayload | null = options.selectedCount?.size
        ? {
              workflow: [
                  ...transformWork,
                  {
                      type: 'filter',
                      filters: [
                          {
                              fid: field.fid,
                              rule: {
                                  type: 'one of',
                                  value: [...options.selectedCount],
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

export async function getDistinctValues(service: IComputationFunction, field: string) {
    const COUNT_ID = `distinct_count_${field}`;
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
        ],
    };
    const valuesRes = await service(valuesQueryPayload);
    return valuesRes
        .sort((a, b) => b[COUNT_ID] - a[COUNT_ID])
        .map((row) => ({
            value: row[field] as string,
            count: row[COUNT_ID] as number,
        }));
}

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

export async function getTemporalRange(service: IComputationFunction, field: string) {
    const sample = await getSample(service, field);
    const format = getTimeFormat(sample);
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
                            },
                            {
                                field,
                                agg: 'max',
                                asFieldKey: MAX_ID,
                                format,
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
    return [new Date(rangeRes[MIN_ID]).getTime(), new Date(rangeRes[MAX_ID]).getTime(), format] as [number, number, string];
}
