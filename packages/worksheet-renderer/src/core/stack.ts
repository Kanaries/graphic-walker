import { bindingTypedValue, positionTypeFor } from './domains';
import { toTypedValue, typedValueKey } from './keys';
import { PreparedDataError } from './errors';
import type { PaneRecord, ResultBinding } from './types';

export type BarStackState = Map<string, { positive: number; negative: number }>;
export interface StackEndpoint { start: number; end: number }

/** Diverging zero layout shared by streaming domain preparation and scene construction. */
export function advanceBarStack(stacks: BarStackState, position: unknown, value: number): StackEndpoint {
    const key = position === undefined ? '["default-position"]' : typedValueKey(toTypedValue(position, Array.isArray(position) ? 'interval' : undefined));
    const state = stacks.get(key) ?? { positive: 0, negative: 0 };
    const start = value >= 0 ? state.positive : state.negative;
    const end = start + value;
    if (!Number.isFinite(end)) throw new PreparedDataError('invalid-value', 'Stacked rendering endpoints must remain finite.');
    if (value >= 0) state.positive = end;
    else state.negative = end;
    stacks.set(key, state);
    return { start, end };
}

/** Pixel-position preparation only: original values and datum identities remain untouched.
 * Zero preserves signs. Normalize and center follow magnitude-stack semantics.
 * All-zero groups stay at zero; overflowing totals fail before any frame is committed.
 */
export function computeStackEndpoints(
    records: readonly PaneRecord[], valueBinding: ResultBinding, positionBinding: ResultBinding | undefined,
    mode: 'zero' | 'normalize' | 'center',
): ReadonlyMap<string, StackEndpoint> {
    const ordered = [...records].sort((a, b) => (a.seriesOrdinal ?? 0) - (b.seriesOrdinal ?? 0) || a.ordinal - b.ordinal);
    const result = new Map<string, StackEndpoint>();
    const groups = new Map<string, { records: { record: PaneRecord; value: number }[]; total: number }>();
    const zero: BarStackState = new Map();
    let maximum = 0;
    for (const record of ordered) {
        const value = record.values[valueBinding.columnKey];
        const position = positionBinding ? record.values[positionBinding.columnKey] : undefined;
        if (value === null || position === null && positionBinding && positionTypeFor(positionBinding) !== 'band') continue;
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new PreparedDataError('invalid-value', 'Stack values must be finite prepared numbers or null.', valueBinding.fieldRef);
        if (mode === 'zero') { result.set(record.datumKey, advanceBarStack(zero, position, value)); continue; }
        const key = positionBinding ? typedValueKey(bindingTypedValue(positionBinding, position)) : '["default-position"]';
        let group = groups.get(key);
        if (!group) { group = { records: [], total: 0 }; groups.set(key, group); }
        group.records.push({ record, value });
        group.total += Math.abs(value);
        if (!Number.isFinite(group.total)) throw new PreparedDataError('invalid-value', 'Stacked rendering totals must remain finite.', valueBinding.fieldRef);
        maximum = Math.max(maximum, group.total);
    }
    for (const group of groups.values()) {
        const baseline = mode === 'center' ? (maximum - group.total) / 2 : 0;
        let sum = 0;
        for (const { record, value } of group.records) {
            const start = mode === 'normalize' ? (group.total ? sum / group.total : 0) : baseline + sum;
            sum += Math.abs(value);
            const end = mode === 'normalize' ? (group.total ? sum / group.total : 0) : baseline + sum;
            if (!Number.isFinite(start) || !Number.isFinite(end)) throw new PreparedDataError('invalid-value', 'Stacked rendering endpoints must remain finite.');
            result.set(record.datumKey, { start, end });
        }
    }
    return result;
}
