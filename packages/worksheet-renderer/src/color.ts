import { valueKey } from './keys';
import { resultKey, type ColorScale, type FieldInstance, type Row, type Value } from './types';

export const palette = ['#4263eb', '#e88739', '#169b8d', '#b46bd0', '#dc6275', '#809432', '#3689ab', '#8c6a52'];
const missing = '#c8cdd6';
const light = [205, 222, 242], dark = [28, 74, 150];
const negative = [226, 112, 38], middle = [224, 224, 224], positive = [43, 106, 178];
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, Math.max(0, t)))).join(',')})`;

/**
 * Color of a value on a continuous scale. A range on one side of zero runs from light to
 * dark, darker meaning further from zero. A range that crosses zero diverges from a
 * neutral middle, with both sides scaled by the larger magnitude.
 */
export function continuousColor(scale: ColorScale, value: number): string {
    if (!Number.isFinite(value)) return missing;
    const [low, high] = scale.domain;
    if (scale.diverging) {
        const reach = Math.max(Math.abs(low), Math.abs(high));
        return value >= 0 ? mix(middle, positive, value / reach) : mix(middle, negative, -value / reach);
    }
    const t = high === low ? 1 : (value - low) / (high - low);
    return mix(light, dark, high <= 0 ? 1 - t : t);
}

/** Fill of a record, for a categorical color field, a continuous one, or none. */
export function fillOf(field: FieldInstance | undefined, colors: Value[], scale: ColorScale | undefined): (record: Row) => string {
    if (!field) return () => palette[0];
    if (scale) return record => { const raw = record[resultKey(field)]; return continuousColor(scale, raw == null ? NaN : Number(raw)); };
    const map = new Map(colors.map((c, i) => [valueKey(c), palette[i % palette.length]]));
    return record => map.get(valueKey(record[field.field])) ?? missing;
}
