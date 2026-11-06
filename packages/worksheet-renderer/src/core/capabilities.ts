import type { RenderPlan } from './types';

/** Fail explicitly at the independent package boundary, not just in the GW adapter. */
export function assertS0Capabilities(plan: RenderPlan): void {
    const fail = (path: string) => {
        throw new Error(`unsupported-encoding: ${path} is not supported in S0`);
    };
    if (plan.mark !== 'bar' && plan.mark !== 'point') fail('mark');
    if (plan.barLayout === 'grouped') fail('barLayout');
    const bindings = new Map(plan.bindings.map((b) => [b.fieldRef, b]));
    if (bindings.size !== plan.bindings.length) throw new Error('source-contract-violation: duplicate fieldRef');
    for (const ref of [
        ...plan.rows.facets,
        ...plan.rows.positions,
        ...plan.columns.facets,
        ...plan.columns.positions,
        ...(plan.channels?.details ?? []),
    ]) {
        if (!bindings.has(ref)) throw new Error(`missing-binding: ${ref}`);
    }
    for (const name of ['size', 'opacity', 'shape', 'text'] as const) if (plan.channels?.[name] !== undefined) fail(`channels.${name}`);
    const color = plan.channels?.color;
    if (color && 'fieldRef' in color) {
        const binding = bindings.get(color.fieldRef);
        if (!binding) throw new Error(`missing-binding: ${color.fieldRef}`);
        if (
            (binding.positionType ?? (binding.valueType === 'number' ? 'linear' : binding.valueType === 'time' ? 'time' : 'band')) !==
            'band'
        )
            fail('channels.color.continuous');
    }
    for (const [ref, scale] of Object.entries(plan.scales ?? {})) {
        const binding = bindings.get(ref);
        if (!binding) throw new Error(`missing-binding: ${ref}`);
        if (scale.scope && scale.scope.mode !== 'shared') fail(`scales.${ref}.scope`);
        if (scale.nice || scale.range !== undefined) fail(`scales.${ref}`);
        if (scale.type && scale.type !== binding.positionType) fail(`scales.${ref}.type`);
    }
    for (const [ref, axis] of Object.entries(plan.axes ?? {}))
        if (Object.values(axis).some((value) => value !== undefined)) fail(`axes.${ref}`);
    for (const [name, value] of Object.entries(plan.style ?? {}))
        if (value !== undefined && !['color', 'background'].includes(name)) fail(`style.${name}`);
}
