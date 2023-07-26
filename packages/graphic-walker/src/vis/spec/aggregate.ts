import { COUNT_FIELD_ID } from '../../constants';
import { IViewField } from '../../interfaces';
import { getMeaAggKey } from '../../utils';

export function channelAggregate(encoding: { [key: string]: any }, channels: WeakMap<object, IViewField>) {
    Object.values(encoding).forEach((c) => {
        if ('aggregate' in c) {
            return;
        }
        const targetField = channels.get(c);
        if (targetField && targetField.fid === COUNT_FIELD_ID) {
            c.title = 'Count';
            c.field = getMeaAggKey(targetField.fid, targetField.aggName)
        } else if (targetField && targetField.analyticType === 'measure') {
            c.title = `${targetField.aggName}(${targetField.name})`;
            c.field = getMeaAggKey(targetField.fid, targetField.aggName)
        }
    });
}
