import type {
    IDataQueryWorkflowStep,
    IExpression,
    IFilterWorkflowStep,
    ITransformWorkflowStep,
    IViewField,
    IViewWorkflowStep,
    IVisFilter,
    ISortWorkflowStep,
    IDataQueryPayload,
    IPaintMap,
    IFilterField,
    IChart,
    IMutField,
    IPaintMapV2,
    IVisSpec,
} from '../interfaces';
import type { VizSpecStore } from '../store/visualSpecStore';
import { getFilterMeaAggKey, getMeaAggKey, getSort } from '.';
import { MEA_KEY_ID, MEA_VAL_ID } from '../constants';
import { parseChart } from '../models/visSpecHistory';
import { replaceFid, walkFid } from '../lib/sql';
import { replaceAggForFold } from '../lib/op/fold';
import { viewEncodingKeys } from '@/models/visSpec';

const walkExpression = (expression: IExpression, each: (field: string) => void): void => {
    for (const param of expression.params) {
        if (param.type === 'field') {
            each(param.value);
        } else if (param.type === 'expression') {
            walkExpression(param.value, each);
        } else if (param.type === 'sql') {
            walkFid(param.value).forEach(each);
        } else if (param.type === 'map') {
            each(param.value.x);
            each(param.value.y);
        } else if (param.type === 'newmap') {
            param.value.facets.flatMap((x) => x.dimensions).forEach((x) => each(x.fid));
        }
    }
};

const deduper = <T>(items: T[], keyF: (k: T) => string) => {
    const map = new Map<string, T>();
    items.forEach((x) => map.set(keyF(x), x));
    return [...map.values()];
};

const treeShake = (
    computedFields: readonly { key: string; expression: IExpression }[],
    viewKeys: readonly string[]
): { key: string; expression: IExpression }[] => {
    const usedFields = new Set(viewKeys);
    let result = computedFields.filter((f) => usedFields.has(f.key));
    let currentFields = result.slice();
    let rest = computedFields.filter((f) => !usedFields.has(f.key));
    while (currentFields.length && rest.length) {
        const dependencies = new Set<string>();
        for (const f of currentFields) {
            walkExpression(f.expression, (field) => dependencies.add(field));
        }
        const nextFields = rest.filter((f) => dependencies.has(f.key));
        const deps = computedFields.filter((f) => dependencies.has(f.key));
        result = deps.concat(result.filter((f) => !dependencies.has(f.key)));
        currentFields = nextFields;
        rest = rest.filter((f) => !dependencies.has(f.key));
    }
    return result;
};

export const createFilter = (f: IFilterField): IVisFilter => {
    const fid = getFilterMeaAggKey(f);
    const rule = f.rule!;
    if (rule.type === 'one of') {
        return {
            fid,
            rule: {
                type: 'one of',
                value: [...rule.value],
            },
        };
    } else if (rule.type === 'temporal range') {
        return {
            fid,
            rule: {
                type: 'temporal range',
                value: rule.value,
                offset: rule.offset,
                format: rule.format,
            },
        };
    } else if (rule.type === 'not in') {
        return {
            fid,
            rule: {
                type: 'not in',
                value: [...rule.value],
            },
        };
    } else if (rule.type === 'range') {
        return {
            fid,
            rule: {
                type: 'range',
                value: [rule.value[0] ? Number(rule.value[0]) : rule.value[0], rule.value[1] ? Number(rule.value[1]) : rule.value[1]],
            },
        };
    } else if (rule.type === 'regexp') {
        return {
            fid,
            rule: {
                type: 'regexp',
                value: rule.value,
                caseSensitive: rule.caseSensitive,
            },
        };
    } else {
        const neverRule: never = rule;
        console.error('unknown rule', neverRule);
        return {
            fid,
            rule,
        };
    }
};

