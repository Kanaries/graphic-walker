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
    let transformStep: IDataQueryWorkflowStep | null = null;
    if (computedFields.length) {
        transformStep = {
            type: 'transform',
            transform: computedFields,
        };
        steps.push(transformStep);
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

    // Optimization: to remove the computed fields which are not used in the view
    if (transformStep) {
        const fidInView = new Set([...viewDimensions, ...viewMeasures].map(f => f.fid));
        const computedFieldsInView = transformStep.transform.filter(f => fidInView.has(f.fid));
        if (computedFieldsInView.length < transformStep.transform.length) {
            if (!computedFieldsInView.length) {
                const idx = steps.indexOf(transformStep);
                steps.splice(idx, 1);
            } else {
                transformStep.transform = computedFieldsInView;
            }
        }
    }

    return steps;
};
