import { COUNT_FIELD_ID } from '../../constants';
import { IViewField } from '../../interfaces';
import { getMeaAggKey, getMeaAggName } from '../../utils';
import { encodeFid } from './encode';

export function channelAggregate(encoding: { [key: string]: any }, fields: IViewField[]) {
    Object.values(encoding).forEach((c) => {
        if (c.aggregate === null) return;
        const targetField = fields.find((f) => encodeFid(f.fid) === c.field && (f.analyticType === 'measure' || f.fid === COUNT_FIELD_ID));
        if (targetField && targetField.fid === COUNT_FIELD_ID) {
            if (!targetField.titleOverride) {
                c.title = 'Count';
            }
            c.field = encodeFid(getMeaAggKey(targetField.fid, targetField.aggName));
        } else if (targetField) {
            if (!targetField.titleOverride) {
                c.title = getMeaAggName(targetField.name, targetField.aggName);
            }
            c.field = encodeFid(getMeaAggKey(targetField.fid, targetField.aggName));
        }
    });
}
