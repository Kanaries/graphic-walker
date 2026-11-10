import { valueKey } from './keys';
import { resultKey, type ColorScale, type FieldInstance, type Row, type Value } from './types';

/**
 * Every color the sheet paints. The first six are the surface, text and rules; the rest
 * color the marks. A host passes its own to make the sheet follow its theme.
 */
export interface Theme {
    paper: string; text: string; muted: string; line: string; grid: string; zero: string;
    /** Color of marks when no field is on color. */
    mark: string;
    /** Colors of the members of a discrete color field, in legend order. Reused from the start when there are more members. */
    category: string[];
    /** Stops for a continuous color field whose range stays on one side of zero, from the value nearest zero to the furthest. */
    ramp: string[];
    /** Stops for a continuous color field whose range crosses zero, from the negative end through the middle to the positive end. */
    diverging: string[];
    /** Stops for the cells of a heat map, when they differ from `ramp`. */
    heatmap?: string[];
}
const marks = {
    mark: '#4263eb',
    category: ['#4263eb', '#e88739', '#169b8d', '#b46bd0', '#dc6275', '#809432', '#3689ab', '#8c6a52'],
    ramp: ['#cddef2', '#1c4a96'],
    diverging: ['#e27026', '#e0e0e0', '#2b6ab2'],
};
export const lightTheme: Theme = { paper: '#ffffff', text: '#344054', muted: '#667085', line: '#d9dfe9', grid: '#eef1f6', zero: '#c2c9d6', ...marks };
export const darkTheme: Theme = { paper: '#0b0c0e', text: '#e4e7ec', muted: '#98a2b3', line: '#30353f', grid: '#1b1e25', zero: '#4b5363', ...marks };
const missing = '#c8cdd6';

const parsed = new Map<string, [number, number, number]>();
/** Red, green and blue of a hex or rgb() color. Anything else reads as the missing-value grey. */
export function rgb(color: string): [number, number, number] {
    let value = parsed.get(color);
    if (!value) {
        const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
        const full = hex?.length === 3 ? [...hex].map(c => c + c).join('') : hex;
        const numbers = full ? [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) : (/^rgba?\(([^)]+)\)$/i.exec(color.trim())?.[1].split(/[\s,/]+/).slice(0, 3).map(Number) ?? []);
        value = numbers.length === 3 && numbers.every(Number.isFinite) ? [numbers[0], numbers[1], numbers[2]] : [200, 205, 214];
        if (parsed.size > 2000) parsed.clear();
        parsed.set(color, value);
    }
    return value;
}
/** The color at share t of a list of evenly spaced stops. */
function along(stops: string[], t: number): string {
    if (stops.length === 1) return stops[0];
    const at = Math.min(1, Math.max(0, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(at));
    const a = rgb(stops[i]), b = rgb(stops[i + 1]);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * (at - i))).join(',')})`;
}

/**
 * Color of a value on a continuous scale. A range on one side of zero runs along the ramp,
 * further from zero meaning further along it. A range that crosses zero runs along the
 * diverging stops with zero in the middle and both sides scaled by the larger magnitude.
 * `cells` picks the heat map stops where the theme has them.
 */
export function continuousColor(scale: ColorScale, value: number, theme: Theme = lightTheme, cells = false): string {
    if (!Number.isFinite(value)) return missing;
    const [low, high] = scale.domain;
    if (scale.diverging) {
        const reach = Math.max(Math.abs(low), Math.abs(high));
        return along(theme.diverging, .5 + value / reach / 2);
    }
    const t = high === low ? 1 : (value - low) / (high - low);
    return along(cells && theme.heatmap?.length ? theme.heatmap : theme.ramp, high <= 0 ? 1 - t : t);
}

/** Fill of a record, for a categorical color field, a continuous one, or none. */
export function fillOf(field: FieldInstance | undefined, colors: Value[], scale: ColorScale | undefined, theme: Theme = lightTheme, cells = false): (record: Row) => string {
    if (!field) return () => theme.mark;
    if (scale) return record => { const raw = record[resultKey(field)]; return continuousColor(scale, raw == null ? NaN : Number(raw), theme, cells); };
    const map = new Map(colors.map((c, i) => [valueKey(c), theme.category[i % theme.category.length]]));
    return record => map.get(valueKey(record[field.field])) ?? missing;
}
