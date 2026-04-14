import type { IRow } from '@kanaries/graphic-walker';

export type VLChannelDef = {
    field?: string;
    title?: string;
    type?: string;
    aggregate?: string | null;
    value?: unknown;
    stack?: string | null | boolean;
    sort?: unknown;
};

export type FieldBinding = {
    key?: string;
    title?: string;
    type?: string;
    value?: unknown;
    aggregate?: string | null;
    sort?: unknown;
    isDiscrete: boolean;
    isContinuous: boolean;
};

function decodeFieldKey(raw?: string): string | undefined {
    if (!raw) return undefined;
    return raw
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\(["'\.\[\]\/\\])/g, '$1');
}

export function resolveDataKey(data: readonly IRow[], channel?: VLChannelDef): string | undefined {
    const baseField = decodeFieldKey(channel?.field);
    if (!baseField) return undefined;

    const sample = (data[0] ?? {}) as Record<string, unknown>;
    const has = (key: string) => Object.prototype.hasOwnProperty.call(sample, key);

    const aggName = typeof channel?.aggregate === 'string' ? channel.aggregate : undefined;
    if (aggName && aggName !== 'expr') {
        const aggKey = `${baseField}_${aggName}`;
        if (has(aggKey)) return aggKey;
    }

    if (has(baseField)) return baseField;

    const prefixed = Object.keys(sample).find((k) => k.startsWith(`${baseField}_`));
    return prefixed ?? baseField;
}

export function getFieldTitle(channel?: VLChannelDef): string | undefined {
    if (!channel) return undefined;
    const fallback = decodeFieldKey(channel.field);
    const displayName = channel.title ?? fallback;
    if (!displayName) return undefined;

    const aggName = typeof channel.aggregate === 'string' ? channel.aggregate : undefined;
    if (aggName && aggName !== 'expr' && !displayName.includes('(')) {
        return `${aggName}(${displayName})`;
    }
    return displayName;
}

export function getFieldBinding(data: readonly IRow[], channel?: VLChannelDef): FieldBinding {
    const type = channel?.type;
    return {
        key: resolveDataKey(data, channel),
        title: getFieldTitle(channel),
        type,
        value: channel?.value,
        aggregate: channel?.aggregate,
        sort: channel?.sort,
        isDiscrete: type === 'nominal' || type === 'ordinal',
        isContinuous: type === 'quantitative' || type === 'temporal',
    };
}
