import type { IDataQueryWorkflowStep, IExpression, IFilterWorkflowStep, ITransformWorkflowStep, IViewField, IViewWorkflowStep, IVisFilter, ISortWorkflowStep, ILimitWorkflowStep } from "../interfaces";
import type { VizSpecStore } from "../store/visualSpecStore";
import { getMeaAggKey } from ".";


const walkExpression = (expression: IExpression, each: (field: string) => void): void => {
    for (const param of expression.params) {
        if (param.type === 'field') {
            each(param.value);
        } else if (param.type === 'expression') {
            walkExpression(param.value, each);
        }
    }
};

const treeShake = (computedFields: readonly { key: string; expression: IExpression }[], viewKeys: readonly string[]): { key: string; expression: IExpression }[] => {
    const usedFields = new Set(viewKeys);
    const result = computedFields.filter(f => usedFields.has(f.key));
    let currentFields = result.slice();
    let rest = computedFields.filter(f => !usedFields.has(f.key));
    while (currentFields.length && rest.length) {
        const dependencies = new Set<string>();
        for (const f of currentFields) {
            walkExpression(f.expression, field => dependencies.add(field));
        }
        const nextFields = rest.filter(f => dependencies.has(f.key));
        currentFields = nextFields;
        rest = rest.filter(f => !dependencies.has(f.key));
    }
    return result;
};

export const toWorkflow = (
    viewFilters: VizSpecStore['viewFilters'],
    allFields: Omit<IViewField, 'dragId'>[],
    viewDimensions: VizSpecStore['viewDimensions'],
    viewMeasures: VizSpecStore['viewMeasures'],
    defaultAggregated: VizSpecStore['visualConfig']['defaultAggregated'],
    sort: 'none' | 'ascending' | 'descending',
    limit?: number,
): IDataQueryWorkflowStep[] => {
    const viewKeys = new Set<string>([...viewDimensions, ...viewMeasures].map(f => f.fid));

    let filterWorkflow: IFilterWorkflowStep | null = null;
    let transformWorkflow: ITransformWorkflowStep | null = null;
    let viewQueryWorkflow: IViewWorkflowStep | null = null;
    let sortWorkflow: ISortWorkflowStep | null = null;
    let limitWorkflow: ILimitWorkflowStep | null = null;

    // TODO: apply **fold** before filter
    
    // First, to apply filters on the detailed data
    const filters = viewFilters.filter(f => f.rule).map<IVisFilter>(f => {
        viewKeys.add(f.fid);
        const rule = f.rule!;
        if (rule.type === 'one of') {
            return {
                type: 'oneOf',
                field: f.fid,
                value: [...rule.value],
            };
        } else {
            const isTemporal = allFields.find(which => which.fid === f.fid)?.semanticType === 'temporal';
            const range = isTemporal ? [new Date(rule.value[0]).getTime(), new Date(rule.value[1]).getTime()] as const : [Number(rule.value[0]), Number(rule.value[1])] as const;
            return {
                type: 'range',
                field: f.fid,
                min: range[0],
                max: range[1],
            };
        }
    });
    if (filters.length) {
        filterWorkflow = {
            type: 'filter',
            filters,
        };
    }

    // Second, to transform the data by rows 1 by 1
    const computedFields = treeShake(allFields.filter(f => f.computed && f.expression).map(f => ({
        key: f.fid,
        expression: f.expression!,
    })), [...viewKeys]);
    if (computedFields.length) {
        transformWorkflow = {
            type: 'transform',
            transform: computedFields,
        };
    }

    // Finally, to apply the aggregation
    // When aggregation is enabled, there're 2 cases:
    // 1. If any of the measures is aggregated, then we apply the aggregation
    // 2. If there's no measure in the view, then we apply the aggregation
    const aggregateOn = viewMeasures.filter(f => f.aggName).map(f => [f.fid, f.aggName as string]);
    const aggregate = defaultAggregated && (aggregateOn.length || (viewMeasures.length === 0 && viewDimensions.length > 0))
    if (aggregate) {
        viewQueryWorkflow = {
            type: 'view',
            query: [{
                op: 'aggregate',
                groupBy: viewDimensions.map(f => f.fid),
                measures: viewMeasures.map((f) => ({
                    field: f.fid,
                    agg: f.aggName as any,
                    asFieldKey: getMeaAggKey(f.fid, f.aggName!),
                })),
            }],
        };
    } else {
        viewQueryWorkflow = {
            type: 'view',
            query: [{
                op: 'raw',
                fields: [...new Set([...viewDimensions, ...viewMeasures])].map(f => f.fid),
            }],
        };
    }

    if (sort !== "none" && limit) {
        sortWorkflow = {
            type: 'sort',
            by: viewMeasures.map(x => aggregate ? getMeaAggKey(x.fid, x.aggName!) : x.fid),
            sort
        };
    }

    if (limit) {
        limitWorkflow = {
            type: 'limit',
            value: limit
        }
    }

    const steps: IDataQueryWorkflowStep[] = [
        filterWorkflow!,
        transformWorkflow!,
        viewQueryWorkflow!,
        sortWorkflow!,
        limitWorkflow!,
    ].filter(Boolean);

    return steps;
};
