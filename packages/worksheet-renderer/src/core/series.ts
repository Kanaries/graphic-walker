import { bindingTypedValue, positionTypeFor } from './domains';
import { typedValueTuple } from './keys';
import type { PreparedRecord, RenderPlan } from './types';

export function needsSeriesDomain(plan: RenderPlan): boolean {
    return plan.mark === 'line' || plan.barLayout === 'grouped' || plan.mark === 'bar' && plan.stack === 'zero';
}

/** Identity of an actual color/details/shape tuple, independent of window order. */
export function seriesIdentityFor(plan: RenderPlan, values: PreparedRecord): string {
    const refs = [...(plan.channels?.details ?? [])];
    const color = plan.channels?.color;
    if (color && 'fieldRef' in color && positionTypeFor(plan.bindings.find((binding) => binding.fieldRef === color.fieldRef)!) === 'band') refs.unshift(color.fieldRef);
    const shape = plan.channels?.shape;
    if (plan.mark === 'point' && shape && 'fieldRef' in shape) refs.push(shape.fieldRef);
    return JSON.stringify(['series', [...new Set(refs)].map((ref) => {
        const binding = plan.bindings.find((candidate) => candidate.fieldRef === ref);
        if (!binding || !Object.prototype.hasOwnProperty.call(values, binding.columnKey) || values[binding.columnKey] === undefined) throw new Error(`missing-binding: series field ${ref}`);
        return [ref, typedValueTuple(bindingTypedValue(binding, values[binding.columnKey]))];
    })]);
}

export function seriesKeyFor(pane: string, identity: string): string {
    return JSON.stringify(['pane-series', pane, identity]);
}
