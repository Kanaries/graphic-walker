import { MEA_KEY_ID, MEA_VAL_ID } from '../../constants';
import { IViewField } from '../../interfaces';
import { IAutoVizDisableReason, IAutoVizRule } from './types';

export type ISynthesizeResult = { fields: IViewField[] } | { reason: IAutoVizDisableReason };

/**
 * Reverse matching for the cold-start mode: given a rule and the dataset's full
 * field list, deterministically pick a minimal legal field combination.
 *
 * Fields demanded by special requirements (temporal, lon/lat) are picked first,
 * then the remaining dim/mea minimums are filled in field-list order, so the
 * result is stable across calls. Returns the blocking reason when the dataset
 * cannot satisfy the rule at all.
 *
 * The picked set is minimal, not scored: rule maximum counts can never be
 * exceeded because only `dim[0]` / `mea[0]` slots are filled.
 */
export function synthesizeFields(rule: IAutoVizRule, allFields: IViewField[], geoFeatureReady = false): ISynthesizeResult {
    const usable = allFields.filter((f) => f.fid !== MEA_KEY_ID && f.fid !== MEA_VAL_ID);
    const dims = usable.filter((f) => f.analyticType === 'dimension');
    // lon/lat only participate when the rule demands them: a coordinate dropped
    // into a generic measure slot produces a nonsense chart
    const genericMeas = usable.filter((f) => f.analyticType === 'measure' && f.geoRole !== 'longitude' && f.geoRole !== 'latitude');

    const pickedDims: IViewField[] = [];
    const pickedMeas: IViewField[] = [];

    for (const req of rule.requires ?? []) {
        switch (req) {
            case 'temporal': {
                const t = dims.find((f) => f.semanticType === 'temporal');
                if (!t) return { reason: 'need_temporal' };
                pickedDims.push(t);
                break;
            }
            case 'temporal_or_ordinal': {
                const t = dims.find((f) => f.semanticType === 'temporal') ?? dims.find((f) => f.semanticType === 'ordinal');
                if (!t) return { reason: 'need_temporal_or_ordinal' };
                pickedDims.push(t);
                break;
            }
            case 'lon_lat': {
                const lonF = usable.find((f) => f.geoRole === 'longitude');
                const latF = usable.find((f) => f.geoRole === 'latitude');
                if (!lonF || !latF) return { reason: 'need_lon_lat' };
                (lonF.analyticType === 'dimension' ? pickedDims : pickedMeas).push(lonF);
                (latF.analyticType === 'dimension' ? pickedDims : pickedMeas).push(latF);
                break;
            }
            case 'geo_feature': {
                if (!geoFeatureReady) return { reason: 'need_geo_feature' };
                break;
            }
        }
    }

    for (const f of dims) {
        if (pickedDims.length >= rule.dim[0]) break;
        if (!pickedDims.includes(f)) pickedDims.push(f);
    }
    if (pickedDims.length < rule.dim[0]) {
        return { reason: rule.dim[0] >= 2 ? 'need_two_dimensions' : 'need_dimension' };
    }

    const meaTarget = rule.mea[0] + pickedMeas.length; // requirement-derived picks (lon/lat) don't consume generic slots
    for (const f of genericMeas) {
        if (pickedMeas.length >= meaTarget) break;
        if (!pickedMeas.includes(f)) pickedMeas.push(f);
    }
    if (pickedMeas.length < meaTarget) {
        return { reason: rule.mea[0] >= 2 ? 'need_two_measures' : 'need_measure' };
    }

    // a zero-minimum rule with no requirement-derived picks (e.g. table) still
    // needs at least one field to say anything
    if (pickedDims.length === 0 && pickedMeas.length === 0) {
        const first = dims[0] ?? genericMeas[0];
        if (!first) return { reason: 'need_fields' };
        (first.analyticType === 'dimension' ? pickedDims : pickedMeas).push(first);
    }

    return { fields: [...pickedDims, ...pickedMeas] };
}
