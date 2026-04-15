import * as Plot from '@observablehq/plot';
import type { ChannelModel } from '../model/channelModel';
import { resolveDataKey } from '../model/fieldBinding';
import { isScatterLikeGeom } from '../model/geomModel';
import type { VLChannelDef } from '../model/fieldBinding';
import { getDiscretePalette, getPrimaryColor } from '../colorDefaults';

type MarkFactory = (data: any[], options: Record<string, unknown>) => Plot.Markish;

type VegaLiteLikeSpec = {
    width?: number;
    height?: number;
    transform?: Array<Record<string, unknown>>;
    encoding?: Record<string, VLChannelDef>;
};

type VCfg = Record<string, any>;

function getDirectionalMark(geom: string, xType?: string, yType?: string): { mark: MarkFactory; stackAxis: 'x' | 'y' } {
    const xIsQ = xType === 'quantitative';
    const yIsQ = yType === 'quantitative';

    if (geom === 'line') {
        return { mark: Plot.line, stackAxis: 'y' };
    }

    const directional: Record<string, { x: MarkFactory; y: MarkFactory }> = {
        bar: { x: Plot.barX, y: Plot.barY },
        area: { x: Plot.areaX, y: Plot.areaY },
        tick: { x: Plot.tickX, y: Plot.tickY },
        rect: { x: Plot.rectX, y: Plot.rectY },
        rule: { x: Plot.ruleX, y: Plot.ruleY },
        boxplot: { x: Plot.boxX, y: Plot.boxY },
    };

    const fallback = directional[geom];
    if (!fallback) {
        return { mark: Plot.dot, stackAxis: 'y' };
    }
    if (xIsQ && !yIsQ) {
        return { mark: fallback.x, stackAxis: 'x' };
    }
    return { mark: fallback.y, stackAxis: 'y' };
}

function stackModeFromEncoding(spec: VegaLiteLikeSpec): string | null {
    const enc = spec.encoding ?? {};
    const stackable = ['x', 'y', 'theta', 'radius'];
    for (const channel of stackable) {
        const c = enc[channel];
        if (!c) continue;
        if (c.type === 'quantitative' && c.stack !== null && c.stack !== false) {
            return typeof c.stack === 'string' ? c.stack : 'stack';
        }
    }
    if (Array.isArray(spec.transform) && spec.transform.some((t) => Boolean(t.stack))) {
        return 'stack';
    }
    return null;
}

function buildBaseOptions(model: ChannelModel, geom: string, title?: (d: Record<string, unknown>) => string): Record<string, unknown> {
    const options: Record<string, unknown> = {
        x: model.x.key ?? (geom === 'line' && !model.y.key ? () => 0.5 : undefined),
        y: model.y.key ?? (geom === 'line' && !model.x.key ? () => 0.5 : undefined),
        fx: model.column.key,
        fy: model.row.key,
        title,
    };

    if (model.opacity.key) {
        if (geom === 'line' || geom === 'rule' || geom === 'tick') {
            options.strokeOpacity = model.opacity.key;
        } else {
            options.opacity = model.opacity.key;
        }
    } else if (typeof model.opacity.value === 'number') {
        if (geom === 'line' || geom === 'rule' || geom === 'tick') {
            options.strokeOpacity = model.opacity.value as number;
        } else {
            options.opacity = model.opacity.value as number;
        }
    }

    const hasColor = Boolean(model.color.key);
    if (geom === 'line' || geom === 'rule' || geom === 'tick') {
        options.stroke = model.color.key;
    } else if (geom === 'point') {
        if (model.color.isContinuous) {
            options.fill = model.color.key;
            options.stroke = undefined;
        } else {
            options.stroke = hasColor ? model.color.key : undefined;
            options.fill = 'none';
        }
    } else {
        options.fill = model.color.key;
    }

    if (isScatterLikeGeom(geom)) {
        if (model.size.key) options.r = model.size.key;
        if (geom !== 'circle' && model.shape.key && model.shape.isDiscrete) options.symbol = model.shape.key;
    }

    if (geom === 'text') {
        options.text = model.text.key ?? model.y.key ?? model.x.key;
    }

    if (!model.x.key && !model.y.key && (geom === 'point' || geom === 'circle')) {
        options.x = () => 0.5;
        options.y = () => 0.5;
    }

    return options;
}

function resolveDefaultColor(geom: string, vegaConfig?: VCfg): string | undefined {
    const fallback = getPrimaryColor(vegaConfig);
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    if (geom === 'line') return str(vegaConfig?.line?.stroke) ?? fallback;
    if (geom === 'point') return str(vegaConfig?.point?.stroke) ?? fallback;
    if (geom === 'circle') return str(vegaConfig?.circle?.fill) ?? fallback;
    if (geom === 'area') return str(vegaConfig?.area?.fill) ?? fallback;
    if (geom === 'bar') return str(vegaConfig?.bar?.fill) ?? fallback;
    if (geom === 'rect') return str(vegaConfig?.rect?.fill) ?? fallback;
    if (geom === 'tick') return str(vegaConfig?.tick?.stroke) ?? str(vegaConfig?.tick?.fill) ?? fallback;
    if (geom === 'rule') return str(vegaConfig?.rule?.stroke) ?? fallback;
    if (geom === 'text') return str(vegaConfig?.text?.fill) ?? fallback;
    return fallback;
}

