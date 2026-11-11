/**
 * How values are spread along an axis or a channel. 'linear' spreads them evenly. 'log'
 * gives every power of ten the same room and has no place for zero or negative values.
 * 'sqrt' and 'symlog' compress large values and keep zero and negative ones.
 */
export type ScaleType = 'linear' | 'log' | 'sqrt' | 'symlog';

interface Warp { to: (value: number) => number; from: (warped: number) => number }
const warps: Record<ScaleType, Warp> = {
    linear: { to: v => v, from: w => w },
    log: { to: v => v > 0 ? Math.log10(v) : NaN, from: w => 10 ** w },
    sqrt: { to: v => Math.sign(v) * Math.sqrt(Math.abs(v)), from: w => Math.sign(w) * w * w },
    symlog: { to: v => Math.sign(v) * Math.log1p(Math.abs(v)), from: w => Math.sign(w) * Math.expm1(Math.abs(w)) },
};

/** The two directions of a scale type: into the space where values are spread evenly, and back. */
export const warp = (type: ScaleType = 'linear'): Warp => warps[type];

/**
 * Where a value sits in a range, from 0 at its start to 1 at its end; outside that for a
 * value outside the range. NaN when the value has no place, such as zero on a log scale.
 */
export function position(domain: readonly [number, number], value: number, type: ScaleType = 'linear'): number {
    const { to } = warps[type];
    const low = to(domain[0]), high = to(domain[1]);
    return (to(value) - low) / (high - low);
}
/** The value at a share of a range. The inverse of `position`. */
export function valueAt(domain: readonly [number, number], share: number, type: ScaleType = 'linear'): number {
    const { to, from } = warps[type];
    const low = to(domain[0]), high = to(domain[1]);
    return from(low + (high - low) * share);
}

/**
 * Ticks for a log axis: the powers of ten in the range, and between them the multiples
 * 2 and 5 while there is room for them. A range inside one power of ten gets linear ticks.
 */
export function logTicks(min: number, max: number, wanted: number): number[] | undefined {
    const first = Math.ceil(Math.log10(min) - 1e-9), last = Math.floor(Math.log10(max) + 1e-9);
    const decades = last - first + 1;
    if (decades < 1 || (decades === 1 && Math.log10(max / min) < 1)) return undefined;
    // With many decades only every nth power is shown.
    const every = Math.max(1, Math.ceil(decades / Math.max(2, wanted)));
    const between = decades * 3 <= wanted ? [1, 2, 5] : [1];
    const ticks: number[] = [];
    for (let power = first - 1; power <= last; power++) {
        if (between.length === 1 && (power - first) % every) continue;
        for (const multiple of between) {
            const tick = Number((multiple * 10 ** power).toPrecision(12));
            if (tick >= min * (1 - 1e-9) && tick <= max * (1 + 1e-9)) ticks.push(tick);
        }
    }
    return ticks;
}
