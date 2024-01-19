import { IViewField } from '../../interfaces';
import { getMeaAggKey, getMeaAggName } from '../../utils';

export function addTooltipEncode(encoding: { [key: string]: any }, details: Readonly<IViewField[]> = [], defaultAggregated = false) {
    const encs = Object.keys(encoding)
        .filter((ck) => ck !== 'tooltip')
        .map((ck) => {
            return {
                field: encoding[ck].field,
                type: encoding[ck].type,
                title: encoding[ck].title,
                ...(encoding[ck].timeUnit
                    ? {
                          timeUnit: encoding[ck].timeUnit,
                      }
                    : {}),
                ...(encoding[ck].scale
                    ? {
                          scale: encoding[ck].scale,
                      }
                    : {}),
            };
        })
        .concat(
            details.map((f) => ({
                field: defaultAggregated ? getMeaAggKey(f.fid, f.aggName) : f.fid,
                title: defaultAggregated ? getMeaAggName(f.name, f.aggName) : f.name,
                type: f.semanticType,
            }))
        );
    encoding.tooltip = encs;
}
