# GraphicWalker View Data Computation

Before the renderer generates the visualization, GraphicWalker  applies an asynchronous workflow to compute the data to the view data which is directly used by the renderer. The computation workflow consists of a series of data queries, that describe how to compute the view data from the raw data. The computation workflow is not only used in the rendering phase, but also used in cases such as preview table, and filter editor when GraphicWalker requires the necessary statistics from the raw data.

## Computation Workflow

The computation workflow contains 4 types of queries: filter query, transform query, view query, and sort query.

### Filter Query (optional)

The filter query is used to filter the raw data. It contains a list of filter fields, each of which contains a filter rule.

``` ts
type IFilterRule = (
    | {
        type: 'range';
        value: readonly [number, number];
    }
    | {
        type: 'temporal range';
        value: readonly [number, number];
    }
    | {
        type: 'one of';
        value: Array<string | number>;
    }
);

interface IFilterField {
    fid: string;
    rule: IFilterRule;
}

interface IFilterQuery {
    type: 'filter';
    filters: Array<IFilterField>;
}
```

The schema of the filter query is

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "filter"
            ]
        },
        "filters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "fid": {
                        "type": "string"
                    },
                    "rule": {
                        "type": "object",
                        "oneOf": [
                            {
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "range",
                                            "temporal range"
                                        ]
                                    },
                                    "value": {
                                        "type": "array",
                                        "items": {
                                            "type": "number"
                                        },
                                        "minItems": 2,
                                        "maxItems": 2
                                    }
                                },
                                "required": [
                                    "type",
                                    "value"
                                ]
                            },
                            {
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "one of"
                                        ]
                                    },
                                    "value": {
                                        "type": "array",
                                        "items": {
                                            "oneOf": [
                                                {
                                                    "type": "string"
                                                },
                                                {
                                                    "type": "number"
                                                }
                                            ]
                                        }
                                    }
                                },
                                "required": [
                                    "type",
                                    "value"
                                ]
                            }
                        ]
                    }
                },
                "required": [
                    "fid",
                    "rule"
                ]
            }
        }
    },
    "required": [
        "type",
        "filters"
    ]
}
```

### Transform Query (optional)

The transform query is used to resolve the field calculations. It contains a list of transform fields, each of which contains an expression.

```ts
type IExpParameter = (
    | {
        type: 'field';
        value: string;
    }
    | {
        type: 'value';
        value: any;  //
    }
    | {
        type: 'expression';
        value: IExpression;
    }
    | {
        type: 'constant';
        value: any;
    }
);

interface IExpression {
    op: 'bin' | 'one' | 'binCount'|'log';
    params: IExpParameter[]; 
    as: string;
    num?:number;
}

interface ITransformField {
    key: string;
    expression: IExpression;
}

interface ITransformQuery {
    type: 'transform';
    transform: Array<ITransformField>;
}
```

The schema of the transform query is

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "transform"
            ]
        },
        "transform": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string"
                    },
                    "expression": {
                        "type": "object",
                        "properties": {
                            "op": {
                                "type": "string",
                                "enum": [
                                    "bin",
                                    "log2",
                                    "log10",
                                    "one",
                                    "binCount"
                                ]
                            },
                            "params": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "oneOf": [
                                        {
                                            "properties": {
                                                "type": {
                                                    "type": "string",
                                                    "enum": [
                                                        "field"
                                                    ]
                                                },
                                                "value": {
                                                    "type": "string"
                                                }
                                            },
                                            "required": [
                                                "type",
                                                "value"
                                            ]
                                        },
                                        {
                                            "properties": {
                                                "type": {
                                                    "type": "string",
                                                    "enum": [
                                                        "value",
                                                        "constant"
                                                    ]
                                                },
                                                "value": {}
                                            },
                                            "required": [
                                                "type",
                                                "value"
                                            ]
                                        },
                                        {
                                            "properties": {
                                                "type": {
                                                    "type": "string",
                                                    "enum": [
                                                        "expression"
                                                    ]
                                                },
                                                "value": {
                                                    "$ref": "#/properties/transform/items/properties/expression"
                                                }
                                            },
                                            "required": [
                                                "type",
                                                "value"
                                            ]
                                        }
                                    ]
                                }
                            },
                            "as": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "op",
                            "params",
                            "as"
                        ]
                    }
                },
                "required": [
                    "key",
                    "expression"
                ]
            }
        }
    },
    "required": [
        "type",
        "transform"
    ]
}
```

