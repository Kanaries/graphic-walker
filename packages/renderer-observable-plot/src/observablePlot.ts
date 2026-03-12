import * as Plot from '@observablehq/plot';
import type { IChannelScales, IRow, IStackMode, IViewField, VegaGlobalConfig } from '@kanaries/graphic-walker';
import { toVegaSpec } from '@kanaries/graphic-walker/lib/vega';
import { buildLayoutOptions } from './builders/layoutBuilder';
import { buildMark } from './builders/markBuilder';
import { buildScaleOptions } from './builders/scaleBuilder';
import { buildTooltipTitle } from './builders/tooltipBuilder';
import { buildChannelModel } from './model/channelModel';
import { normalizeGeom } from './model/geomModel';
import { getFieldTitle, resolveDataKey } from './model/fieldBinding';

type VegaLiteLikeSpec = {
    data?: { values?: IRow[] };
    mark?: string | { type?: string };
    encoding?: Record<string, any>;
    transform?: Array<Record<string, unknown>>;
    config?: {
        legend?: {
            disable?: boolean;
            gradientOpacity?: number;
            symbolOpacity?: number;
        };
    };
};

function isLegendHidden(vlSpec: VegaLiteLikeSpec): boolean {
    const legend = vlSpec.config?.legend;
    if (!legend) return false;
    if (legend.disable) return true;
    return legend.gradientOpacity === 0 || legend.symbolOpacity === 0;
}

function vegaLiteToPlot(spec: VegaLiteLikeSpec, vegaConfig?: VegaGlobalConfig): Record<string, unknown> {
    const data = spec?.data?.values ?? [];
    const channels = buildChannelModel(data, spec);
    const geom = normalizeGeom(spec.mark, channels);
    const hideLegend = isLegendHidden(spec);
    const title = buildTooltipTitle(channels);

    const mark = buildMark(spec, data, channels, geom, title, vegaConfig);

    return {
        marks: [mark],
        ...buildScaleOptions(channels, geom, hideLegend, vegaConfig),
        ...buildLayoutOptions(channels, hideLegend),
    };
}

export function toObservablePlotSpec({
    rows: rowsRaw,
    columns: columnsRaw,
    color,
    opacity,
    size,
    shape,
    theta,
    radius,
    text,
    details = [],
    interactiveScale,
    dataSource,
    layoutMode,
    width,
    height,
    defaultAggregated,
    geomType,
    stack,
    scales,
    mediaTheme,
    vegaConfig,
    displayOffset,
}: {
    rows: readonly IViewField[];
    columns: readonly IViewField[];
    color?: IViewField;
    opacity?: IViewField;
    size?: IViewField;
    shape?: IViewField;
    theta?: IViewField;
    radius?: IViewField;
    text?: IViewField;
    details?: Readonly<IViewField[]>;
    interactiveScale: boolean;
    dataSource: readonly IRow[];
    layoutMode: string;
    width: number;
    height: number;
    defaultAggregated: boolean;
    stack: IStackMode;
    geomType: string;
    scales?: IChannelScales;
    mediaTheme: 'dark' | 'light';
    vegaConfig: VegaGlobalConfig;
    displayOffset?: number;
}): Record<string, unknown>[] {
    const vlSpecs = toVegaSpec({
        rows: rowsRaw,
        columns: columnsRaw,
        color,
        opacity,
        size,
        shape,
        theta,
        radius,
        text,
        details,
        interactiveScale,
        dataSource,
        layoutMode,
        width,
        height,
        defaultAggregated,
        geomType,
        stack,
        scales,
        mediaTheme,
        vegaConfig,
        displayOffset,
    }) as VegaLiteLikeSpec[];

    return vlSpecs.map((vlSpec) => vegaLiteToPlot(vlSpec, vegaConfig));
}

export const __test__vegaLiteToPlot = vegaLiteToPlot;
export const __test__fieldBinding = {
    resolveDataKey,
    getFieldTitle,
};

export function renderObservablePlot(plotSpec: Record<string, unknown>, width?: number, height?: number, background?: string) {
    return Plot.plot({
        ...plotSpec,
        width,
        height,
        style: {
            ...((plotSpec.style as Record<string, unknown> | undefined) ?? {}),
            background,
        },
    });
}
