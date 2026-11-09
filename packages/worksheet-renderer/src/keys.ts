import type { PathPart, Value } from './types';

export function typed(value: Value): [string, string | number | boolean | null] {
    if (value === null) return ['null', null];
    if (value === undefined) return ['undefined', null];
    if (typeof value === 'number' && !Number.isFinite(value)) return ['number', String(value)];
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error('Worksheet V0 requires scalar dimension values.');
    return [typeof value, value];
}
export const valueKey = (value: Value) => JSON.stringify(typed(value));
export const pathKey = (axis: 'row' | 'column', path: PathPart[]) => JSON.stringify([axis, path.map(p => [p.instanceId, typed(p.value)])]);
export const displayValue = (value: Value) => value == null ? '(null)' : String(value);
export function compareValue(a: Value, b: Value): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return displayValue(a).localeCompare(displayValue(b), undefined, { numeric: true }) || valueKey(a).localeCompare(valueKey(b));
}
