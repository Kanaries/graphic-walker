import type { IRow, IViewField } from '../interfaces';
import { getTimeFormat } from './inferMeta';
import { unexceptedUTCParsedPatternFormats } from './op/offset';

export interface TemporalDisplayOptions {
    readonly fieldOffset?: number;
    readonly displayOffset?: number;
    /** Capture once per prepared result so every field uses the same host offset. */
    readonly localOffset?: number;
}

/** Parse one completed result value into a display coordinate; no expressions run here. */
export function prepareTemporalValue(value: unknown, options: TemporalDisplayOptions): number | null {
    const localOffset = options.localOffset ?? new Date().getTimezoneOffset();
    const displayOffset = options.displayOffset ?? localOffset;
    const fieldOffset = options.fieldOffset ?? localOffset;
    if (![localOffset, displayOffset, fieldOffset].every(Number.isFinite)) throw new TypeError('Time offsets must be finite numbers.');
    if (value === null) return null;
    if (typeof value !== 'string' && typeof value !== 'number') throw new TypeError('Time results must be a string, finite timestamp, or null.');
    let offset = -displayOffset * 60000;
    const format = getTimeFormat(value);
    if (format !== 'timestamp') {
        offset += fieldOffset * 60000;
        if (!unexceptedUTCParsedPatternFormats.includes(format)) offset -= localOffset * 60000;
    }
    const parsed = typeof value === 'number' ? value : new Date(value).getTime();
    const coordinate = parsed + offset;
    if (!Number.isFinite(coordinate) || Math.abs(coordinate) > 8_640_000_000_000_000)
        throw new TypeError('Time result cannot be parsed to a finite display coordinate within the JavaScript Date range.');
    return coordinate;
}

export interface TemporalColumnInput {
    readonly dataSource: readonly IRow[];
    readonly fields: readonly IViewField[];
    readonly displayOffset?: number;
    readonly localOffset?: number;
}

/** Host-only mappings accompany the prepared data; they are not part of a chart/spec. */
export interface TemporalColumns {
    readonly dataSource: readonly IRow[];
    readonly fields: readonly IViewField[];
    readonly rawFieldsByDisplay: ReadonlyMap<string, string>;
}

/**
 * Keep raw result columns and add collision-free display columns for temporal
 * dimensions. Each distinct fid/offset pair is converted once, independent of row
 * order. Measure values and existing timeUnit declarations remain unchanged.
 */
export function prepareTemporalColumns(input: TemporalColumnInput): TemporalColumns {
    if (!input.fields.some((field) => field.semanticType === 'temporal' && field.analyticType !== 'measure')) {
        return { dataSource: input.dataSource, fields: input.fields, rawFieldsByDisplay: new Map() };
    }
    const localOffset = input.localOffset ?? new Date().getTimezoneOffset();
    const reserved = new Set(input.fields.map((field) => field.fid));
    for (const record of input.dataSource) for (const key of Object.keys(record)) reserved.add(key);
    const rawFieldsByDisplay = new Map<string, string>();
    const aliases = new Map<string, string>();
    let records: IRow[] | undefined;
    let nextAlias = 0;
    const fields = input.fields.map((field) => {
        if (field.semanticType !== 'temporal' || field.analyticType === 'measure') return field;
        const options = { fieldOffset: field.offset, displayOffset: input.displayOffset, localOffset };
        prepareTemporalValue(null, options); // Validate offsets even for empty results.
        const signature = JSON.stringify([field.fid, field.offset ?? localOffset, input.displayOffset ?? localOffset]);
        let alias = aliases.get(signature);
        if (!alias) {
            do {
                alias = `__gw_time_${nextAlias++}`;
            } while (reserved.has(alias));
            reserved.add(alias);
            aliases.set(signature, alias);
            rawFieldsByDisplay.set(alias, field.fid);
            records ??= input.dataSource.map((record) => ({ ...record }));
            for (let index = 0; index < records.length; index++) {
                try {
                    const raw = input.dataSource[index][field.fid];
                    // Legacy JS data sources accept Date objects. Their former
                    // non-timestamp branch used the same offsets as ISO strings.
                    // Keep the Date in the raw column and reject invalid dates.
                    const value = raw instanceof Date ? raw.toISOString() : raw;
                    records[index][alias] = prepareTemporalValue(value, options);
                } catch (error) {
                    throw new TypeError(`Temporal field ${JSON.stringify(field.fid)}, row ${index}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        return { ...field, fid: alias };
    });
    return { dataSource: records ?? input.dataSource, fields, rawFieldsByDisplay };
}
