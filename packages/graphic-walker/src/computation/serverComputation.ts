import type {
    IComputationFunction,
    IDataQueryPayload,
    IDataQueryWorkflowStep,
    IDatasetStats,
    IFieldStats,
    IRow,
    IFieldReadStats,
    FilterSortConfig
} from '../interfaces';

export const datasetStatsServer = async (service: IComputationFunction): Promise<IDatasetStats> => {
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

export const dataReadRawServer = async (
    service: IComputationFunction,
    pageSize: number,
    pageOffset = 0
): Promise<IRow[]> => {
    const res = await service({
        workflow: [
            {
                type: 'view',
                query: [
                    {
                        op: 'raw',
                        fields: ['*'],
                    },
                ],            },
        ],
        limit: pageSize,
        offset: pageOffset * pageSize,
    });
    return res;
};

export const dataQueryServer = async (
    service: IComputationFunction,
    workflow: IDataQueryWorkflowStep[],
    limit?: number,
): Promise<IRow[]> => {
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

export const fieldStatServer = async (
    service: IComputationFunction,
    field: string,
    options: { values?: boolean; range?: boolean },
): Promise<IFieldStats> => {
    const { values = true, range = true } = options;
    const COUNT_ID = `count_${field}`;
    const MIN_ID = `min_${field}`;
    const MAX_ID = `max_${field}`;
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
                                field,
                                agg: 'count',
                                asFieldKey: COUNT_ID,
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const valuesRes = values ? await service(valuesQueryPayload) : [];
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
    ] = range
        ? await service(rangeQueryPayload)
        : [
              {
                  [MIN_ID]: 0,
                  [MAX_ID]: 0,
              },
          ];

    return {
        values: valuesRes
            .sort((a, b) => b[COUNT_ID] - a[COUNT_ID])
            .map((row) => ({
                value: row[field],
                count: row[COUNT_ID],
            })),
        range: [rangeRes[MIN_ID], rangeRes[MAX_ID]],
    };
};

export const fieldTotalServer = async (
    service: IComputationFunction,
    field: string,
  ): Promise<{total:number,sum:number}> => {
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
                                field,
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
    const countSum = valuesRes.reduce((pre,cur) => {return pre = pre + cur[COUNT_ID]},0);
    console.log(countSum)
    return {total:valuesRes.length,sum:countSum};
    
  };

  export const fieldReadRawServer = async(
    service: IComputationFunction,
    field: string,
    sort: FilterSortConfig,
    pageSize: number,
    pageOffset = 0
  ): Promise<IFieldReadStats> => {
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
                                field,
                                agg: 'count',
                                asFieldKey: COUNT_ID,
                            },
                        ],
                    },
                ],
            },
            {
                type: 'sort',
                by: sort.key == 'label'? [field] : [COUNT_ID],
                sort:sort.order,
            }
        ],
        limit: pageSize,
        offset: pageOffset * pageSize,
    };
    const valuesRes = await service(valuesQueryPayload);
  console.log('valueres',valuesRes)
    const res =  valuesRes.map((row) => ({
                value: row[field],
                count: row[COUNT_ID],
            }))
    console.log(res)
    return res;
  }

// range类型： 利用服务端workflow获取range
export const fieldRangeStatsServer = async (
    service: IComputationFunction,
    field: string,
  ): Promise<[number,number]> => {
    const MIN_ID = `min_${field}`;
    const MAX_ID = `max_${field}`;
    const rangeQueryPayload: IDataQueryPayload = {
      workflow: [
        {
          type: "view",
          query: [
            {
              op: "aggregate",
              groupBy: [],
              measures: [
                {
                  field,
                  agg: "min",
                  asFieldKey: MIN_ID,
                },
                {
                  field,
                  agg: "max",
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
    return [rangeRes[MIN_ID], rangeRes[MAX_ID]];
  };

