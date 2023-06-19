import type { IDataQueryWorkflowStep } from "../interfaces";
import type { IVisEncodingChannelRef, IVisSchema } from "../vis/protocol/interface";
import { getMeaAggKey } from ".";


export const toWorkflow = (spec: IVisSchema): IDataQueryWorkflowStep[] => {
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
    const computedFields = spec.computations;
    let transformStep: IDataQueryWorkflowStep | null = null;
    if (computedFields?.length) {
        transformStep = {
            type: 'transform',
            transform: computedFields.map(f => ({
                key: f.field,
                expression: f.expression,
            })),
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

    return steps;
};
