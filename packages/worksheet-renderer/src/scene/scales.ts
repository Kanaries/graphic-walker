import type { DisplayDomain, ScaleOptions } from '../core/types';
import { toTypedValue, typedValueKey } from '../core/keys';

/** Resolve display overrides identically for complete and external windowed sources. */
export function resolveDomainValues(domain: DisplayDomain, options: ScaleOptions = {}): readonly unknown[] {
    const supplied = options.domain ?? domain.values;
    if (domain.type === 'band') {
        const seen = new Set<string>();
        for (const value of supplied) {
            let key: string;
            try {
                key = typedValueKey(toTypedValue(value));
            } catch {
                throw new Error('invalid-domain: band values must be prepared primitives');
            }
            if (seen.has(key)) throw new Error('invalid-domain: duplicate band value');
            seen.add(key);
        }
        return supplied;
    }
    if (supplied.length !== 2 || supplied.some((v) => typeof v !== 'number' || !Number.isFinite(v)))
        throw new Error('invalid-domain: finite endpoints required');
    let lo = options.domainMin ?? Number(supplied[0]),
        hi = options.domainMax ?? Number(supplied[1]);
    if (![lo, hi].every(Number.isFinite) || lo > hi) throw new Error('invalid-domain: endpoints must be finite and ordered');
    if (domain.type === 'time' && [lo, hi].some((value) => Math.abs(value) > 8_640_000_000_000_000))
        throw new Error('invalid-domain: time endpoints exceed Date range');
    const fixedLo = options.domain !== undefined || options.domainMin !== undefined;
    const fixedHi = options.domain !== undefined || options.domainMax !== undefined;
    if (options.zero && domain.type === 'linear') {
        if (!fixedLo) lo = Math.min(0, lo);
        if (!fixedHi) hi = Math.max(0, hi);
    }
    if (lo === hi) {
        if (fixedLo && fixedHi) throw new Error('invalid-domain: fixed endpoints must have positive span');
        const padding = Math.max(1, Math.abs(lo) * 0.01);
        const bound = domain.type === 'time' ? 8_640_000_000_000_000 : Number.MAX_VALUE;
        if (!fixedLo) lo = Math.max(-bound, lo - padding);
        if (!fixedHi) hi = Math.min(bound, hi + padding);
    }
    if (options.nice) {
        const raw = (hi - lo) / 5,
            power = 10 ** Math.floor(Math.log10(raw)),
            ratio = raw / power;
        const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * power;
        if (step > 0 && Number.isFinite(step)) {
            if (!fixedLo) lo = Math.floor(lo / step) * step;
            if (!fixedHi) hi = Math.ceil(hi / step) * step;
        }
    }
    if (domain.type === 'time') {
        lo = Math.max(-8_640_000_000_000_000, lo);
        hi = Math.min(8_640_000_000_000_000, hi);
    }
    if (!Number.isFinite(hi - lo) || lo >= hi) throw new Error('invalid-domain: range cannot be represented safely');
    return [lo, hi];
}

export interface PositionScale {
    type: 'band' | 'linear' | 'time';
    values: readonly unknown[];
    map(value: unknown): number;
    bandwidth: number;
    ticks(count?: number): readonly unknown[];
}
export function createPositionScale(
    domain: DisplayDomain | undefined,
    options: ScaleOptions | undefined,
    start: number,
    end: number,
): PositionScale {
    if (!domain) return { type: 'band', values: [null], map: () => (start + end) / 2, bandwidth: Math.abs(end - start), ticks: () => [] };
    if (!domain.complete || domain.source === 'unavailable') throw new Error('domain-unavailable: complete domain required');
    const values = resolveDomainValues(domain, options);
    let a = start,
        b = end;
    if (options?.range) {
        if (options.range.length !== 2 || options.range.some((value) => typeof value !== 'number' || !Number.isFinite(value)))
            throw new Error('unsupported-encoding: position range needs two finite pixel offsets');
        const origin = Math.min(start, end);
        a = origin + Number(options.range[0]);
        b = origin + Number(options.range[1]);
    }
    if (options?.reverse) [a, b] = [b, a];
    const ranks = domain.type === 'band' ? new Map(values.map((value, index) => [typedValueKey(toTypedValue(value)), index])) : undefined;
    const lo = Number(values[0]),
        hi = Number(values[1]);
    return {
        type: domain.type,
        values,
        bandwidth: domain.type === 'band' ? Math.abs(b - a) / Math.max(1, values.length) : 0,
        map(value) {
            if (ranks) {
                let index: number | undefined;
                try {
                    index = ranks.get(typedValueKey(toTypedValue(value)));
                } catch {
                    return NaN;
                }
                return index === undefined ? NaN : a + ((index + 0.5) / Math.max(1, values.length)) * (b - a);
            }
            if (typeof value !== 'number' || !Number.isFinite(value)) return NaN;
            const span = hi - lo,
                difference = value - lo;
            const fraction = Number.isFinite(difference) ? difference / span : value / span - lo / span;
            const pixel = a + fraction * (b - a);
            if (!Number.isFinite(pixel)) throw new Error('resource-limit: position cannot be represented in finite pixel coordinates');
            return pixel;
        },
        ticks(count = 3) {
            const n = Math.max(1, Math.min(100, Math.round(count)));
            if (domain.type === 'band') {
                const stride = Math.max(1, Math.ceil(values.length / n));
                return values.filter((_, i) => i % stride === 0);
            }
            return n === 1 ? [lo / 2 + hi / 2] : Array.from({ length: n }, (_, i) => lo + (hi - lo) * (i / (n - 1)));
        },
    };
}

