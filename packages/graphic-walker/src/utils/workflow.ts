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
    IFilterField,
} from '../interfaces';
import type { VizSpecStore } from '../store/visualSpecStore';
import { getMeaAggKey } from '.';
import { MEA_KEY_ID, MEA_VAL_ID } from '../constants';

const walkExpression = (expression: IExpression, each: (field: string) => void): void => {
    for (const param of expression.params) {
        if (param.type === 'field') {
            each(param.value);
        } else if (param.type === 'expression') {
            walkExpression(param.value, each);
        }
    }
};

const treeShake = (
    computedFields: readonly { key: string; expression: IExpression }[],
    viewKeys: readonly string[]
): { key: string; expression: IExpression }[] => {
    const usedFields = new Set(viewKeys);
    const result = computedFields.filter((f) => usedFields.has(f.key));
    let currentFields = result.slice();
    let rest = computedFields.filter((f) => !usedFields.has(f.key));
    while (currentFields.length && rest.length) {
        const dependencies = new Set<string>();
        for (const f of currentFields) {
            walkExpression(f.expression, (field) => dependencies.add(field));
        }
        const nextFields = rest.filter((f) => dependencies.has(f.key));
        currentFields = nextFields;
        rest = rest.filter((f) => !dependencies.has(f.key));
    }
    return result;
};

export const toWorkflow = (
    viewFilters: VizSpecStore['viewFilters'],
    allFields: Omit<IViewField, 'dragId'>[],
    viewDimensionsRaw: Omit<IViewField, 'dragId'>[],
    viewMeasuresRaw: Omit<IViewField, 'dragId'>[],
    defaultAggregated: VizSpecStore['config']['defaultAggregated'],
    sort: 'none' | 'ascending' | 'descending',
    folds = [] as string[],
    limit?: number
): IDataQueryWorkflowStep[] => {
    const hasFold = viewDimensionsRaw.find((x) => x.fid === MEA_KEY_ID) && viewMeasuresRaw.find((x) => x.fid === MEA_VAL_ID);
    const viewDimensions = viewDimensionsRaw.filter((x) => x.fid !== MEA_KEY_ID);
    const viewMeasures = viewMeasuresRaw.filter((x) => x.fid !== MEA_VAL_ID);
    if (hasFold) {
        const aggName = viewMeasuresRaw.find((x) => x.fid === MEA_VAL_ID)!.aggName;
        const newFields = folds
            .map((k) => allFields.find((x) => x.fid === k)!)
            .map((x) => ({ ...x, aggName }))
            .filter(Boolean);
        viewDimensions.push(...newFields.filter((x) => x?.analyticType === 'dimension'));
        viewMeasures.push(...newFields.filter((x) => x?.analyticType === 'measure'));
    }
    const viewKeys = new Set<string>([...viewDimensions, ...viewMeasures, ...viewFilters].map((f) => f.fid));

    let filterWorkflow: IFilterWorkflowStep | null = null;
    let transformWorkflow: ITransformWorkflowStep | null = null;
    let computedWorkflow: IFilterWorkflowStep | null = null;
    let viewQueryWorkflow: IViewWorkflowStep | null = null;
    let sortWorkflow: ISortWorkflowStep | null = null;

    // TODO: apply **fold** before filter

    const createFilter = (f: IFilterField): IVisFilter => {
        viewKeys.add(f.fid);
        const rule = f.rule!;
        if (rule.type === 'one of') {
            return {
                fid: f.fid,
                rule: {
                    type: 'one of',
                    value: [...rule.value],
                },
            };
        } else if (rule.type === 'temporal range') {
            const range = [new Date(rule.value[0]).getTime(), new Date(rule.value[1]).getTime()] as const;
            return {
                fid: f.fid,
                rule: {
                    type: 'temporal range',
                    value: range,
                },
            };
        } else {
            const range = [Number(rule.value[0]), Number(rule.value[1])] as const;
            return {
                fid: f.fid,
                rule: {
                    type: 'range',
                    value: range,
                },
            };
        }
    };

    // First, to apply filters on the detailed data
    const filters = viewFilters.filter((f) => !f.computed && f.rule).map<IVisFilter>(createFilter);
    if (filters.length) {
        filterWorkflow = {
            type: 'filter',
            filters,
        };
    }

    // Second, to transform the data by rows 1 by 1
    const computedFields = treeShake(
        allFields
            .filter((f) => f.computed && f.expression)
            .map((f) => ({
                key: f.fid,
                expression: f.expression!,
            })),
        [...viewKeys]
    );
    if (computedFields.length) {
        transformWorkflow = {
            type: 'transform',
            transform: computedFields,
        };
    }

    // Third, apply filter on the transformed data
    const computedFilters = viewFilters.filter((f) => f.computed && f.rule).map<IVisFilter>(createFilter);
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
    const aggregateOn = viewMeasures.filter((f) => f.aggName).map((f) => [f.fid, f.aggName as string]);
    const aggergated = defaultAggregated && (aggregateOn.length || (viewMeasures.length === 0 && viewDimensions.length > 0));

    if (aggergated) {
        viewQueryWorkflow = {
            type: 'view',
            query: [
                {
                    op: 'aggregate',
                    groupBy: viewDimensions.map((f) => f.fid),
                    measures: viewMeasures.map((f) => ({
                        field: f.fid,
                        agg: f.aggName as any,
                        asFieldKey: getMeaAggKey(f.fid, f.aggName!),
                    })),
                },
            ],
        };
    } else {
        viewQueryWorkflow = {
            type: 'view',
            query: [
                {
                    op: 'raw',
                    fields: [...new Set([...viewDimensions, ...viewMeasures])].map((f) => f.fid),
                },
            ],
        };
    }

    if (sort !== 'none' && limit) {
        sortWorkflow = {
            type: 'sort',
            by: viewMeasures.map((f) => (aggergated ? getMeaAggKey(f.fid, f.aggName) : f.fid)),
            sort,
        };
    }

    const steps: IDataQueryWorkflowStep[] = [filterWorkflow!, transformWorkflow!, computedWorkflow!, viewQueryWorkflow!, sortWorkflow!].filter(Boolean);
    return steps;
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
