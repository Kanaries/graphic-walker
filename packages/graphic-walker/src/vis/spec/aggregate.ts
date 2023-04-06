import { COUNT_FIELD_ID } from '../../constants';
import { IViewField } from '../../interfaces';

export function channelAggregate(encoding: { [key: string]: any }, fields: IViewField[]) {
    Object.values(encoding).forEach((c) => {
        const targetField = fields.find((f) => f.fid === c.field && !('aggregate' in c));
        if (targetField && targetField.fid === COUNT_FIELD_ID) {
            c.title = 'Count';
        } else if (targetField && targetField.analyticType === 'measure') {
            c.title = `${targetField.aggName}(${targetField.name})`;
        }
    });
}
