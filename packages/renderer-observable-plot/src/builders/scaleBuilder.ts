import type { IRow } from '@kanaries/graphic-walker';
import type { ChannelModel } from '../model/channelModel';
import { isScatterLikeGeom } from '../model/geomModel';
import { getContinuousPalette, getDiscretePalette } from '../colorDefaults';

type VCfg = Record<string, any>;
type AxisFieldModel = Pick<ChannelModel['x'], 'type' | 'zero' | 'isDiscrete' | 'key'>;

function hexToRgb(hex: string): [number, number, number] | null {
    const normalized = hex.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
    const n = Number.parseInt(normalized, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixWithWhite(hex: string, t: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const mix = (channel: number) => Math.round(channel * (1 - t) + 255 * t);
    return `rgb(${mix(rgb[0])}, ${mix(rgb[1])}, ${mix(rgb[2])})`;
}

function temporalAxisType(type?: string): 'utc' | undefined {
    return type === 'temporal' ? 'utc' : undefined;
}

function uniqueDomain(data: readonly IRow[], key?: string): unknown[] | undefined {
    if (!key) return undefined;
    const values = Array.from(new Set(data.map((row) => row[key])));
    return values.length > 0 ? values : undefined;
}

function compareValue(a: unknown, b: unknown): number {
    const aNum = typeof a === 'number' ? a : Number(a);
    const bNum = typeof b === 'number' ? b : Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    const aTs = a instanceof Date ? a.getTime() : Date.parse(String(a));
    const bTs = b instanceof Date ? b.getTime() : Date.parse(String(b));
    if (Number.isFinite(aTs) && Number.isFinite(bTs)) return aTs - bTs;
    return String(a ?? '').localeCompare(String(b ?? ''));
}

function orderedDomain(data: readonly IRow[], key?: string, sort?: unknown): unknown[] | undefined {
    const domain = uniqueDomain(data, key);
    if (!domain || domain.length <= 1) return domain;
    if (Array.isArray(sort)) {
        const order = new Map(sort.map((value, index) => [String(value), index]));
        return [...domain].sort((a, b) => (order.get(String(a)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b)) ?? Number.MAX_SAFE_INTEGER));
    }
    if (sort === 'ascending') {
        return [...domain].sort(compareValue);
    }
    if (sort === 'descending') {
        return [...domain].sort((a, b) => compareValue(b, a));
    }
    return [...domain].sort(compareValue);
}

function constrainedQuantDomain(data: readonly IRow[], key?: string): [number, number] | undefined {
    if (!key) return undefined;
    const values = data.map((row) => Number(row[key])).filter((value) => Number.isFinite(value));
    if (values.length === 0) return undefined;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min < 0 || max > 100) return undefined;
    return [0, 100];
}

function zeroBasedQuantDomain(data: readonly IRow[], key?: string, zero?: boolean): [number, number] | undefined {
    if (!key || !zero) return undefined;
    const values = data.map((row) => Number(row[key])).filter((value) => Number.isFinite(value));
    if (values.length === 0) return undefined;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
        const bound = Math.max(Math.abs(min), 1);
        return min >= 0 ? [0, bound] : [-bound, 0];
    }
    return [Math.min(0, min), Math.max(0, max)];
}

function looksQuantitative(field: AxisFieldModel, data: readonly IRow[]): boolean {
    if (field.type === 'quantitative') return true;
    if (field.type === 'temporal') return false;
    if (field.isDiscrete || !field.key) return false;
    if (typeof field.zero === 'boolean') return true;
    const values = data.map((row) => Number(row[field.key!])).filter((value) => Number.isFinite(value));
    return values.length > 0;
}

