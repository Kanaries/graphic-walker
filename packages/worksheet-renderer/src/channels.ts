import { valueKey } from './keys';
import { resultKey, type FieldInstance, type Row, type Value } from './types';

/**
 * What a field on size or opacity spans. A dimension has members, ranked in value order; a
 * continuous field has a range. Both come from the complete result, like an axis range.
 */
export interface ChannelScale {
    field: FieldInstance;
    members?: Value[];
    domain?: [number, number];
}
/** One block of the legend strip: a title and what explains one channel. */
export interface LegendBlock {
    channel: 'color' | 'size' | 'opacity' | 'shape';
    title: string;
    /** 'ramp' is a continuous color band from the first entry to the last; 'list' has one row per entry. */
    kind: 'list' | 'ramp';
    /** `level` is where the entry sits on its channel, from 0 to 1. */
    entries: { label: string; level: number }[];
    /** Height of one row of a list. */
    step: number;
    height: number;
}
export const legendTitleHeight = 28;

/**
 * Where a record sits on a channel, from 0 to 1. NaN when it has no value there.
 * A member's level is its rank, so the first member is already above zero. A continuous
 * value is placed in its range; `fromZero` measures it from zero instead when the whole
 * range is on one side of zero, which is what makes a size read as a quantity.
 */
export function level(scale: ChannelScale, record: Row, fromZero = false): number {
    if (scale.members) {
        const index = memberIndex(scale, record[scale.field.field]);
        return index < 0 ? NaN : (index + 1) / scale.members.length;
    }
    const raw = record[resultKey(scale.field)];
    return raw == null ? NaN : levelOf(scale, Number(raw), fromZero);
}
export function levelOf(scale: ChannelScale, value: number, fromZero = false): number {
    if (!Number.isFinite(value) || !scale.domain) return NaN;
    let [low, high] = scale.domain;
    if (fromZero && low >= 0) low = 0;
    else if (fromZero && high <= 0) [low, high] = [0, low];
    // A range of one value puts everything at the top.
    return high === low ? 1 : Math.min(1, Math.max(0, (value - low) / (high - low)));
}
const indices = new WeakMap<ChannelScale, Map<string, number>>();
export function memberIndex(scale: ChannelScale, value: Value): number {
    let index = indices.get(scale);
    if (!index) indices.set(scale, index = new Map(scale.members!.map((member, i) => [valueKey(member), i])));
    return index.get(valueKey(value)) ?? -1;
}

/** Symbol outlines in the order members take them. They start over when the members outnumber them. */
export const shapes = ['circle', 'square', 'triangle-up', 'diamond', 'cross', 'triangle-down', 'triangle-right', 'triangle-left'] as const;
/** Area of a point mark at a size level, in square px. */
export const pointArea = (t: number) => 12 + t * 244;
/** Share of the default thickness a bar or the default length a tick takes at a size level. */
export const thicknessShare = (t: number) => 0.25 + 0.75 * t;
/** Opacity at an opacity level. The faintest mark stays readable. */
export const opacityAt = (t: number) => 0.25 + 0.75 * t;
