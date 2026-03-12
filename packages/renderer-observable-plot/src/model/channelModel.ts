import type { IRow } from '@kanaries/graphic-walker';
import { getFieldBinding, type FieldBinding, type VLChannelDef } from './fieldBinding';

export type ChannelModel = {
    x: FieldBinding;
    y: FieldBinding;
    row: FieldBinding;
    column: FieldBinding;
    color: FieldBinding;
    opacity: FieldBinding;
    size: FieldBinding;
    shape: FieldBinding;
    text: FieldBinding;
    theta: FieldBinding;
    radius: FieldBinding;
    details: FieldBinding[];
};

export type VegaLiteLikeSpec = {
    encoding?: Record<string, VLChannelDef | VLChannelDef[]>;
};

function asChannelDef(value: unknown): VLChannelDef | undefined {
    if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
    return value as VLChannelDef;
}

function asChannelArray(value: unknown): VLChannelDef[] {
    if (!Array.isArray(value)) return [];
    return value.filter((x): x is VLChannelDef => Boolean(x && typeof x === 'object'));
}

export function buildChannelModel(data: readonly IRow[], spec: VegaLiteLikeSpec): ChannelModel {
    const encoding = spec.encoding ?? {};
    return {
        x: getFieldBinding(data, asChannelDef(encoding.x)),
        y: getFieldBinding(data, asChannelDef(encoding.y)),
        row: getFieldBinding(data, asChannelDef(encoding.row)),
        column: getFieldBinding(data, asChannelDef(encoding.column)),
        color: getFieldBinding(data, asChannelDef(encoding.color)),
        opacity: getFieldBinding(data, asChannelDef(encoding.opacity)),
        size: getFieldBinding(data, asChannelDef(encoding.size)),
        shape: getFieldBinding(data, asChannelDef(encoding.shape)),
        text: getFieldBinding(data, asChannelDef(encoding.text)),
        theta: getFieldBinding(data, asChannelDef(encoding.theta)),
        radius: getFieldBinding(data, asChannelDef(encoding.radius)),
        details: asChannelArray(encoding.tooltip).map((channel) => getFieldBinding(data, channel)),
    };
}
