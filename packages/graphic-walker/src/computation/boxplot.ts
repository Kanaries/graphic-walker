import type { IChart, IDataQueryWorkflowStep, IRow } from '../interfaces';
import { MEA_KEY_ID, MEA_VAL_ID } from '../constants';
import { quantileSorted } from '../lib/op/stat';

/** A host computation request, never a persisted visualization or a provider query operator. */
export interface BoxplotComputationPlan {
    readonly groupBy: readonly string[];
    readonly measureColumns: readonly string[];
    readonly unsupported?: string;
}
export interface BoxplotGroup {
    readonly groupKey: string;
    readonly measureColumn: string;
    readonly representativeIndex: number;
    readonly q1: number;
    readonly median: number;
    readonly q3: number;
    readonly lowerWhisker: number;
    readonly upperWhisker: number;
    readonly outliers: readonly { readonly inputIndex: number; readonly value: number }[];
}
export interface BoxplotComputationResult {
    readonly groups: readonly BoxplotGroup[];
    /** One representative preserves an all-null group's members without retaining every null sample. */
    readonly emptyGroups?: readonly { readonly groupKey: string; readonly representativeIndex: number }[];
}

export function planBoxplotComputation(chart: IChart): BoxplotComputationPlan | undefined {
    if (chart.config.geoms[0] !== 'boxplot') return undefined;
    const positions = [...chart.encodings.rows, ...chart.encodings.columns];
    const visualGroups = [...chart.encodings.color, ...chart.encodings.opacity, ...chart.encodings.details];
    const measures = positions.filter((field) => field.analyticType === 'measure');
    const fields = [...positions, ...visualGroups];
    const fold = fields.some((field) => field.fid === MEA_KEY_ID || field.fid === MEA_VAL_ID);
    const aggregateExpression = fields.some((field) => field.aggName === 'expr');
    const aggregateFilter = chart.encodings.filters.some((field) => field.enableAgg && field.rule);
    return {
        groupBy: [...new Set([...positions.filter((field) => field.analyticType === 'dimension'), ...visualGroups].map((field) => field.fid))].sort(),
        measureColumns: [...new Set(measures.map((field) => field.fid))].sort(),
        ...(fold ? { unsupported: 'Boxplot statistics currently require explicit measure shelves; folded measure names and values are not supported.' }
            : aggregateExpression ? { unsupported: 'Boxplots require raw values; aggregate SQL expressions do not provide a raw sample.' }
            : aggregateFilter ? { unsupported: 'Boxplots currently support filters on raw rows; aggregate filters cannot be applied to the raw sample.' }
            : !measures.length ? { unsupported: 'Boxplots require a numeric measure shelf.' } : {}),
    };
}

const groupValue = (value: unknown): unknown => {
    if (value === null) return ['null'];
    if (typeof value === 'string' || typeof value === 'boolean') return [typeof value, value];
    if (typeof value === 'number' && Number.isFinite(value)) return ['number', Object.is(value, -0) ? 0 : value];
    if (Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === 'number' && Number.isFinite(item)))
        return ['interval', ...value];
    throw new TypeError('Boxplot group values must be present scalars or finite interval endpoints.');
};

/**
 * Calculate statistics once after the existing provider has returned the complete raw view.
 * Both the local worker and external providers use this same stage and quartile definition.
 * Null samples are omitted; malformed numbers fail instead of changing the sample silently.
 */
export function computeBoxplotStatistics(
    records: readonly IRow[],
    plan: BoxplotComputationPlan,
    workflow: readonly IDataQueryWorkflowStep[],
): BoxplotComputationResult {
    if (plan.unsupported) throw new Error(plan.unsupported);
    const queries = workflow.flatMap((step) => step.type === 'view' ? step.query : []);
    if (queries.length !== 1 || queries[0].op !== 'raw') throw new Error('Boxplot statistics require a complete raw query result, not aggregated values.');
    const declared = new Set(queries[0].fields);
    for (const field of [...plan.groupBy, ...plan.measureColumns])
        if (!declared.has(field)) throw new Error(`Boxplot result column ${JSON.stringify(field)} is not declared by the raw query.`);
    const groups = new Map<string, { representativeIndex: number; values: Map<string, Array<{ inputIndex: number; value: number }>> }>();
    records.forEach((record, inputIndex) => {
        const groupKey = JSON.stringify(plan.groupBy.map((field) => [field, groupValue(record[field])]));
        let group = groups.get(groupKey);
        if (!group) {
            group = { representativeIndex: inputIndex, values: new Map(plan.measureColumns.map((field) => [field, []])) };
            groups.set(groupKey, group);
        }
        for (const field of plan.measureColumns) {
            const value = record[field];
            if (value === null) continue;
            if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Boxplot row ${inputIndex} has an invalid numeric sample in ${JSON.stringify(field)}.`);
            group.values.get(field)!.push({ inputIndex, value });
        }
    });
    const result: BoxplotGroup[] = [];
    const emptyGroups = [...groups].filter(([, group]) => [...group.values.values()].every((samples) => !samples.length))
        .map(([groupKey, group]) => Object.freeze({ groupKey, representativeIndex: group.representativeIndex }));
    for (const [groupKey, group] of groups) for (const [measureColumn, samples] of group.values) {
        if (!samples.length) continue;
        const sorted = samples.map((sample) => sample.value).sort((a, b) => a - b);
        const q1 = quantileSorted(sorted, 0.25), median = quantileSorted(sorted, 0.5), q3 = quantileSorted(sorted, 0.75);
        const distance = 1.5 * (q3 - q1), lowerFence = q1 - distance, upperFence = q3 + distance;
        const lowerWhisker = sorted.find((value) => value >= lowerFence)!;
        let upperIndex = sorted.length - 1;
        while (sorted[upperIndex] > upperFence) upperIndex--;
        const upperWhisker = sorted[upperIndex];
        result.push(Object.freeze({
            groupKey, measureColumn, representativeIndex: group.representativeIndex, q1, median, q3, lowerWhisker, upperWhisker,
            outliers: Object.freeze(samples.filter((sample) => sample.value < lowerFence || sample.value > upperFence).map((sample) => Object.freeze({ ...sample }))),
        }));
    }
    return Object.freeze({ groups: Object.freeze(result), emptyGroups: Object.freeze(emptyGroups) });
}
