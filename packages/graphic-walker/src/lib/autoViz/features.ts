import { IViewField } from '../../interfaces';
import { MEA_KEY_ID, MEA_VAL_ID } from '../../constants';
import { IFieldFeatures } from './types';

/**
 * Compute the statistical features of a field selection.
 * This is the "三特征" step of Auto Viz: dimension count, measure count and
 * special data types (temporal / ordinal / geographic).
 */
export function extractFeatures(fields: IViewField[], geoFeatureReady = false): IFieldFeatures {
    const selected = fields.filter((f) => f.fid !== MEA_KEY_ID && f.fid !== MEA_VAL_ID);
    const dimensions = selected.filter((f) => f.analyticType === 'dimension');
    const measures = selected.filter((f) => f.analyticType === 'measure');
    const temporalDims = dimensions.filter((f) => f.semanticType === 'temporal');
    const ordinalDims = dimensions.filter((f) => f.semanticType === 'ordinal');
    const lon = selected.find((f) => f.geoRole === 'longitude');
    const lat = selected.find((f) => f.geoRole === 'latitude');
    const lonLat: [IViewField, IViewField] | null = lon && lat ? [lon, lat] : null;
    const nonGeoMeasures = measures.filter((f) => f !== lon && f !== lat);
    return {
        fields: selected,
        dimensions,
        measures,
        nDim: dimensions.length,
        nMea: measures.length,
        temporalDims,
        ordinalDims,
        lonLat,
        nonGeoMeasures,
        geoFeatureReady,
    };
}