function withDefaultColor(options: Record<string, unknown>, geom: string, model: ChannelModel, vegaConfig?: VCfg): Record<string, unknown> {
    if (model.color.key) return options;
    const color = resolveDefaultColor(geom, vegaConfig);
    if (!color) return options;

    if (geom === 'line' || geom === 'tick' || geom === 'rule' || geom === 'point') {
        return { ...options, stroke: options.stroke ?? color };
    }
    if (geom === 'text') {
        return { ...options, fill: options.fill ?? color };
    }
    return { ...options, fill: options.fill ?? color };
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

function isNumericColorFromData(data: any[], key?: string, isContinuousType?: boolean): boolean {
    if (!key || isContinuousType) return false;
    const values = data.map((row) => Number(row[key])).filter((value) => Number.isFinite(value));
    if (values.length < Math.max(12, Math.floor(data.length * 0.6))) return false;
    return new Set(values.map((value) => value.toFixed(6))).size > 8;
}

function uniqueValueOrder(data: any[], key?: string): Map<string, number> {
    if (!key) return new Map();
    return new Map(Array.from(new Set(data.map((row) => String(row[key])))).map((value, index) => [value, index]));
}

function compareDiscreteValue(a: unknown, b: unknown, order: Map<string, number>): number {
    const aRank = order.get(String(a)) ?? Number.MAX_SAFE_INTEGER;
    const bRank = order.get(String(b)) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return compareValue(a, b);
}

function orderedDomain(data: any[], key?: string, sort?: unknown): unknown[] {
    if (!key) return [];
    const domain = Array.from(new Set(data.map((row) => row[key])));
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

function getDiscreteSeriesKeys(model: ChannelModel, options?: { includeOpacity?: boolean; includeSize?: boolean }): string[] {
    const keys = new Set<string>();
    const reservedKeys = new Set(
        [
            model.x.key,
            model.y.key,
            model.row.key,
            model.column.key,
            model.color.key,
            model.opacity.key,
            model.size.key,
            model.shape.key,
            model.text.key,
            model.theta.key,
            model.radius.key,
        ].filter((key): key is string => Boolean(key)),
    );
    if (model.color.key) keys.add(model.color.key);
    if (options?.includeOpacity !== false && model.opacity.isDiscrete && model.opacity.key) keys.add(model.opacity.key);
    if (options?.includeSize && model.size.isDiscrete && model.size.key) keys.add(model.size.key);
    for (const detail of model.details) {
        if (detail.key && detail.isDiscrete && !reservedKeys.has(detail.key)) {
            keys.add(detail.key);
        }
    }
    return [...keys];
}

function materializeSeriesKey(data: any[], keys: string[], name: string): { data: any[]; key?: string } {
    if (keys.length === 0) return { data };
    if (keys.length === 1) return { data, key: keys[0] };
    return {
        data: data.map((row) => ({
            ...row,
            [name]: keys.map((key) => String(row[key] ?? '')).join('\u0001'),
        })),
        key: name,
    };
}

function asChannelArray(value: unknown): VLChannelDef[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as VLChannelDef[];
    return [value as VLChannelDef];
}

function hasField(def: VLChannelDef | undefined): def is VLChannelDef & { field: string } {
    return Boolean(def && typeof def.field === 'string' && def.field.length > 0);
}

function hasAggregateField(def: VLChannelDef | undefined): def is VLChannelDef & { field: string; aggregate: string } {
    return hasField(def) && typeof def.aggregate === 'string' && def.aggregate.length > 0;
}

function aggregateWithOp(values: number[], op: string): number {
    if (op === 'count') return values.length;
    if (values.length === 0) return 0;
    if (op === 'mean' || op === 'average') return values.reduce((acc, value) => acc + value, 0) / values.length;
    if (op === 'min') return Math.min(...values);
    if (op === 'max') return Math.max(...values);
    return values.reduce((acc, value) => acc + value, 0);
}

function aggregateScatterData(data: any[], spec: VegaLiteLikeSpec, geom: string, model: ChannelModel): any[] {
    if (!isScatterLikeGeom(geom)) return data;
    if (!model.row.key && !model.column.key) return data;
    const encoding = spec.encoding ?? {};
    const defs = Object.values(encoding).flatMap((entry) => asChannelArray(entry));
    const aggDefs = defs
        .filter(hasAggregateField)
        .map((def) => ({
            op: String(def.aggregate ?? 'sum').toLowerCase(),
            sourceKey: resolveDataKey(data, { field: def.field, type: def.type }) ?? def.field,
            targetKey: resolveDataKey(data, { field: def.field, aggregate: def.aggregate, type: def.type }) ?? def.field,
        }));
    if (aggDefs.length === 0) return data;
    if (aggDefs.every((agg) => agg.sourceKey === agg.targetKey)) return data;

    const groupKeys = Array.from(
        new Set(
            defs
                .filter((def) => hasField(def) && !def.aggregate)
                .map((def) => resolveDataKey(data, { field: def.field, type: def.type }) ?? def.field)
                .filter((key): key is string => typeof key === 'string' && key.length > 0),
        ),
    );

    const grouped = new Map<string, { base: Record<string, unknown>; values: Map<string, number[]> }>();
    for (const row of data) {
        const groupId = groupKeys.map((key) => String(row[key] ?? '')).join('\u0001');
        const entry =
            grouped.get(groupId) ??
            {
                base: Object.fromEntries(groupKeys.map((key) => [key, row[key]])),
                values: new Map<string, number[]>(),
            };
        for (const agg of aggDefs) {
            const bucket = entry.values.get(agg.targetKey) ?? [];
            const numeric = Number(row[agg.sourceKey]);
            if (Number.isFinite(numeric)) {
                bucket.push(numeric);
            }
            entry.values.set(agg.targetKey, bucket);
        }
        grouped.set(groupId, entry);
    }

    return Array.from(grouped.values()).map((entry) => {
        const out: Record<string, unknown> = { ...entry.base };
        for (const agg of aggDefs) {
            const values = entry.values.get(agg.targetKey) ?? [];
            out[agg.targetKey] = aggregateWithOp(values, agg.op);
        }
        return out;
    });
}

function buildNonStackedColorMarks(
    markFn: MarkFactory,
    data: any[],
    baseOptions: Record<string, unknown>,
    geom: string,
    model: ChannelModel,
    vegaConfig?: VCfg,
): Plot.Markish {
    const colorKey = model.color.key;
    if (!colorKey) return markFn(data, baseOptions);

    const colorDomain = orderedDomain(data, colorKey, model.color.sort);
    const range = getDiscretePalette(vegaConfig);
    const opacity = geom === 'area' ? 0.55 : geom === 'bar' ? 1 : 0.72;

    const orderedColors = geom === 'bar' ? [...colorDomain].reverse() : colorDomain;

    return Plot.marks(
        ...orderedColors.map((value, index) => {
            const seriesData = data.filter((row) => row[colorKey] === value);
            const rangeIndex = colorDomain.indexOf(value);
            const color = range[rangeIndex % Math.max(1, range.length)] ?? undefined;
            const channelOptions =
                geom === 'line' || geom === 'rule' || geom === 'tick' || geom === 'point'
                    ? { stroke: color, fill: geom === 'point' ? 'none' : undefined }
                    : geom === 'boxplot'
                      ? {
                            stroke: color,
                            fill: color,
                            fillOpacity: 1,
                        }
                    : geom === 'bar'
                      ? model.x.type === 'quantitative' && model.y.type !== 'quantitative'
                          ? { fill: color, x1: 0 }
                          : { fill: color, y1: 0 }
                      : { fill: color };
            return markFn(seriesData, {
                ...baseOptions,
                ...channelOptions,
                opacity: typeof baseOptions.opacity === 'number' ? baseOptions.opacity : opacity,
            });
        }),
    );
}

function buildCenterDot(data: any[], model: ChannelModel, geom: string, title?: (d: Record<string, unknown>) => string): Plot.Markish {
    const colorKey = model.color.key;
    const centerData = colorKey
        ? Array.from(new Map(data.map((row) => [String(row[colorKey]), row])).values()).map((row) => ({
              ...row,
              __center_x__: 0.5,
              __center_y__: 0.5,
          }))
        : [{ __center_x__: 0.5, __center_y__: 0.5 }];

    return Plot.dot(centerData, {
        x: '__center_x__',
        y: '__center_y__',
        fill: colorKey,
        stroke: geom === 'point' ? colorKey : undefined,
        r: 4,
        title,
    });
}

function sortSeriesData(data: any[], model: ChannelModel, geom: string): any[] {
    const directionalKey =
        model.x.isDiscrete && model.x.key
            ? model.x.key
            : model.y.isDiscrete && model.y.key
              ? model.y.key
              : undefined;
    const primary = directionalKey ?? model.x.key ?? model.y.key;
    const colorKey = model.color.key;
    const isStackedGeom = geom === 'bar' || geom === 'area';
    if (geom !== 'line' && geom !== 'area' && !isStackedGeom) return data;
    if (!primary && !colorKey) return data;

    const primaryDomain = model.x.isDiscrete
        ? orderedDomain(data, model.x.key, model.x.sort)
        : model.y.isDiscrete
          ? orderedDomain(data, model.y.key, model.y.sort)
          : [];
    const primaryOrder =
        (model.x.isDiscrete || model.y.isDiscrete)
            ? new Map(primaryDomain.map((value, index) => [String(value), index]))
            : new Map<string, number>();
    const colorSort = geom === 'bar' && model.color.isDiscrete && model.color.sort == null ? 'descending' : model.color.sort;
    const colorDomain = model.color.isDiscrete ? orderedDomain(data, colorKey, colorSort) : [];
    const colorOrder = model.color.isDiscrete
        ? new Map(colorDomain.map((value, index) => [String(value), index]))
        : new Map<string, number>();
    const opacityKey = model.opacity.key;
    const opacitySort =
        geom === 'bar' && model.opacity.isDiscrete && model.opacity.sort == null
            ? model.x.isDiscrete
                ? 'descending'
                : 'ascending'
            : model.opacity.sort;
    const opacityDomain = model.opacity.isDiscrete ? orderedDomain(data, opacityKey, opacitySort) : [];
    const opacityOrder = model.opacity.isDiscrete
        ? new Map(opacityDomain.map((value, index) => [String(value), index]))
        : new Map<string, number>();
    const sizeKey = model.size.key;
    const sizeDomain = model.size.isDiscrete ? orderedDomain(data, sizeKey, model.size.sort) : [];
    const sizeOrder = model.size.isDiscrete
        ? new Map(sizeDomain.map((value, index) => [String(value), index]))
        : new Map<string, number>();

    return [...data].sort((a, b) => {
        if (isStackedGeom && primary) {
            const primaryComp =
                model.x.isDiscrete || model.y.isDiscrete
                    ? compareDiscreteValue(a[primary], b[primary], primaryOrder)
                    : compareValue(a[primary], b[primary]);
            if (primaryComp !== 0) return primaryComp;
        }

        if (colorKey) {
            const colorComp = model.color.isDiscrete
                ? compareDiscreteValue(a[colorKey], b[colorKey], colorOrder)
                : compareValue(a[colorKey], b[colorKey]);
            if (colorComp !== 0) return colorComp;
        }
        if (isStackedGeom && !colorKey && opacityKey && model.opacity.isDiscrete) {
            const opacityComp = compareDiscreteValue(a[opacityKey], b[opacityKey], opacityOrder);
            if (opacityComp !== 0) return opacityComp;
        }
        if (isStackedGeom && sizeKey && model.size.isDiscrete) {
            const sizeComp = compareDiscreteValue(a[sizeKey], b[sizeKey], sizeOrder);
            if (sizeComp !== 0) return sizeComp;
        }

        if (!isStackedGeom && primary) {
            return model.x.isDiscrete || model.y.isDiscrete
                ? compareDiscreteValue(a[primary], b[primary], primaryOrder)
                : compareValue(a[primary], b[primary]);
        }

        return 0;
    });
}

function reverseStackSeriesOrder(data: any[], model: ChannelModel, stackAxis: 'x' | 'y', seriesKey?: string): any[] {
    const colorKey = seriesKey ?? model.color.key;
    const primary = stackAxis === 'x' ? model.y.key ?? model.row.key ?? model.column.key : model.x.key ?? model.column.key ?? model.row.key;
    if (!colorKey || !primary) return data;
    const groups = new Map<string, any[]>();
    for (const row of data) {
        const key = String(row[primary]);
        const list = groups.get(key) ?? [];
        list.push(row);
        groups.set(key, list);
    }
    return Array.from(groups.values()).flatMap((rows) => [...rows].reverse());
}

function applyStacking(markFn: MarkFactory, data: any[], baseOptions: Record<string, unknown>, stackAxis: 'x' | 'y', stackMode: string): Plot.Markish {
    const stackOptions: Record<string, unknown> = {};
    if (stackMode === 'normalize') {
        stackOptions.offset = 'normalize';
    } else if (stackMode === 'center') {
        stackOptions.offset = 'center';
    }

    if (stackAxis === 'x') {
        return markFn(data, Plot.stackX(stackOptions, baseOptions));
    }
    return markFn(data, Plot.stackY(stackOptions, baseOptions));
}

function buildNonStackedAreaMarks(
    markFn: MarkFactory,
    data: any[],
    markOptions: Record<string, unknown>,
    model: ChannelModel,
): Plot.Markish | null {
    const seriesKeys = getDiscreteSeriesKeys(model);
    if (seriesKeys.length === 0) return null;

    const grouped = new Map<string, any[]>();
    for (const row of data) {
        const groupId = seriesKeys.map((key) => String(row[key] ?? '')).join('\u0001');
        const rows = grouped.get(groupId) ?? [];
        rows.push(row);
        grouped.set(groupId, rows);
    }
    if (grouped.size <= 1) return null;

    return Plot.marks(
        ...Array.from(grouped.values()).map((rows) =>
            markFn(rows, {
                ...markOptions,
                z: undefined,
            }),
        ),
    );
}

function buildGroupedSeriesMarks(markFn: MarkFactory, data: any[], markOptions: Record<string, unknown>, keys: string[]): Plot.Markish | null {
    if (keys.length === 0) return null;
    const grouped = new Map<string, any[]>();
    for (const row of data) {
        const groupId = keys.map((key) => String(row[key] ?? '')).join('\u0001');
        const rows = grouped.get(groupId) ?? [];
        rows.push(row);
        grouped.set(groupId, rows);
    }
    if (grouped.size <= 1) return null;
    return Plot.marks(
        ...Array.from(grouped.values()).map((rows) =>
            markFn(rows, {
                ...markOptions,
                title: undefined,
                z: undefined,
            }),
        ),
    );
}

function buildGroupedLineMarks(
    markFn: MarkFactory,
    data: any[],
    markOptions: Record<string, unknown>,
    model: ChannelModel,
    vegaConfig?: VCfg,
): Plot.Markish | null {
    const keys = getDiscreteSeriesKeys(model);
    if (keys.length === 0) return null;
    const grouped = new Map<string, any[]>();
    for (const row of data) {
        const groupId = keys.map((key) => String(row[key] ?? '')).join('\u0001');
        const rows = grouped.get(groupId) ?? [];
        rows.push(row);
        grouped.set(groupId, rows);
    }
    if (grouped.size <= 1) return null;

    const colorDomain = orderedDomain(data, model.color.key, model.color.sort);
    const palette = getDiscretePalette(vegaConfig);
    const strokeOpacityChannel = typeof markOptions.strokeOpacity === 'string' ? (markOptions.strokeOpacity as string) : undefined;
    const strokeChannel = typeof markOptions.stroke === 'string' ? (markOptions.stroke as string) : undefined;

    return Plot.marks(
        ...Array.from(grouped.values()).map((rows) => {
            const first = rows[0] ?? {};
            const strokeValue =
                model.color.key && colorDomain.length > 0
                    ? palette[Math.max(0, colorDomain.findIndex((value) => value === first[model.color.key!])) % Math.max(1, palette.length)] ??
                      resolveDefaultColor('line', vegaConfig)
                    : strokeChannel
                      ? first[strokeChannel]
                      : markOptions.stroke;
            const strokeOpacityValue = strokeOpacityChannel ? first[strokeOpacityChannel] : markOptions.strokeOpacity;
            return markFn(rows, {
                ...markOptions,
                title: undefined,
                z: undefined,
                stroke: strokeValue,
                strokeOpacity: strokeOpacityValue,
                opacity: undefined,
            });
        }),
    );
}

function buildVariableSizeBarMarks(
    data: any[],
    markOptions: Record<string, unknown>,
    model: ChannelModel,
    stackAxis: 'x' | 'y',
): Plot.Markish | null {
    if (!model.size.key || model.size.isDiscrete) return null;
    const values = data.map((row) => Number(row[model.size.key!])).filter((value) => Number.isFinite(value));
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const widthKey = '__gw_continuous_bar_size_width__';
    const minWidth = 4;
    const maxWidth = 12;
    const markData = data.map((row) => {
        const raw = Number(row[model.size.key!]);
        const t = max > min && Number.isFinite(raw) ? (raw - min) / (max - min) : 0.5;
        return {
            ...row,
            [widthKey]: minWidth + t * (maxWidth - minWidth),
        };
    });
    const strokeColor = (markOptions.fill as string | undefined) ?? (markOptions.stroke as string | undefined);
    const strokeOpacity = (markOptions.fillOpacity as string | number | undefined) ?? (markOptions.opacity as string | number | undefined);
    const title = markOptions.title as string | ((d: Record<string, unknown>) => string) | undefined;

    if (stackAxis === 'x') {
        return Plot.ruleY(markData, {
            y: model.y.key,
            x1: 0,
            x2: model.x.key,
            fx: model.column.key,
            fy: model.row.key,
            title,
            stroke: strokeColor,
            strokeWidth: widthKey,
            strokeOpacity,
        });
    }

    return Plot.ruleX(markData, {
        x: model.x.key,
        y1: 0,
        y2: model.y.key,
        fx: model.column.key,
        fy: model.row.key,
        title,
        stroke: strokeColor,
        strokeWidth: widthKey,
        strokeOpacity,
    });
}

function buildDiscreteSizeBarMarks(
    data: any[],
    markOptions: Record<string, unknown>,
    model: ChannelModel,
    stackAxis: 'x' | 'y',
    stackMode: string | null,
    vegaConfig?: VCfg,
): Plot.Markish | null {
    if (!model.size.key || !model.size.isDiscrete) return null;
    const sizeDomain = orderedDomain(data, model.size.key, model.size.sort).map((value) => String(value));
    if (sizeDomain.length === 0) return null;
    const widthKey = '__gw_discrete_bar_size_width__';
    const minWidth = 2;
    const maxWidth = 20;
    const widthMap = new Map(
        sizeDomain.map((value, index) => [
            value,
            minWidth + (index / Math.max(1, sizeDomain.length - 1)) * (maxWidth - minWidth),
        ]),
    );
    const markData = data.map((row) => ({
        ...row,
        [widthKey]: widthMap.get(String(row[model.size.key!])) ?? minWidth,
    }));
    const strokeColor =
        (typeof markOptions.fill === 'string' ? (markOptions.fill as string) : undefined) ?? resolveDefaultColor('bar', vegaConfig);
    const strokeOpacity = (markOptions.fillOpacity as string | number | undefined) ?? (markOptions.opacity as string | number | undefined);
    const baseRuleOptions: Record<string, unknown> =
        stackAxis === 'x'
            ? {
                  y: model.y.key,
                  x: model.x.key,
                  fx: model.column.key,
                  fy: model.row.key,
                  title: markOptions.title,
                  stroke: strokeColor,
                  strokeWidth: widthKey,
                  strokeOpacity,
              }
            : {
                  x: model.x.key,
                  y: model.y.key,
                  fx: model.column.key,
                  fy: model.row.key,
                  title: markOptions.title,
                  stroke: strokeColor,
                  strokeWidth: widthKey,
                  strokeOpacity,
              };

    const barStackSeriesKeys = getDiscreteSeriesKeys(model, { includeOpacity: false, includeSize: true });
    const { data: stackedBarData, key: barStackSeriesKey } = materializeSeriesKey(markData, barStackSeriesKeys, '__gw_bar_stack_series__');
    const ruleMarkFn: MarkFactory = stackAxis === 'x' ? Plot.ruleY : Plot.ruleX;
    if (stackMode && barStackSeriesKey) {
        return applyStacking(
            ruleMarkFn,
            stackedBarData,
            {
                ...baseRuleOptions,
                z: barStackSeriesKey,
            },
            stackAxis,
            stackMode,
        );
    }
    return ruleMarkFn(markData, baseRuleOptions);
}

function buildStackedAreaByColorAndOpacity(
    markFn: MarkFactory,
    data: any[],
    markOptions: Record<string, unknown>,
    model: ChannelModel,
    stackAxis: 'x' | 'y',
    stackMode: string,
): Plot.Markish | null {
    if (!model.color.key || !model.opacity.key || !model.opacity.isDiscrete) return null;
    const colorKey = model.color.key;
    const opacityKey = model.opacity.key;
    const colorSort = model.color.sort ?? 'descending';
    const opacitySort = model.opacity.sort ?? 'descending';
    const colorDomain = orderedDomain(data, colorKey, colorSort);
    const opacityDomain = orderedDomain(data, opacityKey, opacitySort);
    if (colorDomain.length <= 1 || opacityDomain.length <= 1) return null;
    const colorOrder = new Map(colorDomain.map((value, index) => [String(value), index]));
    const opacityOrder = new Map(opacityDomain.map((value, index) => [String(value), index]));
    const primaryKey = stackAxis === 'x' ? model.y.key : model.x.key;
    const primaryDomain = orderedDomain(
        data,
        primaryKey,
        stackAxis === 'x' ? model.y.sort : model.x.sort,
    );
    const primaryOrder = new Map(primaryDomain.map((value, index) => [String(value), index]));

    const seriesKey = '__gw_color_opacity_series__';
    const prepared = data
        .map((row) => ({
            ...row,
            [seriesKey]: `${String(row[colorKey] ?? '')}\u0001${String(row[opacityKey] ?? '')}`,
        }))
        .sort((a, b) => {
            const colorComp = compareDiscreteValue(a[colorKey], b[colorKey], colorOrder);
            if (colorComp !== 0) return colorComp;
            const opacityComp =
                (opacityOrder.get(String(a[opacityKey])) ?? Number.MAX_SAFE_INTEGER) -
                (opacityOrder.get(String(b[opacityKey])) ?? Number.MAX_SAFE_INTEGER);
            if (opacityComp !== 0) return opacityComp;
            if (primaryKey) {
                return (
                    (primaryOrder.get(String(a[primaryKey])) ?? Number.MAX_SAFE_INTEGER) -
                    (primaryOrder.get(String(b[primaryKey])) ?? Number.MAX_SAFE_INTEGER)
                );
            }
            return 0;
        });

    return applyStacking(
        markFn,
        prepared,
        {
            ...markOptions,
            z: seriesKey,
        },
        stackAxis,
        stackMode,
    );
}

export function buildMark(
    spec: VegaLiteLikeSpec,
    data: any[],
    model: ChannelModel,
    geom: string,
    title?: (d: Record<string, unknown>) => string,
    vegaConfig?: VCfg
): Plot.Markish {
    if (!model.x.key && !model.y.key && (geom === 'point' || geom === 'circle')) {
        return buildCenterDot(data, model, geom, title);
    }

    if (geom === 'line' && model.x.key && !model.y.key) {
        return Plot.lineY(data, {
            x: model.x.key,
            y: () => 0.5,
            stroke: resolveDefaultColor('line', vegaConfig),
            title,
        });
    }

    if (geom === 'bar' && model.x.key && !model.y.key) {
        return Plot.barY(
            data,
            Plot.groupX(
                { y: 'count' },
                withDefaultColor(
                    {
                        x: model.x.key,
                        fx: model.column.key,
                        fy: model.row.key,
                        fill: model.color.key,
                        title,
                    },
                    'bar',
                    model,
                    vegaConfig,
                ),
            ),
        );
    }

    if (geom === 'bar' && model.y.key && !model.x.key) {
        return Plot.barX(
            data,
            Plot.groupY(
                { x: 'count' },
                withDefaultColor(
                    {
                        y: model.y.key,
                        fx: model.column.key,
                        fy: model.row.key,
                        fill: model.color.key,
                        title,
                    },
                    'bar',
                    model,
                    vegaConfig,
                ),
            ),
        );
    }

    const singleAxisLine = geom === 'line' && Boolean(model.x.key) !== Boolean(model.y.key);
    const lineGeom = singleAxisLine ? 'rule' : geom;
    const { mark: markFn, stackAxis } = getDirectionalMark(lineGeom, model.x.type, model.y.type);
    const baseOptions = withDefaultColor(buildBaseOptions(model, geom, title), geom, model, vegaConfig);
    const preparedData = sortSeriesData(data, model, lineGeom);

    if (geom === 'text') {
        return Plot.text(preparedData, baseOptions);
    }

    if (geom === 'rect' && model.x.key && model.y.key && model.color.key) {
        let cellData = preparedData;
        let cellOpacity: string | number | undefined = model.opacity.key ?? (typeof model.opacity.value === 'number' ? model.opacity.value : undefined);
        if (model.opacity.key && model.opacity.isDiscrete) {
            const opacityDomain = orderedDomain(cellData, model.opacity.key, model.opacity.sort).map((value) => String(value));
            const opacityMap = new Map(opacityDomain.map((value, index) => [value, 0.18 + (index / Math.max(1, opacityDomain.length - 1)) * 0.42]));
            const opacityKey = '__gw_discrete_opacity__';
            cellData = cellData.map((row) => ({ ...row, [opacityKey]: opacityMap.get(String(row[model.opacity.key!])) ?? 0.5 }));
            cellOpacity = opacityKey;
        } else if (model.opacity.key) {
            const values = cellData.map((row) => Number(row[model.opacity.key!])).filter((value) => Number.isFinite(value));
            if (values.length > 0) {
                const min = Math.min(...values);
                const max = Math.max(...values);
                const opacityKey = '__gw_continuous_opacity__';
                if (max > min) {
                    cellData = cellData.map((row) => {
                        const raw = Number(row[model.opacity.key!]);
                        const t = Number.isFinite(raw) ? (raw - min) / (max - min) : 0.5;
                        return { ...row, [opacityKey]: 0.18 + t * 0.52 };
                    });
                } else {
                    cellData = cellData.map((row) => ({ ...row, [opacityKey]: 0.5 }));
                }
                cellOpacity = opacityKey;
            }
        }
        return Plot.cell(cellData, {
            x: model.x.key,
            y: model.y.key,
            fill: model.color.key,
            fx: model.column.key,
            fy: model.row.key,
            title,
            fillOpacity: cellOpacity,
        });
    }

    let markData = sortSeriesData(aggregateScatterData(data, spec, geom, model), model, lineGeom);
    let markOptions: Record<string, unknown> = { ...baseOptions };
    if (lineGeom === 'line' || lineGeom === 'area' || lineGeom === 'rule') {
        markOptions.title = undefined;
    }
    const treatColorAsContinuous = Boolean(model.color.key) && isNumericColorFromData(markData, model.color.key, model.color.isContinuous);
    if (treatColorAsContinuous && geom === 'point') {
        markOptions.fill = model.color.key;
        markOptions.stroke = undefined;
    }

    if (model.opacity.key && model.opacity.isDiscrete) {
        const opacityDomain = orderedDomain(markData, model.opacity.key, model.opacity.sort).map((value) => String(value));
        const opacityMap = new Map(opacityDomain.map((value, index) => [value, 0.28 + (index / Math.max(1, opacityDomain.length - 1)) * 0.64]));
        const opacityKey = '__gw_discrete_opacity__';
        markData = markData.map((row) => ({ ...row, [opacityKey]: opacityMap.get(String(row[model.opacity.key!])) ?? 0.72 }));
        if (lineGeom === 'line' || lineGeom === 'rule' || lineGeom === 'tick') {
            markOptions.strokeOpacity = opacityKey;
            markOptions.opacity = undefined;
        } else if (lineGeom === 'area') {
            markOptions.fillOpacity = opacityKey;
            markOptions.opacity = undefined;
        } else {
            markOptions.opacity = opacityKey;
        }
    }

    if (lineGeom === 'area' && model.opacity.key && !model.opacity.isDiscrete) {
        const values = markData.map((row) => Number(row[model.opacity.key!])).filter((value) => Number.isFinite(value));
        if (values.length > 0) {
            const min = Math.min(...values);
            const max = Math.max(...values);
            const fillOpacityKey = '__gw_continuous_area_opacity__';
            if (max > min) {
                markData = markData.map((row) => {
                    const raw = Number(row[model.opacity.key!]);
                    const t = Number.isFinite(raw) ? (raw - min) / (max - min) : 0.5;
                    return { ...row, [fillOpacityKey]: 0.18 + t * 0.52 };
                });
            } else {
                markData = markData.map((row) => ({ ...row, [fillOpacityKey]: 0.5 }));
            }
            markOptions.fillOpacity = fillOpacityKey;
            markOptions.opacity = undefined;
        }
    }

    if (lineGeom === 'bar' && model.opacity.key) {
        let fillOpacityKey: string | undefined;
        if (model.opacity.isDiscrete) {
            fillOpacityKey = typeof markOptions.opacity === 'string' ? (markOptions.opacity as string) : undefined;
        } else {
            const values = markData.map((row) => Number(row[model.opacity.key!])).filter((value) => Number.isFinite(value));
            if (values.length > 0) {
                const min = Math.min(...values);
                const max = Math.max(...values);
                fillOpacityKey = '__gw_continuous_bar_opacity__';
                if (max > min) {
                    markData = markData.map((row) => {
                        const raw = Number(row[model.opacity.key!]);
                        const t = Number.isFinite(raw) ? (raw - min) / (max - min) : 0.5;
                        return { ...row, [fillOpacityKey!]: 0.22 + t * 0.78 };
                    });
                } else {
                    markData = markData.map((row) => ({ ...row, [fillOpacityKey!]: 0.72 }));
                }
            }
        }
        if (fillOpacityKey) {
            markOptions.fillOpacity = fillOpacityKey;
            markOptions.opacity = undefined;
        }
    }

    if (isScatterLikeGeom(geom) && model.size.key && model.size.isDiscrete) {
        const sizeDomain = orderedDomain(markData, model.size.key, model.size.sort).map((value) => String(value));
        const [baseRadius, radiusSpan] = geom === 'circle' ? [2.6, 6.4] : [1.8, 4.2];
        const radiusMap = new Map(sizeDomain.map((value, index) => [value, baseRadius + (index / Math.max(1, sizeDomain.length - 1)) * radiusSpan]));
        const radiusKey = '__gw_discrete_radius__';
        markData = markData.map((row) => ({ ...row, [radiusKey]: radiusMap.get(String(row[model.size.key!])) ?? 3 }));
        markOptions.r = radiusKey;
    }

    const stackMode = stackModeFromEncoding(spec);

    if (lineGeom === 'bar' && model.size.key && model.size.isDiscrete && !model.color.key) {
        const discreteSizeBars = buildDiscreteSizeBarMarks(markData, markOptions, model, stackAxis, stackMode, vegaConfig);
        if (discreteSizeBars) {
            return discreteSizeBars;
        }
    }

    if (lineGeom === 'bar' && model.size.key && !model.size.isDiscrete && !model.color.key) {
        const variableSizeBars = buildVariableSizeBarMarks(markData, markOptions, model, stackAxis);
        if (variableSizeBars) {
            return variableSizeBars;
        }
    }

    const areaIsQuantScatter = lineGeom === 'area' && model.x.type === 'quantitative' && model.y.type === 'quantitative';
    const barStackSeriesKeys = getDiscreteSeriesKeys(model, { includeOpacity: false, includeSize: true });
    const areaStackSeriesKeys = getDiscreteSeriesKeys(model, { includeSize: false });
    const { data: stackedBarData, key: barStackSeriesKey } = materializeSeriesKey(markData, barStackSeriesKeys, '__gw_bar_stack_series__');
    const { data: stackedAreaData, key: areaStackSeriesKey } = materializeSeriesKey(markData, areaStackSeriesKeys, '__gw_area_stack_series__');
    const shouldStack = Boolean(
        stackMode &&
            ((lineGeom === 'bar' && barStackSeriesKey) || (lineGeom === 'area' && !areaIsQuantScatter && areaStackSeriesKey)),
    );

    if (lineGeom === 'boxplot' && model.color.key) {
        const categoryKey = model.x.isDiscrete ? model.x.key : model.y.isDiscrete ? model.y.key : undefined;
        const valueKey = model.x.isDiscrete ? model.y.key : model.y.isDiscrete ? model.x.key : undefined;
        const colorKey = model.color.key;
        if (categoryKey && valueKey && colorKey) {
            const facetKeys = [model.row.key, model.column.key].filter((key): key is string => Boolean(key));
            const aggregated = new Map<string, Record<string, unknown>>();
            const groupCounts = new Map<string, number>();
            for (const row of markData) {
                const keyParts = [String(row[categoryKey]), String(row[colorKey]), ...facetKeys.map((key) => String(row[key]))];
                const key = keyParts.join('\u0001');
                const numeric = Number(row[valueKey]);
                if (!Number.isFinite(numeric)) continue;
                groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
                const entry = aggregated.get(key) ?? {
                    [categoryKey]: row[categoryKey],
                    [colorKey]: row[colorKey],
                    [valueKey]: 0,
                    ...Object.fromEntries(facetKeys.map((key) => [key, row[key]])),
                };
                entry[valueKey] = Number(entry[valueKey] ?? 0) + numeric;
                aggregated.set(key, entry);
            }
            const maxGroupCount = Math.max(0, ...groupCounts.values());
            if (maxGroupCount > 1) {
                // Keep regular boxplot rendering when groups contain distributions.
                // Tick fallback is only for degenerate one-point-per-group cases.
            } else {
            const aggRows = Array.from(aggregated.values());
            const colorDomain = orderedDomain(aggRows, colorKey, model.color.sort);
            const range = getDiscretePalette(vegaConfig);
            const marks = colorDomain.map((value, index) => {
                const seriesData = aggRows.filter((row) => row[colorKey] === value);
                const stroke = range[index % Math.max(1, range.length)] ?? undefined;
                return model.x.isDiscrete
                    ? Plot.tickY(seriesData, {
                          x: categoryKey,
                          y: valueKey,
                          stroke,
                          fx: model.column.key,
                          fy: model.row.key,
                          title,
                      })
                    : Plot.tickX(seriesData, {
                          y: categoryKey,
                          x: valueKey,
                          stroke,
                          fx: model.column.key,
                          fy: model.row.key,
                          title,
                      });
            });
            return Plot.marks(...marks);
            }
        }
        return buildNonStackedColorMarks(markFn, markData, markOptions, lineGeom, model, vegaConfig);
    }

    if (!stackMode && model.color.key && (lineGeom === 'bar' || lineGeom === 'area' || lineGeom === 'boxplot')) {
        return buildNonStackedColorMarks(markFn, markData, markOptions, lineGeom, model, vegaConfig);
    }

    if (shouldStack && stackMode) {
        if (lineGeom === 'area') {
            const stackedByColorAndOpacity = buildStackedAreaByColorAndOpacity(markFn, markData, markOptions, model, stackAxis, stackMode);
            if (stackedByColorAndOpacity) {
                return stackedByColorAndOpacity;
            }
        }
        const needsStackBoundary =
            lineGeom === 'bar' && !model.color.key && !model.size.key && model.details.some((detail) => detail.key && detail.isDiscrete);
        const stackedOptions: Record<string, unknown> = {
            ...markOptions,
            z: lineGeom === 'area' ? areaStackSeriesKey : barStackSeriesKey,
            stroke: needsStackBoundary ? '#ffffff' : markOptions.stroke,
            strokeWidth: needsStackBoundary ? 0.8 : markOptions.strokeWidth,
        };
        const reverseHorizontalBars = lineGeom === 'bar' && stackAxis === 'x' && stackMode === 'normalize';
        const shouldReverseCenterStack = stackMode === 'center' && !(lineGeom === 'bar' && stackAxis === 'x');
        const shouldReverseAreaStack = lineGeom === 'area' && stackAxis === 'y';
        const baseStackData = lineGeom === 'area' ? stackedAreaData : stackedBarData;
        const stackData =
            reverseHorizontalBars || shouldReverseCenterStack || shouldReverseAreaStack
                ? reverseStackSeriesOrder(baseStackData, model, stackAxis, lineGeom === 'area' ? areaStackSeriesKey : barStackSeriesKey)
                : baseStackData;
        return applyStacking(markFn, stackData, stackedOptions, stackAxis, stackMode);
    }

    if (lineGeom === 'area') {
        const nonStackedAreaMarks = buildNonStackedAreaMarks(markFn, markData, markOptions, model);
        if (nonStackedAreaMarks) {
            return nonStackedAreaMarks;
        }
    }

    const seriesGroupKeys = getDiscreteSeriesKeys(model);
    const { data: groupedMarkData, key: seriesGroupKey } = materializeSeriesKey(markData, seriesGroupKeys, '__gw_series_group__');
    if ((lineGeom === 'line' || lineGeom === 'rule') && seriesGroupKeys.length > 0) {
        const groupedMarks = buildGroupedLineMarks(markFn, markData, markOptions, model, vegaConfig);
        if (groupedMarks) {
            return groupedMarks;
        }
    }
    if (seriesGroupKey && (lineGeom === 'line' || lineGeom === 'area' || lineGeom === 'rule')) {
        const main = markFn(groupedMarkData, {
            ...markOptions,
            z: seriesGroupKey,
        });
        if ((geom === 'point' || geom === 'circle') && (model.column.key || model.row.key)) {
            return Plot.marks(Plot.frame(), main);
        }
        return main;
    }
    const mark = markFn(markData, markOptions);
    if (geom === 'bar' && (model.column.key || model.row.key)) {
        return Plot.marks(Plot.frame(), mark);
    }
    if ((geom === 'point' || geom === 'circle') && (model.column.key || model.row.key)) {
        return Plot.marks(Plot.frame(), mark);
    }
    return mark;
}
