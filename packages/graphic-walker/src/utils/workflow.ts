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
    IJoinWorkflowStep,
    FieldIdentifier,
    IJoinPath,
} from '../interfaces';
import type { VizSpecStore } from '../store/visualSpecStore';
import { deduper, getFieldIdentifier, getFilterMeaAggKey, getMeaAggKey, getSort, isSameField } from '.';
import { DEFAULT_DATASET, MEA_KEY_ID, MEA_VAL_ID } from '../constants';
import { parseChart } from '../models/visSpecHistory';
import { replaceFid, walkFid } from '../lib/sql';
import { replaceAggForFold } from '../lib/op/fold';
import { viewEncodingKeys } from '@/models/visSpec';
import { encodePath, transformMultiDatasetFields } from './route';

const walkExpression = (
    field: {
        dataset?: string;
        joinPath?: IJoinPath[];
        expression: IExpression;
    },
    each: (field: { fid: string; dataset?: string; joinPath?: IJoinPath[] }) => void
): void => {
    for (const param of field.expression.params) {
        if (param.type === 'field') {
            each({ fid: param.value, dataset: field.dataset, joinPath: field.joinPath });
        } else if (param.type === 'expression') {
            walkExpression({ dataset: field.dataset, joinPath: field.joinPath, expression: param.value }, each);
        } else if (param.type === 'sql') {
            walkFid(param.value).forEach((fid) => each({ fid, dataset: field.dataset, joinPath: field.joinPath }));
        } else if (param.type === 'map') {
            each({ fid: param.value.x, dataset: field.dataset, joinPath: field.joinPath });
            each({ fid: param.value.y, dataset: field.dataset, joinPath: field.joinPath });
        } else if (param.type === 'newmap') {
            param.value.facets.flatMap((x) => x.dimensions).forEach((x) => each({ fid: x.fid, dataset: x.dataset ?? DEFAULT_DATASET, joinPath: x.joinPath }));
        }
    }
};