### View Query (required)

The view query is used to shape the data into a view data. It contains a list of view queries, each of which contains a view-level operation. A workflow must contain at least one view-level operation, which describes the structure of the view data.

At the moment, there are 3 view-level operations: aggregate, fold, and raw.

#### Aggregate Query

Use the aggregate operation in the view query when you want the data to be aggregated. The aggregate operation contains a list of measures to be aggregated by a specified aggregation function with the group-by fields.

``` ts
type IAggregator = 'sum' | 'count' | 'max' | 'min' | 'mean' | 'median' | 'variance' | 'stdev';

interface IAggQuery {
    op: 'aggregate';
    groupBy: string[];
    measures: {
        field: string;
        agg: IAggregator;
        asFieldKey: string;
    }[];
}
```

#### Raw Query

Use the raw operation in the view query when you want the data not to be aggregated. The raw operation contains a list of fields to be included in the view data.

``` ts
interface IRawQuery {
    op: 'raw';
    fields: string[];
}
```

An aggregate query will be

``` ts
type IViewQuery = IAggQuery | IRawQuery;

interface IViewQuery {
    type: 'view';
    query: Array<IViewQuery>;
}
```

The schema of the view query is

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "view"
            ]
        },
        "query": {
            "type": "array",
            "items": {
                "oneOf": [
                    {
                        "type": "object",
                        "properties": {
                            "op": {
                                "type": "string",
                                "enum": [
                                    "aggregate"
                                ]
                            },
                            "groupBy": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            },
                            "measures": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "field": {
                                            "type": "string"
                                        },
                                        "agg": {
                                            "type": "string",
                                            "enum": [
                                                "sum",
                                                "count",
                                                "max",
                                                "min",
                                                "mean",
                                                "median",
                                                "variance",
                                                "stdev"
                                            ]
                                        },
                                        "asFieldKey": {
                                            "type": "string"
                                        }
                                    },
                                    "required": [
                                        "field",
                                        "agg",
                                        "asFieldKey"
                                    ]
                                }
                            }
                        },
                        "required": [
                            "op",
                            "groupBy",
                            "measures"
                        ]
                    },
                    {
                        "type": "object",
                        "properties": {
                            "op": {
                                "type": "string",
                                "enum": [
                                    "raw"
                                ]
                            },
                            "fields": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            }
                        },
                        "required": [
                            "op",
                            "fields"
                        ]
                    }
                ]
            }
        }
    },
    "required": [
        "type",
        "query"
    ]
}
```

### Sort Query (optional)

The filter query is used to sort the result data. It contains a list of fields to be used for sort, and excepted sorting order.

```ts
export interface ISortWorkflowStep {
    type: 'sort';
    sort: 'ascending' | 'descending';
    by: string[];
}
```

The schema of the sort query is

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "enum": [
                "sort"
            ]
        },
        "sort": {
            "type": "string",
            "enum": [
                "ascending",
                "descending"
            ]
        },
        "by": {
            "type": "array",
            "items": {
                "type": "string",
            }
        }
    },
    "required": [
        "type",
        "sort",
        "by"
    ]
}
```

## Computation Request

GraphicWalker regards a computation as a request. A computation function, including HTTP service, must follow the protocol of the request.

### Payload

```ts
export interface IDataQueryPayload {
    workflow: IDataQueryWorkflowStep[];
    limit?: number;
    offset?: number;
}
```

### Return Value

```ts
export interface IRow {
    [key: string]: any;
}
declare const result: IRow[];
```

### Computation Function

```ts
export type IComputationFunction = (payload: IDataQueryPayload) => Promise<IRow[]>;
```
