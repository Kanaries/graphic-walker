import { format as numberFormat } from 'd3-format';
import { utcFormat } from 'd3-time-format';
import type { PositionType } from '../core/types';

const numberPattern = /^(\$?)(,?)(?:\.(\d{1,2}))?(~?)([f%segd])?$/;
const timeTokens = new Set(['Y', 'y', 'm', 'b', 'B', 'd', 'e', 'H', 'I', 'M', 'S', 'L', 'p', 'a', 'A', '%']);
export function validateFormat(format: string | undefined, type: PositionType = 'linear'): void {
    if (!format) return;
    if (type === 'time') {
        for (let i = 0; i < format.length; i++)
            if (format[i] === '%' && !timeTokens.has(format[++i])) throw new Error(`unsupported-encoding: time format ${format}`);
    } else {
        const parsed = numberPattern.exec(format);
        if (!parsed || (parsed[3] && Number(parsed[3]) > 20)) throw new Error(`unsupported-encoding: number format ${format}`);
    }
}
/** Explicit numeric formats use the same low-level formatter as Vega; dates use UTC. */
export function formatValue(value: unknown, type: PositionType = 'band', format?: string): string {
    if (value === null || value === undefined) return type === 'band' ? '∅' : '';
    validateFormat(format, type);
    if (type === 'time') {
        const date = new Date(Number(value));
        if (!Number.isFinite(date.getTime())) throw new Error('invalid-value: time label is outside Date range');
        return utcFormat(format ?? '%Y-%m-%d')(date);
    }
    if (typeof value !== 'number') return String(value);
    return format ? numberFormat(format)(value) : Number(value.toPrecision(4)).toLocaleString('en-US');
}

let context: OffscreenCanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
let widthBytes = 0;
export function textMetricsBytes(): number {
    return widthBytes;
}
/** One bounded metrics cache shared by both backends. It never creates a visible canvas. */
export function measureText(text: string, size = 11, fontFamily = 'sans-serif'): number {
    const key = `${size}:${fontFamily}:${text}`;
    const cached = widths.get(key);
    if (cached !== undefined) return cached;
    if (context === undefined) context = typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('2d');
    let result: number;
    if (context) {
        context.font = `${size}px ${fontFamily}`;
        result = context.measureText(text).width;
    } else
        result = Array.from(text).reduce(
            (sum, char) => sum + size * (/[^\u0000-\u00ff]/.test(char) ? 1 : /[ilI.,' ]/.test(char) ? 0.3 : 0.58),
            0,
        );
    if (text.length <= 2048 && fontFamily.length <= 256) {
        if (widths.size >= 4096) {
            const oldest = widths.keys().next().value!;
            widthBytes -= 128 + oldest.length * 2;
            widths.delete(oldest);
        }
        widths.set(key, result);
        widthBytes += 128 + key.length * 2;
    }
    return result;
}
export function fitText(text: string, width: number, size = 11, fontFamily = 'sans-serif'): string {
    if (width <= 0) return '';
    if (measureText(text, size, fontFamily) <= width) return text;
    const chars = Array.from(text),
        ellipsis = '…';
    if (measureText(ellipsis, size, fontFamily) > width) return '';
    let lo = 0,
        hi = chars.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (measureText(chars.slice(0, mid).join('') + ellipsis, size, fontFamily) <= width) lo = mid;
        else hi = mid - 1;
    }
    return chars.slice(0, lo).join('') + ellipsis;
}

/** Call after host fonts change so both backends use fresh shared measurements. */
export function clearTextMetrics(): void {
    widths.clear();
    widthBytes = 0;
}
