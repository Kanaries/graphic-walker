import { COUNT_FIELD_ID } from '../../constants';
import { IViewField } from '../../interfaces';
import { getMeaAggKey, getMeaAggName } from '../../utils';
import { encodeFid } from './encode';

export function channelAggregate(encoding: { [key: string]: any }, fields: Partial<Record<string, IViewField>>) {
    Object.entries(encoding).forEach(([channel, c]) => {
        if (c.aggregate === null) return;
        const targetField = fields[channel];
        if (!targetField || encodeFid(targetField.fid) !== c.field || (targetField.analyticType !== 'measure' && targetField.fid !== COUNT_FIELD_ID)) return;
        if (targetField.fid === COUNT_FIELD_ID) {
            if (!targetField.titleOverride) {
                c.title = 'Count';
            }
            c.field = encodeFid(getMeaAggKey(targetField.fid, targetField.aggName, targetField.windowAgg));
        } else {
            if (!targetField.titleOverride) {
                c.title = getMeaAggName(targetField.name, targetField.aggName, targetField.windowAgg);
            }
            c.field = encodeFid(getMeaAggKey(targetField.fid, targetField.aggName, targetField.windowAgg));
        }
    });
}
