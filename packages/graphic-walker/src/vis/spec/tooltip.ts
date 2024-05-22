import { IViewField } from '../../interfaces';
import { getMeaAggKey, getMeaAggName } from '../../utils';
import { produce } from 'immer';

export function addTooltipEncode(encoding: { [key: string]: any }, details: Readonly<IViewField[]> = [], defaultAggregated = false) {
    const encs = Object.keys(encoding)
        .filter((ck) => ck !== 'tooltip' && ck !== 'x2' && ck !== 'y2')
        .map((ck) => {
            return produce(
                {
                    field: encoding[ck].field.replace('[0]', ''),
                    type: encoding[ck].type,
                    title: encoding[ck].title,
                } as Record<string, any>,
                (draft) => {
                    if (encoding[ck].timeUnit && !encoding[ck].format) {
                        // timeUnit overrides format
                        draft.timeUnit = encoding[ck].timeUnit;
                    }
                    if (encoding[ck].scale) {
                        draft.scale = encoding[ck].scale;
                    }
                    if (encoding[ck].formatType) {
                        draft.formatType = encoding[ck].formatType;
                    }
                    if (encoding[ck].format) {
                        draft.format = encoding[ck].format;
                    }
                }
            );
        })
        .concat(
            details.map((f) => ({
                field: defaultAggregated && f.analyticType === 'measure' ? getMeaAggKey(f.fid, f.aggName) : f.fid,
                title: defaultAggregated && f.analyticType === 'measure' ? getMeaAggName(f.name, f.aggName) : f.name,
                type: f.semanticType,
            }))
        );
    encoding.tooltip = encs;
}
