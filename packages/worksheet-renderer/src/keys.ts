import type { PathPart, Value } from './types';

export function typed(value: Value): [string, string | number | boolean | null] {
    if (value === null) return ['null', null];
    if (value === undefined) return ['undefined', null];
    if (typeof value === 'number' && !Number.isFinite(value)) return ['number', String(value)];
    if (value instanceof Date) return ['time', value.getTime()];
    if (isRange(value)) return ['range', value.join('|')];
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error('Worksheet V0 requires scalar dimension values.');
    return [typeof value, value];
}
export const valueKey = (value: Value) => JSON.stringify(typed(value));
export const pathKey = (axis: 'row' | 'column', path: PathPart[]) => JSON.stringify([axis, path.map(p => [p.instanceId, typed(p.value)])]);
const rangeNumber = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
/** A bin, as binned fields return it: the lower and upper bound of the member. */
export function isRange(value: unknown): value is readonly number[] {
    return Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'number');
}
export const displayValue = (value: Value) => value == null ? '(null)' : isRange(value) ? value.map(v => rangeNumber.format(v)).join(' – ') : value instanceof Date ? (Number.isNaN(value.getTime()) ? '(invalid date)' : value.toISOString().replace(/T00:00:00\.000Z$/, '')) : String(value);
export function compareValue(a: Value, b: Value): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
    if (isRange(a) && isRange(b)) return a[0] - b[0] || (a[1] ?? 0) - (b[1] ?? 0);
    return displayValue(a).localeCompare(displayValue(b), undefined, { numeric: true }) || valueKey(a).localeCompare(valueKey(b));
}