export const toWorkflow = (
    viewFilters: VizSpecStore['viewFilters'],
    allFields: IViewField[],
    viewDimensionsRaw: IViewField[],
    viewMeasuresRaw: IViewField[],
    defaultAggregated: VizSpecStore['config']['defaultAggregated'],
    sort: 'none' | 'ascending' | 'descending',
    folds = [] as string[],
    limit?: number,
    timezoneDisplayOffset?: number
): IDataQueryWorkflowStep[] => {
    const hasFold = viewDimensionsRaw.find((x) => x.fid === MEA_KEY_ID) && viewMeasuresRaw.find((x) => x.fid === MEA_VAL_ID);
    const viewDimensions = viewDimensionsRaw.filter((x) => x.fid !== MEA_KEY_ID);
    const viewMeasures = viewMeasuresRaw.filter((x) => x.fid !== MEA_VAL_ID);
    if (hasFold) {
        const aggName = viewMeasuresRaw.find((x) => x.fid === MEA_VAL_ID)!.aggName;
        const newFields = folds
            .map((k) => allFields.find((x) => x.fid === k)!)
            .filter(Boolean)
            .map((x) => replaceAggForFold(x, aggName));
        viewDimensions.push(...newFields.filter((x) => x?.analyticType === 'dimension'));
        viewMeasures.push(...newFields.filter((x) => x?.analyticType === 'measure'));
    }
    const viewKeys = new Set<string>([...viewDimensions, ...viewMeasures, ...viewFilters].map((f) => f.fid));

    let filterWorkflow: IFilterWorkflowStep | null = null;
    let transformWorkflow: ITransformWorkflowStep | null = null;
    let computedWorkflow: IFilterWorkflowStep | null = null;
    let viewQueryWorkflow: IViewWorkflowStep | null = null;
    let sortWorkflow: ISortWorkflowStep | null = null;
    let aggFilterWorkflow: IFilterWorkflowStep | null = null;

    // TODO: apply **fold** before filter

    const buildFilter = (f: IFilterField) => {
        const filter = createFilter(f);
        viewKeys.add(filter.fid);
        return filter;
    };

    // First, to apply filters on the detailed data
    const filters = viewFilters.filter((f) => !f.computed && f.rule && !f.enableAgg).map<IVisFilter>(buildFilter);
    if (filters.length) {
        filterWorkflow = {
            type: 'filter',
            filters,
        };
    }

    // Second, to transform the data by rows 1 by 1
    const computedFields = treeShake(
        allFields
            .filter((f) => f.computed && f.expression && !(f.expression.op === 'expr' && f.aggName === 'expr'))
            .map((f) => {
                return {
                    key: f.fid,
                    expression: processExpression(f.expression!, allFields, { timezoneDisplayOffset }),
                };
            }),
        [...viewKeys]
    );
    if (computedFields.length) {
        transformWorkflow = {
            type: 'transform',
            transform: computedFields,
        };
    }

    // Third, apply filter on the transformed data
    const computedFilters = viewFilters.filter((f) => f.computed && f.rule && !f.enableAgg).map<IVisFilter>(buildFilter);
    if (computedFilters.length) {
        computedWorkflow = {
            type: 'filter',
            filters: computedFilters,
        };
    }

    // Finally, to apply the aggregation
    // When aggregation is enabled, there're 2 cases:
    // 1. If any of the measures is aggregated, then we apply the aggregation
    // 2. If there's no measure in the view, then we apply the aggregation
    const aggergatedFilter = viewFilters.filter((f) => f.enableAgg && f.aggName && f.rule);
    const aggergatedComputed = treeShake(
        allFields
            .filter((f) => f.computed && f.expression && f.expression.op === 'expr' && f.aggName === 'expr')
            .map((f) => {
                return {
                    key: f.fid,
                    expression: processExpression(f.expression!, allFields, { timezoneDisplayOffset }),
                };
            }),
        [...viewKeys]
    );
    const aggregateOn = viewMeasures
        .filter((f) => f.aggName)
        .map((f) => [f.fid, f.aggName as string])
        .concat(aggergatedFilter.map((f) => [f.fid, f.aggName as string]))
        .concat(aggergatedComputed.map((f) => [f.expression.params[0].value, 'expr']));
    const aggergated = defaultAggregated && (aggregateOn.length || (viewMeasures.length === 0 && viewDimensions.length > 0));

    if (aggergated) {
        viewQueryWorkflow = {
            type: 'view',
            query: [
                {
                    op: 'aggregate',
                    groupBy: deduper(
                        viewDimensions.map((f) => f.fid),
                        (x) => x
                    ),
                    measures: deduper(
                        viewMeasures
                            .concat(aggergatedFilter)
                            .map((f) => ({
                                field: f.fid,
                                agg: f.aggName as any,
                                asFieldKey: getMeaAggKey(f.fid, f.aggName!),
                            }))
                            .concat(
                                aggergatedComputed.map((f) => ({
                                    field: f.expression.params[0].value,
                                    agg: 'expr',
                                    asFieldKey: f.key,
                                }))
                            ),
                        (x) => x.asFieldKey
                    ),
                },
            ],
        };
    } else {
        viewQueryWorkflow = {
            type: 'view',
            query: [
                {
                    op: 'raw',
                    fields: [...new Set([...viewDimensions, ...viewMeasures])].filter((f) => f.aggName !== 'expr').map((f) => f.fid),
                },
            ],
        };
    }

    // Apply aggregation Filter after aggregation.
    if (aggergated && viewDimensions.length > 0 && aggergatedFilter.length > 0) {
        aggFilterWorkflow = {
            type: 'filter',
            filters: aggergatedFilter.map(buildFilter),
        };
    }

    if (sort !== 'none' && limit && limit !== -1) {
        sortWorkflow = {
            type: 'sort',
            by: viewMeasures.map((f) => (aggergated ? getMeaAggKey(f.fid, f.aggName) : f.fid)),
            sort,
        };
    }

    const steps: IDataQueryWorkflowStep[] = [
        filterWorkflow!,
        transformWorkflow!,
        computedWorkflow!,
        viewQueryWorkflow!,
        aggFilterWorkflow!,
        sortWorkflow!,
    ].filter(Boolean);
    return steps;
};

