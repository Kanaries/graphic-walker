import { paneKey, pathKey, toTypedValue, typedValueKey } from './keys';
import type { AxisLeaf, DisplayDomain, DomainBatch, DomainKey, DomainRequest, PositionType, ReadVersion, RenderPlan, ResultBinding, TypedValue } from './types';

export function positionTypeFor(binding: ResultBinding): PositionType {
    return binding.positionType ?? (binding.valueType === 'number' || binding.valueType === 'interval' ? 'linear' : binding.valueType === 'time' ? 'time' : 'band');
}

export function barIsHorizontal(plan: RenderPlan, rowBinding?: ResultBinding): boolean {
    return plan.barOrientation === 'horizontal' || plan.barOrientation === undefined && !!rowBinding && positionTypeFor(rowBinding) === 'band';
}

/** A complete explicit domain does not depend on source statistics. One fixed endpoint still does. */
export function hasFixedDomain(plan: RenderPlan, fieldRef: string): boolean {
    const scale = plan.scales?.[fieldRef];
    if (!scale) return false;
    const binding = plan.bindings.find((candidate) => candidate.fieldRef === fieldRef);
    return scale.domain !== undefined || !!binding && positionTypeFor(binding) !== 'band' && scale.domainMin !== undefined && scale.domainMax !== undefined;
}

/** Validate prepared endpoints without binning, date parsing, or coercion. */
export function bindingTypedValue(binding: ResultBinding, value: unknown): TypedValue {
    if (binding.valueType !== 'interval') return toTypedValue(value, binding.valueType === 'time' || binding.positionType === 'time' ? 'time' : undefined);
    if (value === null) return { type: 'null' };
    if (!Array.isArray(value) || value.length !== 2 || value.some((endpoint) => typeof endpoint !== 'number' || !Number.isFinite(endpoint)) || value[0] > value[1]) throw new TypeError('Prepared intervals require two finite, ordered numeric endpoints.');
    const hint = binding.positionType === 'time' ? 'time' : undefined;
    const start = toTypedValue(value[0], hint);
    const end = toTypedValue(value[1], hint);
    if (start.type === 'interval' || end.type === 'interval') throw new TypeError('Interval endpoints must be scalar.');
    return { type: 'interval', start, end };
}

export function positionCoordinate(binding: ResultBinding, value: unknown): unknown {
    if (value === null || binding.valueType !== 'interval') return value;
    bindingTypedValue(binding, value);
    const [start, end] = value as readonly number[];
    return start / 2 + end / 2;
}

export function domainKeyFor(plan: RenderPlan, fieldRef: string, channel: DomainKey['channel'], row?: AxisLeaf, column?: AxisLeaf): DomainKey {
    const binding = plan.bindings.find((candidate) => candidate.fieldRef === fieldRef);
    if (!binding) throw new Error(`missing-binding: ${fieldRef}`);
    // Scopes affect position scales. Reusing a position field for color keeps color shared.
    const configured = channel === 'x' || channel === 'y' ? plan.scales?.[fieldRef]?.scope ?? { mode: 'shared' as const } : { mode: 'shared' as const };
    let scope: DomainKey['scope'] = { mode: 'shared' };
    if (configured.mode !== 'shared') {
        if (!row || !column) throw new Error('source-contract-violation: scoped domains require both axis leaves');
        if (configured.mode === 'pane') scope = { mode: 'pane', paneKey: paneKey(row.key, column.key) };
        else {
            const { rowDepth, columnDepth } = configured;
            if (!Number.isSafeInteger(rowDepth) || !Number.isSafeInteger(columnDepth) || rowDepth < 0 || columnDepth < 0 || rowDepth > plan.rows.facets.length || columnDepth > plan.columns.facets.length || rowDepth + columnDepth === 0) throw new Error('unsupported-encoding: invalid prefix depths');
            // A collapsed leaf ends before the requested depth. Its full visible path is its scope.
            scope = { mode: 'prefix', rowPrefix: row.path.slice(0, rowDepth), columnPrefix: column.path.slice(0, columnDepth) };
        }
    }
    return { fieldRef, channel, familyId: JSON.stringify([binding.bindingId, binding.valueType, binding.unitKey ?? null, positionTypeFor(binding), channel]), domainPlanKey: plan.domainPlanKey, scope };
}

