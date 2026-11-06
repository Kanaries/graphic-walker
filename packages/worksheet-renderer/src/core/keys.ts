import type { Axis, MemberPath, ScalarValue, TypedValue } from './types';

/** Canonical typed values preserve null, primitive type, and explicit time identity. */
export function toTypedValue(value: unknown, valueType?: 'time' | 'interval'): TypedValue {
    if (value === null) return { type: 'null' };
    if (valueType === 'interval') {
        if (!Array.isArray(value) || value.length !== 2) throw new TypeError('An interval must contain exactly two prepared endpoints.');
        const start = toTypedValue(value[0]);
        const end = toTypedValue(value[1]);
        if (start.type === 'interval' || end.type === 'interval') throw new TypeError('Nested intervals are not supported.');
        return { type: 'interval', start, end };
    }
    if (valueType === 'time') {
        if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 8_640_000_000_000_000) throw new TypeError('A prepared time value must be a finite epoch number within the JavaScript Date range.');
        return { type: 'time', value: Object.is(value, -0) ? 0 : value };
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('Member values must be finite.');
        return { type: 'number', value: Object.is(value, -0) ? 0 : value };
    }
    if (typeof value === 'string') return { type: 'string', value };
    if (typeof value === 'boolean') return { type: 'boolean', value };
    throw new TypeError('Member values must be null or a prepared primitive value.');
}

function scalarTuple(value: ScalarValue): readonly unknown[] {
    if (value.type === 'null') return ['null'];
    if ((value.type === 'number' || value.type === 'time') && !Number.isFinite(value.value)) throw new TypeError('Member values must be finite.');
    return [value.type, Object.is(value.value, -0) ? 0 : value.value];
}

export function typedValueTuple(value: TypedValue): readonly unknown[] {
    return value.type === 'interval' ? ['interval', scalarTuple(value.start), scalarTuple(value.end)] : scalarTuple(value);
}

export function typedValueKey(value: TypedValue): string {
    return JSON.stringify(typedValueTuple(value));
}

export function pathKey(path: MemberPath): string {
    return JSON.stringify(path.map((member) => [member.fieldRef, typedValueTuple(member.value)]));
}

export function headerKey(axis: Axis, path: MemberPath): string {
    return JSON.stringify(['header', axis, path.map((member) => [member.fieldRef, typedValueTuple(member.value)])]);
}

export function axisLeafKey(axis: Axis, path: MemberPath, slotId: string): string {
    return JSON.stringify(['leaf', axis, path.map((member) => [member.fieldRef, typedValueTuple(member.value)]), slotId]);
}

export function paneKey(rowKey: string, columnKey: string): string {
    return JSON.stringify(['pane', rowKey, columnKey]);
}

export function sameVersion(a: { sourceId: string; snapshotId: string; presentationId: string }, b: { sourceId: string; snapshotId: string; presentationId: string }): boolean {
    return a.sourceId === b.sourceId && a.snapshotId === b.snapshotId && a.presentationId === b.presentationId;
}

export function typedValueLabel(value: TypedValue): string {
    if (value.type === 'null') return '(null)';
    if (value.type === 'time') return new Date(value.value).toISOString();
    if (value.type === 'interval') return `${typedValueLabel(value.start)} – ${typedValueLabel(value.end)}`;
    return String(value.value);
}
