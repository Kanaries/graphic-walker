import type { ChannelModel } from '../model/channelModel';
import { isScatterLikeGeom } from '../model/geomModel';

type VCfg = Record<string, any>;

function temporalAxisType(type?: string): 'utc' | undefined {
    return type === 'temporal' ? 'utc' : undefined;
}

export function buildScaleOptions(model: ChannelModel, geom: string, hideLegend: boolean, vegaConfig?: VCfg): Record<string, unknown> {
    const hasColor = Boolean(model.color.key);
    const colorLegend = hasColor && !hideLegend;
    const discreteRange = Array.isArray(vegaConfig?.range?.category) ? vegaConfig?.range?.category : undefined;
    const continuousRange = Array.isArray(vegaConfig?.range?.heatmap)
        ? vegaConfig?.range?.heatmap
        : Array.isArray(vegaConfig?.scale?.continuous?.range)
          ? vegaConfig?.scale?.continuous?.range
          : Array.isArray(vegaConfig?.range?.ramp)
            ? vegaConfig?.range?.ramp
            : undefined;

    const options: Record<string, unknown> = {
        x: {
            label: model.x.title,
            type: temporalAxisType(model.x.type),
        },
        y: {
            label: model.y.title,
            type: temporalAxisType(model.y.type),
        },
    };

    if (hasColor) {
        options.color = {
            label: model.color.title,
            legend: colorLegend,
            range: model.color.isDiscrete ? discreteRange : continuousRange,
        };
    }

    if (model.opacity.key) {
        options.opacity = {
            range: [0.2, 1],
        };
    }

    if (model.size.key && isScatterLikeGeom(geom)) {
        options.r = {
            range: [3, 14],
        };
    }

    if (model.shape.key && model.shape.isDiscrete && isScatterLikeGeom(geom)) {
        options.symbol = {
            label: model.shape.title,
            legend: !hideLegend,
        };
    }

    return options;
}
