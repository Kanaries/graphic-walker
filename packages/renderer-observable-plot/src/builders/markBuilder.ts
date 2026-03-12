import * as Plot from '@observablehq/plot';
import type { ChannelModel } from '../model/channelModel';
import { isScatterLikeGeom } from '../model/geomModel';
import type { VLChannelDef } from '../model/fieldBinding';

type MarkFactory = (data: any[], options: Record<string, unknown>) => Plot.Mark;

type VegaLiteLikeSpec = {
    transform?: Array<Record<string, unknown>>;
    encoding?: Record<string, VLChannelDef>;
};

type VCfg = Record<string, any>;

function getDirectionalMark(geom: string, xType?: string, yType?: string): { mark: MarkFactory; stackAxis: 'x' | 'y' } {
    const xIsQ = xType === 'quantitative';
    const yIsQ = yType === 'quantitative';

    const directional: Record<string, { x: MarkFactory; y: MarkFactory }> = {
        bar: { x: Plot.barX, y: Plot.barY },
        area: { x: Plot.areaX, y: Plot.areaY },
        line: { x: Plot.lineX, y: Plot.lineY },
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
        x: model.x.key,
        y: model.y.key,
        fx: model.column.key,
        fy: model.row.key,
        title,
    };

    if (model.opacity.key) {
        options.opacity = model.opacity.key;
    } else if (typeof model.opacity.value === 'number') {
        options.opacity = model.opacity.value as number;
    }

    const hasColor = Boolean(model.color.key);
    if (geom === 'line' || geom === 'rule' || geom === 'tick') {
        options.stroke = model.color.key;
    } else if (geom === 'point') {
        options.stroke = hasColor ? model.color.key : undefined;
        options.fill = 'none';
    } else {
        options.fill = model.color.key;
    }

    if (isScatterLikeGeom(geom)) {
        if (model.size.key) options.r = model.size.key;
        if (model.shape.key && model.shape.isDiscrete) options.symbol = model.shape.key;
    }

    if (geom === 'text') {
        options.text = model.text.key ?? model.y.key ?? model.x.key;
    }

    return options;
}

function resolveDefaultColor(geom: string, vegaConfig?: VCfg): string | undefined {
    const fallback = Array.isArray(vegaConfig?.range?.category) ? vegaConfig?.range?.category?.[0] : undefined;
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

function sortSeriesData(data: any[], model: ChannelModel, geom: string): any[] {
    if (geom !== 'line' && geom !== 'area') return data;
    const primary = model.x.key ?? model.y.key;
    if (!primary) return data;
    const colorKey = model.color.key;
    return [...data].sort((a, b) => {
        const groupComp = colorKey ? compareValue(a[colorKey], b[colorKey]) : 0;
        if (groupComp !== 0) return groupComp;
        return compareValue(a[primary], b[primary]);
    });
}

function applyStacking(markFn: MarkFactory, data: any[], baseOptions: Record<string, unknown>, stackAxis: 'x' | 'y', stackMode: string): Plot.Mark {
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

export function buildMark(
    spec: VegaLiteLikeSpec,
    data: any[],
    model: ChannelModel,
    geom: string,
    title?: (d: Record<string, unknown>) => string,
    vegaConfig?: VCfg
): Plot.Mark {
    const { mark: markFn, stackAxis } = getDirectionalMark(geom, model.x.type, model.y.type);
    const baseOptions = withDefaultColor(buildBaseOptions(model, geom, title), geom, model, vegaConfig);
    const preparedData = sortSeriesData(data, model, geom);

    if (geom === 'text') {
        return Plot.text(preparedData, baseOptions);
    }

    if (geom === 'rect' && model.x.key && model.y.key && model.color.key) {
        const cellOpacity = model.opacity.key ?? (typeof model.opacity.value === 'number' ? model.opacity.value : undefined);
        return Plot.cell(preparedData, {
            x: model.x.key,
            y: model.y.key,
            fill: model.color.key,
            fx: model.column.key,
            fy: model.row.key,
            title,
            opacity: cellOpacity,
        });
    }

    const stackMode = stackModeFromEncoding(spec);
    const areaIsQuantScatter = geom === 'area' && model.x.type === 'quantitative' && model.y.type === 'quantitative';
    const shouldStack = Boolean(stackMode && model.color.key && (geom === 'bar' || (geom === 'area' && !areaIsQuantScatter)));

    if (shouldStack && stackMode) {
        const stackedOptions: Record<string, unknown> = {
            ...baseOptions,
            z: model.color.key,
        };
        return applyStacking(markFn, preparedData, stackedOptions, stackAxis, stackMode);
    }

    if (model.color.key && (geom === 'line' || geom === 'area')) {
        return markFn(preparedData, {
            ...baseOptions,
            z: model.color.key,
        });
    }

    return markFn(preparedData, baseOptions);
}