export function numericChannel(
    value: unknown,
    domain: DisplayDomain,
    options: ScaleOptions | undefined,
    range: readonly [number, number],
): number {
    if (value === null) return 0;
    const extent = resolveDomainValues(domain, options),
        lo = Number(extent[0]),
        hi = Number(extent[1]);
    const configured = options?.range ?? range;
    if (configured.length !== 2 || configured.some((value) => typeof value !== 'number' || !Number.isFinite(value)))
        throw new Error('unsupported-encoding: numeric channel range needs two finite values');
    let t = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, (value - lo) / (hi - lo))) : 0;
    if (options?.reverse) t = 1 - t;
    return Number(configured[0]) + (Number(configured[1]) - Number(configured[0])) * t;
}
const colors: Record<string, string> = {
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    black: '#000000',
    white: '#ffffff',
    orange: '#ffa500',
    purple: '#800080',
    gray: '#808080',
    grey: '#808080',
    yellow: '#ffff00',
    pink: '#ffc0cb',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    transparent: '#ffffff',
};
function rgb(color: string): readonly number[] {
    const value = colors[color.toLowerCase()] ?? color;
    const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
    if (short) return short.slice(1).map((x) => parseInt(x + x, 16));
    const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
    if (hex) return hex.slice(1).map((x) => parseInt(x, 16));
    const channels = /^rgb\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)$/i.exec(value);
    if (channels && channels.slice(1).every((x) => Number(x) <= 255)) return channels.slice(1).map(Number);
    throw new Error(`unsupported-encoding: continuous palette color ${color}`);
}
export const defaultPalette = ['#2563eb', '#f97316', '#16a34a', '#9333ea', '#dc2626', '#0891b2'];
export function createColorEncoder(
    domain: DisplayDomain,
    options?: ScaleOptions,
    palette: readonly string[] = defaultPalette,
): (value: unknown) => string {
    const range = options?.range ?? palette;
    if (!range.length || range.some((value) => typeof value !== 'string'))
        throw new Error('unsupported-encoding: color range needs color strings');
    const values = resolveDomainValues(domain, options);
    if (domain.type === 'band') {
        const ranks = new Map(values.map((value, index) => [typedValueKey(toTypedValue(value)), index]));
        return (value) => {
            const rank = ranks.get(typedValueKey(toTypedValue(value)));
            if (rank === undefined) return '#94a3b8';
            const ordinal = options?.reverse ? values.length - 1 - rank : rank;
            return String(range[ordinal % range.length]);
        };
    }
    const colorsToUse = options?.range ?? (palette === defaultPalette ? ['#dbeafe', '#1d4ed8'] : palette);
    const channels = colorsToUse.map((value) => rgb(String(value)));
    const lo = Number(values[0]),
        hi = Number(values[1]);
    return (value) => {
        if (value === null) return '#94a3b8';
        let t = Math.max(0, Math.min(1, (Number(value) - lo) / (hi - lo)));
        if (options?.reverse) t = 1 - t;
        const offset = t * (channels.length - 1),
            index = Math.min(Math.floor(offset), channels.length - 1),
            fraction = offset - index;
        const start = channels[index],
            end = channels[Math.min(index + 1, channels.length - 1)];
        return `rgb(${start.map((value, i) => Math.round(value + (end[i] - value) * fraction)).join(',')})`;
    };
}
export function colorChannel(value: unknown, domain: DisplayDomain, options?: ScaleOptions, palette?: readonly string[]): string {
    return createColorEncoder(domain, options, palette)(value);
}