export const addTransformForQuery = (
    query: IDataQueryPayload,
    transform: {
        key: string;
        expression: IExpression;
    }[]
): IDataQueryPayload => {
    if (transform.length === 0) return query;
    if (query.workflow[0].type === 'transform') {
        return {
            ...query,
            workflow: query.workflow.map((x, i) => {
                if (x.type === 'transform' && i === 0) {
                    const transforms = new Set(x.transform.map((t) => t.key));
                    return {
                        type: 'transform',
                        transform: x.transform.concat(transform.filter((t) => !transforms.has(t.key))),
                    };
                }
                return x;
            }),
        };
    }
    const transformQuery: ITransformWorkflowStep = { type: 'transform', transform };
    return { ...query, workflow: [transformQuery, ...query.workflow] };
};

export const addFilterForQuery = (query: IDataQueryPayload, filters: IVisFilter[]): IDataQueryPayload => {
    if (filters.length === 0) return query;
    const existFilter = query.workflow.findIndex((x) => x.type === 'filter');
    if (existFilter > -1) {
        return {
            ...query,
            workflow: query.workflow.map((x, i) => {
                if (x.type === 'filter' && i === existFilter) {
                    return {
                        type: 'filter',
                        filters: filters.concat(x.filters),
                    };
                }
                return x;
            }),
        };
    }
    const filterQuery: IFilterWorkflowStep = { type: 'filter', filters };
    return {
        ...query,
        workflow: [filterQuery, ...query.workflow],
    };
};
/**
 * @deprecated
 */
export const chartToWorkflow = specToWorkflow;
export function specToWorkflow(chart: IVisSpec | IChart): IDataQueryPayload {
    const parsedChart = parseChart(chart);
    const viewEncodingFields = viewEncodingKeys(parsedChart.config?.geoms?.[0] ?? 'auto').flatMap<IViewField>((k) => parsedChart.encodings?.[k] ?? []);
    const rows = parsedChart.encodings?.rows ?? [];
    const columns = parsedChart.encodings?.columns ?? [];
    const limit = parsedChart.config?.limit ?? -1;
    return {
        workflow: toWorkflow(
            parsedChart.encodings?.filters ?? [],
            [...(parsedChart.encodings?.dimensions ?? []), ...(parsedChart.encodings?.measures ?? [])],
            viewEncodingFields.filter((x) => x.analyticType === 'dimension'),
            viewEncodingFields.filter((x) => x.analyticType === 'measure'),
            parsedChart.config?.defaultAggregated ?? true,
            getSort({ rows, columns }),
            parsedChart.config?.folds ?? [],
            limit,
            parsedChart.config?.timezoneDisplayOffset
        ),
        limit: limit > 0 ? limit : undefined,
    };
}

export const processExpression = (exp: IExpression, allFields: IMutField[], config: { timezoneDisplayOffset?: number }): IExpression => {
    if (exp?.op === 'expr') {
        return {
            ...exp,
            params: [
                {
                    type: 'sql',
                    value: replaceFid(exp.params.find((x) => x.type === 'sql')!.value, allFields).trim(),
                },
            ],
        };
    }
    if (exp.op === 'dateTimeDrill' || exp.op === 'dateTimeFeature') {
        return {
            ...exp,
            params: [
                ...exp.params,
                {
                    type: 'displayOffset',
                    value: config.timezoneDisplayOffset ?? new Date().getTimezoneOffset(),
                },
            ],
        };
    }
    if (exp.op === 'paint') {
        return {
            ...exp,
            params: exp.params.map((x) => {
                if (x.type === 'map') {
                    const dict = {
                        ...x.value.dict,
                        '255': { name: '' },
                    };
                    return {
                        type: 'map' as const,
                        value: {
                            x: x.value.x,
                            y: x.value.y,
                            domainX: x.value.domainX,
                            domainY: x.value.domainY,
                            map: x.value.map,
                            dict: Object.fromEntries(
                                x.value.usedColor.map((i) => [
                                    i,
                                    {
                                        name: dict[i].name,
                                    },
                                ])
                            ),
                            mapwidth: x.value.mapwidth,
                        } as IPaintMap,
                    };
                } else if (x.type === 'newmap') {
                    const dict = {
                        ...x.value.dict,
                        '255': { name: '' },
                    };
                    const colors = Array.from(new Set(x.value.usedColor.concat(1)));
                    return {
                        type: 'newmap',
                        value: {
                            facets: x.value.facets.map(({ dimensions, map }) => ({ dimensions, map })),
                            dict: Object.fromEntries(
                                colors.map((i) => [
                                    i,
                                    {
                                        name: dict[i].name,
                                    },
                                ])
                            ),
                        } as IPaintMapV2,
                    };
                } else {
                    return x;
                }
            }),
        };
    }
    return exp;
};
