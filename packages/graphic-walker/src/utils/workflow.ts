import { getMeaAggKey } from ".";
import type { IDataQueryWorkflowStep } from "../interfaces";
import type { VizSpecStore } from "../store/visualSpecStore";


export const toWorkflow = (
    viewFilters: VizSpecStore['viewFilters'],
    allFields: VizSpecStore['allFields'],
    viewDimensions: VizSpecStore['viewDimensions'],
    viewMeasures: VizSpecStore['viewMeasures'],
    defaultAggregated: VizSpecStore['visualConfig']['defaultAggregated'],
): IDataQueryWorkflowStep[] => {
    const steps: IDataQueryWorkflowStep[] = [];

    // First, to apply filters on the detailed data
    const filters = viewFilters.filter(f => f.rule).map(f => ({
        fid: f.fid,
        rule: f.rule!,
    }));
    if (filters.length) {
        steps.push({
            type: 'filter',
            filters,
        });
    }

    // Second, to transform the data by rows 1 by 1
    const computedFields = allFields.filter(f => f.computed && f.expression).map(f => ({
        fid: f.fid,
        expression: f.expression!,
    }));
    if (computedFields.length) {
        steps.push({
            type: 'transform',
            transform: computedFields,
        });
    }

    // Finally, to apply the aggregation
    const aggregateOn = viewMeasures.filter(f => f.aggName).map(f => [f.fid, f.aggName as string]);
    if (defaultAggregated && aggregateOn.length) {
        steps.push({
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
        });
    } else {
        steps.push({
            type: 'view',
            query: [{
                op: 'raw',
                fields: [...new Set([...viewDimensions, ...viewMeasures])].map(f => f.fid),
            }],
        });
    }

    return steps;
};
