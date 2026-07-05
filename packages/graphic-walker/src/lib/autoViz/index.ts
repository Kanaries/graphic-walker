import { IChart, IViewField } from '../../interfaces';
import { MEA_KEY_ID, MEA_VAL_ID } from '../../constants';
import { initEncoding, emptyVisualConfig, emptyVisualLayout } from '../../utils/save';
import { autoVizId } from './builders';
import { extractFeatures } from './features';
import { AUTO_VIZ_RULES } from './rules';
import { synthesizeFields } from './synthesize';
import { IFieldFeatures, IRecommendOptions, IAutoVizDisableReason, IAutoVizItem, IAutoVizResult, IAutoVizRule } from './types';

export * from './types';
export { extractFeatures } from './features';
export { AUTO_VIZ_CHART_ORDER, AUTO_VIZ_RULES } from './rules';
export { builders } from './builders';
export { synthesizeFields } from './synthesize';

/** expressiveness filter: null means the rule is legal for the selection */
function checkExpressiveness(rule: IAutoVizRule, f: IFieldFeatures): IAutoVizDisableReason | null {
    if (f.fields.length === 0) {
        return 'need_fields';
    }
    if (f.nDim < rule.dim[0]) {
        return rule.dim[0] >= 2 ? 'need_two_dimensions' : 'need_dimension';
    }
    if (f.nDim > rule.dim[1]) {
        return 'too_many_dimensions';
    }
    if (f.nMea < rule.mea[0]) {
        return rule.mea[0] >= 2 ? 'need_two_measures' : 'need_measure';
    }
    if (f.nMea > rule.mea[1]) {
        return rule.mea[1] === 1 ? 'need_single_measure' : 'too_many_measures';
    }
    for (const req of rule.requires ?? []) {
        switch (req) {
            case 'temporal':
                if (f.temporalDims.length === 0) return 'need_temporal';
                break;
            case 'temporal_or_ordinal':
                if (f.temporalDims.length === 0 && f.ordinalDims.length === 0) return 'need_temporal_or_ordinal';
                break;
            case 'lon_lat':
                if (!f.lonLat) return 'need_lon_lat';
                break;
            case 'geo_feature':
                if (!f.geoFeatureReady) return 'need_geo_feature';
                break;
        }
    }
    return rule.check?.(f) ?? null;
}

/** minimal chart to inherit from when the caller has no current chart */
function scaffoldChart(allFields: IViewField[]): IChart {
    return {
        visId: autoVizId(),
        name: 'Chart',
        encodings: {
            ...initEncoding(),
            dimensions: allFields.filter((x) => x.analyticType === 'dimension').map((x) => ({ ...x })),
            measures: allFields.filter((x) => x.analyticType === 'measure').map((x) => ({ ...x })),
        },
        config: { ...emptyVisualConfig },
        layout: {
            ...emptyVisualLayout,
            size: { ...emptyVisualLayout.size },
            format: { ...emptyVisualLayout.format },
            resolve: { ...emptyVisualLayout.resolve },
        },
    };
}

/**
 * The Auto Viz entry: filter chart types by expressiveness, rank the survivors
 * by effectiveness, and produce a complete, directly-appliable IChart for each
 * legal candidate.
 *
 * When `fields` is empty and `allFields` is provided, the cold-start mode kicks
 * in: instead of greying everything out, each chart type reverse-matches a
 * minimal legal field combination from `allFields`, so an empty canvas becomes
 * a "click anything to start" palette. Matched fields are surfaced on the item
 * as `matchedFields`.
 *
 * `items` always contains every chart type in palette order, so the UI can
 * render unavailable ones greyed out with their disable reason.
 */
export function recommend(options: IRecommendOptions): IAutoVizResult {
    const { fields, base, allFields, geoFeatureReady = false } = options;
    const features = extractFeatures(fields, geoFeatureReady);
    const baseChart = base ?? scaffoldChart(allFields ?? fields);
    const coldStart = features.fields.length === 0 && (allFields ?? []).some((f) => f.fid !== MEA_KEY_ID && f.fid !== MEA_VAL_ID);
    const unavailable = (rule: IAutoVizRule, reason: IAutoVizDisableReason): IAutoVizItem => ({
        chartType: rule.chartType,
        available: false,
        isDefault: false,
        score: 0,
        reason,
        chart: null,
    });
    const items: IAutoVizItem[] = AUTO_VIZ_RULES.map((rule) => {
        if (coldStart) {
            const syn = synthesizeFields(rule, allFields!, geoFeatureReady);
            if ('reason' in syn) {
                return unavailable(rule, syn.reason);
            }
            const f = extractFeatures(syn.fields, geoFeatureReady);
            // synthesis is requirement-driven, but `check` hooks (e.g. histogram
            // rejecting the count field) still get the final word
            const reason = checkExpressiveness(rule, f);
            if (reason) {
                return unavailable(rule, reason);
            }
            return {
                chartType: rule.chartType,
                available: true,
                isDefault: false,
                score: rule.score(f),
                reason: null,
                chart: rule.build(f, baseChart),
                matchedFields: syn.fields,
            };
        }
        const reason = checkExpressiveness(rule, features);
        if (reason) {
            return unavailable(rule, reason);
        }
        return {
            chartType: rule.chartType,
            available: true,
            isDefault: false,
            score: rule.score(features),
            reason: null,
            chart: rule.build(features, baseChart),
        };
    });
    let defaultItem: IAutoVizItem | null = null;
    for (const item of items) {
        if (item.available && (!defaultItem || item.score > defaultItem.score)) {
            defaultItem = item;
        }
    }
    if (defaultItem) {
        defaultItem.isDefault = true;
    }
    return { items, defaultItem };
}
