import type { IRow } from '@kanaries/graphic-walker';
import type { ChannelModel } from '../model/channelModel';
import { isScatterLikeGeom } from '../model/geomModel';
import { getContinuousPalette, getDiscretePalette } from '../colorDefaults';

type VCfg = Record<string, any>;

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

export function buildScaleOptions(
    data: readonly IRow[],
    model: ChannelModel,
    geom: string,
    hideLegend: boolean,
    vegaConfig?: VCfg,
): Record<string, unknown> {
    const hasColor = Boolean(model.color.key);
    const colorLegend = hasColor && !hideLegend;
    const discreteRange = getDiscretePalette(vegaConfig);
    const continuousRange = getContinuousPalette(vegaConfig, geom);
    const options: Record<string, unknown> = {
        x: {
            label: model.x.title,
            type: temporalAxisType(model.x.type),
            zero: model.x.type === 'quantitative' ? model.x.zero : undefined,
            domain:
                model.x.isDiscrete
                    ? orderedDomain(data, model.x.key, model.x.sort)
                    : geom === 'boxplot' && model.x.type === 'quantitative'
                      ? constrainedQuantDomain(data, model.x.key)
                      : undefined,
        },
        y: {
            label: model.y.title,
            type: temporalAxisType(model.y.type),
            zero: model.y.type === 'quantitative' ? model.y.zero : undefined,
            domain:
                model.y.isDiscrete
                    ? orderedDomain(data, model.y.key, model.y.sort)
                    : geom === 'boxplot' && model.y.type === 'quantitative'
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