export function buildScaleOptions(
    data: readonly IRow[],
    model: ChannelModel,
    geom: string,
    hideLegend: boolean,
    vegaConfig?: VCfg,
): Record<string, unknown> {
    const hasColor = Boolean(model.color.key);
    const useSizeAsColorForBar = geom === 'bar' && !hasColor && Boolean(model.size.key) && model.size.isDiscrete;
    const colorLegend = (hasColor || useSizeAsColorForBar) && !hideLegend;
    const discreteRange = getDiscretePalette(vegaConfig);
    const continuousRange = getContinuousPalette(vegaConfig, geom);
    const xIsQuantitative = looksQuantitative(model.x, data);
    const yIsQuantitative = looksQuantitative(model.y, data);
    const globalZero = typeof vegaConfig?.scale?.zero === 'boolean' ? vegaConfig.scale.zero : undefined;
    const xZero = typeof model.x.zero === 'boolean' ? model.x.zero : xIsQuantitative ? globalZero : undefined;
    const yZero = typeof model.y.zero === 'boolean' ? model.y.zero : yIsQuantitative ? globalZero : undefined;
    const options: Record<string, unknown> = {
        x: {
            label: model.x.title,
            type: temporalAxisType(model.x.type),
            zero: xIsQuantitative ? xZero : undefined,
            domain:
                model.x.isDiscrete
                    ? orderedDomain(data, model.x.key, model.x.sort)
                    : xIsQuantitative && xZero
                      ? zeroBasedQuantDomain(data, model.x.key, xZero)
                    : geom === 'boxplot' && xIsQuantitative
                      ? constrainedQuantDomain(data, model.x.key)
                      : undefined,
        },
        y: {
            label: model.y.title,
            type: temporalAxisType(model.y.type),
            zero: yIsQuantitative ? yZero : undefined,
            domain:
                model.y.isDiscrete
                    ? orderedDomain(data, model.y.key, model.y.sort)
                    : yIsQuantitative && yZero
                      ? zeroBasedQuantDomain(data, model.y.key, yZero)
                    : geom === 'boxplot' && yIsQuantitative
                      ? constrainedQuantDomain(data, model.y.key)
                      : undefined,
        },
    };

    const isNumericColorFromData =
        Boolean(model.color.key) &&
        !model.color.isContinuous &&
        (() => {
            const key = model.color.key;
            if (!key) return false;
            const values = data.map((row) => Number(row[key])).filter((value) => Number.isFinite(value));
            if (values.length < Math.max(12, Math.floor(data.length * 0.6))) return false;
            return new Set(values.map((value) => value.toFixed(6))).size > 8;
        })();
    const treatColorAsContinuous = model.color.isContinuous || isNumericColorFromData;

    if (hasColor) {
        options.color = {
            label: model.color.title,
            legend: colorLegend,
            type: treatColorAsContinuous ? 'linear' : undefined,
            domain: treatColorAsContinuous ? undefined : orderedDomain(data, model.color.key, model.color.sort),
            range: treatColorAsContinuous ? continuousRange : discreteRange,
        };
    } else if (useSizeAsColorForBar) {
        const sizeDomain = orderedDomain(data, model.size.key, model.size.sort) ?? [];
        const base = typeof vegaConfig?.bar?.fill === 'string' ? (vegaConfig.bar.fill as string) : '#5B8FF9';
        const steps = sizeDomain.length;
        const range =
            steps <= 1
                ? [base]
                : sizeDomain.map((_, index) => mixWithWhite(base, 0.45 - (index / Math.max(1, steps - 1)) * 0.3));
        options.color = {
            label: model.size.title,
            legend: colorLegend,
            domain: sizeDomain,
            range,
        };
    }

    if (model.opacity.key) {
        options.opacity = {
            range: [0.2, 1],
        };
    }

    if (model.size.key && isScatterLikeGeom(geom)) {
        options.r = {
            range: geom === 'circle' ? [2, 9] : [3, 14],
        };
    }

    if (model.shape.key && model.shape.isDiscrete && geom === 'point') {
        const shapeDomain = orderedDomain(data, model.shape.key, model.shape.sort);
        options.symbol = {
            label: model.shape.title,
            domain: shapeDomain,
            range: shapeDomain?.length === 2 ? ['circle', 'square'] : ['circle', 'square', 'triangle', 'diamond'],
            legend: !hideLegend,
        };
    }

    return options;
}