const treeShake = <T extends { fid: string; dataset?: string; expression: IExpression }>(
    computedFields: T[],
    viewKeys: { fid: string; dataset?: string; joinPath?: IJoinPath[] }[]
): (T & { joinPath?: IJoinPath[] })[] => {
    const keyF = (item: { fid: string; dataset?: string; joinPath?: IJoinPath[] }) =>
        JSON.stringify([getFieldIdentifier(item), encodePath(item.joinPath ?? [])]);
    let result = viewKeys.flatMap((i) => computedFields.filter(isSameField(i)).map((x) => ({ ...x, joinPath: i.joinPath })));
    let currentFields = result.slice();
    const reachedFields = new Set<string>(result.map(keyF));
    while (currentFields.length) {
        const dependencies = new Map<
            string,
            {
                fid: string;
                dataset?: string;
                joinPath?: IJoinPath[];
            }
        >();
        for (const f of currentFields) {
            walkExpression(f, (field) => dependencies.set(keyF(field), field));
        }
        const deps = Array.from(dependencies.values()).flatMap((d) => computedFields.filter(isSameField(d)).map((x) => ({ ...x, joinPath: d.joinPath })));
        result = deps.concat(result.filter((f) => !dependencies.has(keyF(f))));
        currentFields = deps.filter((x) => !reachedFields.has(keyF(x)));
        deps.forEach((x) => reachedFields.add(keyF(x)));
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
    viewFiltersRaw: VizSpecStore['viewFilters'],
    allFields: IViewField[],
    viewDimensionsRaw: IViewField[],
    viewMeasuresRaw: IViewField[],
    defaultAggregated: VizSpecStore['config']['defaultAggregated'],
    sort: 'none' | 'ascending' | 'descending',
    folds = [] as string[],
    limit?: number,
    timezoneDisplayOffset?: number
): {
    workflow: IDataQueryWorkflowStep[];
    datasets: string[];
} => {
    const viewDimensionsGuarded = viewDimensionsRaw.filter((x) => x.fid !== MEA_KEY_ID);
    const viewMeasuresGuarded = viewMeasuresRaw.filter((x) => x.fid !== MEA_VAL_ID);
    const hasFold = viewDimensionsRaw.find((x) => x.fid === MEA_KEY_ID) && viewMeasuresRaw.find((x) => x.fid === MEA_VAL_ID);
    if (hasFold) {
        const aggName = viewMeasuresRaw.find((x) => x.fid === MEA_VAL_ID)!.aggName;
        const newFields = folds
            .map((k) => allFields.find((x) => getFieldIdentifier(x) === k)!)
            .filter(Boolean)
            .map((x) => replaceAggForFold(x, aggName));
        viewDimensionsGuarded.push(...newFields.filter((x) => x?.analyticType === 'dimension'));
        viewMeasuresGuarded.push(...newFields.filter((x) => x?.analyticType === 'measure'));
    }
    const allComputedRaw = treeShake(
        allFields.filter((f) => f.computed && f.expression) as (IViewField & { expression: IExpression })[],
        deduper([...viewDimensionsGuarded, ...viewMeasuresGuarded, ...viewFiltersRaw], (x) =>
            JSON.stringify([getFieldIdentifier(x), encodePath(x.joinPath ?? [])])
        )
    );
    const {
        datasets,
        filters: viewFilters,
        foreignKeys,
        processFid,
        views: { viewDimensions, viewMeasures, allComputed },
    } = transformMultiDatasetFields({
        filters: viewFiltersRaw,
        views: {
            viewDimensions: viewDimensionsGuarded,
            viewMeasures: viewMeasuresGuarded,
            allComputed: allComputedRaw,
        },
    });

    let filterWorkflow: IFilterWorkflowStep | null = null;
    let transformWorkflow: ITransformWorkflowStep | null = null;
    let computedWorkflow: IFilterWorkflowStep | null = null;
    let viewQueryWorkflow: IViewWorkflowStep | null = null;
    let sortWorkflow: ISortWorkflowStep | null = null;
    let aggFilterWorkflow: IFilterWorkflowStep | null = null;

    // First, to apply filters on the detailed data
    const filters = viewFilters.filter((f) => !f.computed && f.rule && !f.enableAgg).map<IVisFilter>(createFilter);
    if (filters.length) {
        filterWorkflow = {
            type: 'filter',
            filters,
        };
    }

    // Second, to transform the data by rows 1 by 1
    const computedFields = allComputed
        .filter((f) => !(f.expression.op === 'expr' && f.aggName === 'expr'))
        .map((f) => {
            return {
                key: f.fid,
                expression: processExpression(
                    f.expression!,
                    allFields.filter((x) => x.dataset === f.dataset),
                    { timezoneDisplayOffset, transformFid: processFid(f.joinPath) }
                ),
            };
        });
    if (computedFields.length) {
        transformWorkflow = {
            type: 'transform',
            transform: computedFields,
        };
    }

    // Third, apply filter on the transformed data
    const computedFilters = viewFilters.filter((f) => f.computed && f.rule && !f.enableAgg).map<IVisFilter>(createFilter);
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
    const aggergatedComputed = allComputed
        .filter((f) => f.expression.op === 'expr' && f.aggName === 'expr')
        .map((f) => {
            return {
                key: f.fid,
                expression: processExpression(
                    f.expression!,
                    allFields.filter((x) => x.dataset === f.dataset),
                    { timezoneDisplayOffset, transformFid: processFid(f.joinPath) }
                ),
            };
        });

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
            filters: aggergatedFilter.map(createFilter),
        };
    }

    if (sort !== 'none' && limit && limit !== -1) {
        sortWorkflow = {
            type: 'sort',
            by: viewMeasures.map((f) => (aggergated ? getMeaAggKey(f.fid, f.aggName) : f.fid)),
            sort,
        };
    }

    const joinWorkflow: IJoinWorkflowStep | null = foreignKeys
        ? {
              type: 'join',
              foreigns: foreignKeys,
          }
        : null;

    const steps: IDataQueryWorkflowStep[] = [
        joinWorkflow!,
        filterWorkflow!,
        transformWorkflow!,
        computedWorkflow!,
        viewQueryWorkflow!,
        aggFilterWorkflow!,
        sortWorkflow!,
    ].filter(Boolean);
    return { workflow: steps, datasets };
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

export const addJoinForQuery = (query: IDataQueryPayload, join: IJoinWorkflowStep[]): IDataQueryPayload => {
    if (join.length === 0) return query;
    return {
        ...query,
        workflow: [...join, ...query.workflow.filter((x) => x.type !== 'join')],
    };
};

export const changeDatasetForQuery = (query: IDataQueryPayload, datasets: string[]) => {
    return {
        ...query,
        datasets,
    };
};

export function chartToWorkflow(chart: IVisSpec | IChart): IDataQueryPayload {
    const parsedChart = parseChart(chart);
    const viewEncodingFields = viewEncodingKeys(parsedChart.config?.geoms?.[0] ?? 'auto').flatMap<IViewField>((k) => parsedChart.encodings?.[k] ?? []);
    const rows = parsedChart.encodings?.rows ?? [];
    const columns = parsedChart.encodings?.columns ?? [];
    const limit = parsedChart.config?.limit ?? -1;
    return {
        ...toWorkflow(
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

export const processExpression = (
    exp: IExpression,
    allFields: IMutField[],
    config: { timezoneDisplayOffset?: number; transformFid?: (fid: string) => string }
): IExpression => {
    const { transformFid = (x) => x } = config;
    if (exp?.op === 'expr') {
        // not processed with multi dataset yet, process transformFid here
        return {
            ...exp,
            params: [
                {
                    type: 'sql',
                    value: replaceFid(exp.params.find((x) => x.type === 'sql')!.value, allFields, transformFid).trim(),
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
                            x: transformFid(x.value.x),
                            y: transformFid(x.value.y),
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
                    // facets multi dataset is already dealt in createTransformerForComputed
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