export function domainStorageKey(key: DomainKey): string {
    if (key.scope.mode === 'shared') return key.fieldRef;
    const scope = key.scope.mode === 'pane' ? ['pane', key.scope.paneKey] : ['prefix', pathKey(key.scope.rowPrefix), pathKey(key.scope.columnPrefix)];
    return JSON.stringify(['scoped-domain', key.fieldRef, key.channel, key.familyId, key.domainPlanKey, scope]);
}

export function getDisplayDomain(plan: RenderPlan, fieldRef: string, channel: DomainKey['channel'], domains: DomainBatch, row?: AxisLeaf, column?: AxisLeaf): DisplayDomain | undefined {
    const key = domainKeyFor(plan, fieldRef, channel, row, column);
    const supplied = domains.domains[domainStorageKey(key)];
    if (!hasFixedDomain(plan, fieldRef)) return supplied;
    const binding = plan.bindings.find((candidate) => candidate.fieldRef === fieldRef)!;
    const scale = plan.scales![fieldRef], type = positionTypeFor(binding);
    let values: readonly unknown[] = scale.domain ?? [scale.domainMin, scale.domainMax];
    if (type === 'band') {
        const unique = new Set<string>();
        for (const value of values) {
            let encoded: string;
            try { encoded = typedValueKey(bindingTypedValue(binding, value)); }
            catch { throw new Error('invalid-domain: fixed band values must be prepared primitives'); }
            if (unique.has(encoded)) throw new Error('invalid-domain: duplicate fixed band value');
            unique.add(encoded);
        }
    } else {
        if (values.length !== 2) throw new Error('invalid-domain: fixed continuous domains require two endpoints');
        values = [scale.domainMin ?? values[0], scale.domainMax ?? values[1]];
        if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value)) || (values[0] as number) >= (values[1] as number)) throw new Error('invalid-domain: fixed endpoints must be finite and increasing');
        if (type === 'time' && values.some((value) => Math.abs(value as number) > 8_640_000_000_000_000)) throw new Error('invalid-domain: fixed time endpoints exceed Date range');
    }
    return {
        fieldRef, domainId: JSON.stringify(['fixed-domain', domains.version, plan.domainPlanKey, domainStorageKey(key), values]), type,
        values, complete: true, extentKind: 'value', empty: supplied?.empty ?? values.length === 0, source: 'fixed',
        ...(key.scope.mode === 'shared' ? {} : { key }),
    };
}

export function sharedDomainRefs(plan: RenderPlan): readonly string[] {
    const refs = new Set<string>();
    for (const ref of [...plan.rows.positions, ...plan.columns.positions]) if (!plan.scales?.[ref]?.scope || plan.scales[ref].scope!.mode === 'shared') refs.add(ref);
    for (const channel of ['color', 'size', 'opacity', 'shape'] as const) {
        const value = plan.channels?.[channel];
        if (value && 'fieldRef' in value) refs.add(value.fieldRef);
    }
    return [...refs].filter((ref) => !hasFixedDomain(plan, ref));
}

export function domainRequestForWindow(plan: RenderPlan, version: ReadVersion, rows: readonly AxisLeaf[], columns: readonly AxisLeaf[]): DomainRequest {
    const keys = new Map<string, DomainKey>();
    for (const row of rows) for (const column of columns) {
        for (const [ref, channel] of [[column.positionRef, 'x'], [row.positionRef, 'y']] as const) {
            if (!ref || hasFixedDomain(plan, ref)) continue;
            const key = domainKeyFor(plan, ref, channel, row, column);
            if (key.scope.mode !== 'shared') keys.set(domainStorageKey(key), key);
        }
    }
    return { version, fieldRefs: sharedDomainRefs(plan), keys: [...keys.values()] };
}

export function domainValueKey(binding: ResultBinding, value: unknown): string {
    return typedValueKey(bindingTypedValue(binding, value));
}
