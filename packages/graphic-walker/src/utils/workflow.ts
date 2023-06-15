import type { IDataQueryWorkflowStep } from "../interfaces";
import type { IVisEncodingChannelRef, IVisField, IVisSchema } from "../vis/protocol/interface";
import { getMeaAggKey } from ".";


export const toWorkflow = (spec: IVisSchema, fields: readonly IVisField[]): IDataQueryWorkflowStep[] => {
    const viewDimensions: IVisEncodingChannelRef[] = [];
    const viewMeasures: IVisEncodingChannelRef[] = [];
    for (const channel of Object.values(spec.encodings).filter(Boolean).flat()) {
        const ref = typeof channel === 'string' ? { field: channel } : channel;
        const isMeasure = Boolean(ref.aggregate);
        if (isMeasure) {
            viewMeasures.push(ref);
        } else {
            viewDimensions.push(ref);
        }
    }

    const steps: IDataQueryWorkflowStep[] = [];

    // First, to apply filters on the detailed data
    if (spec.filters?.length) {
        steps.push({
            type: 'filter',
            filters: spec.filters,
        });
    }

    // Second, to transform the data by rows 1 by 1
    const computedFields = fields.filter(f => f.expression).map(f => ({
        key: f.key,
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
    const aggregateOn = viewMeasures.filter(f => f.aggregate).map(f => [f.field, f.aggregate!] as const);
    if (viewMeasures.length > 0 && aggregateOn.length === viewMeasures.length) {
        // do aggregation
        steps.push({
            type: 'view',
            query: [{
                op: 'aggregate',
                groupBy: viewDimensions.map(f => f.field),
                measures: aggregateOn.map(([fieldKey, aggregate]) => ({
                    field: fieldKey,
                    agg: aggregate,
                    asFieldKey: getMeaAggKey(fieldKey, aggregate),
                })),
            }],
        });
    } else {
        steps.push({
            type: 'view',
            query: [{
                op: 'raw',
                fields: [...new Set([...viewDimensions, ...viewMeasures].map(f => f.field))],
            }],
        });
    }

    // Optimization: to remove the computed fields which are not used in the view
    if (transformStep) {
        const fidInView = new Set([...viewDimensions, ...viewMeasures].map(f => f.field));
        const computedFieldsInView = transformStep.transform.filter(f => fidInView.has(f.key));
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
