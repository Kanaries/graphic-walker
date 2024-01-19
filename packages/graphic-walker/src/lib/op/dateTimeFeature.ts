import { DATE_TIME_FEATURE_LEVELS } from '../../constants';
import type { IExpParameter } from '../../interfaces';
import type { IDataFrame } from '../execExp';
import { newOffsetDate } from './offset';

function dateTimeDrill(resKey: string, params: IExpParameter[], data: IDataFrame): IDataFrame {
    const fieldKey = params.find((p) => p.type === 'field')?.value;
    const drillLevel = params.find((p) => p.type === 'value')?.value as (typeof DATE_TIME_FEATURE_LEVELS)[number] | undefined;
    const offset = params.find((p) => p.type === 'offset')?.value;
    const displayOffset = params.find((p) => p.type === 'displayOffset')?.value;
    if (!fieldKey || !drillLevel) {
        return data;
    }
    const fieldValues = data[fieldKey];
    const prepareDate = newOffsetDate(offset);
    const toOffsetDate = newOffsetDate(displayOffset);
    const newDate = ((...x: []) => toOffsetDate(prepareDate(...x))) as typeof prepareDate;
    switch (drillLevel) {
        case 'year': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                return date.getFullYear();
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'quarter': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const Q = Math.floor(date.getMonth() / 3) + 1;
                return Q;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'month': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                return date.getMonth() + 1;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'week': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const _Y = date.getFullYear();
                const _firstDayOfYear = newDate(_Y, 0, 1);
                const _SundayOfFirstWeek = newDate(newDate(_firstDayOfYear).setDate(_firstDayOfYear.getDate() - _firstDayOfYear.getDay()));
                const Y = date.getTime() - _SundayOfFirstWeek.getTime() > 1_000 * 60 * 60 * 24 * 7 ? _Y : _SundayOfFirstWeek.getFullYear();
                const firstDayOfYear = newDate(Y, 0, 1);
                const SundayOfFirstWeek = newDate(newDate(firstDayOfYear).setDate(firstDayOfYear.getDate() - firstDayOfYear.getDay()));
                const W = Math.floor((date.getTime() - SundayOfFirstWeek.getTime()) / (7 * 24 * 60 * 60 * 1_000)) + 1;
                return W;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'weekday': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                return date.getDay();
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'day': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                return date.getDate();
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'hour': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                return date.getHours();
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'minute': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                return date.getMinutes();
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'second': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                return date.getSeconds();
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        default: {
            return data;
        }
    }
}

export default dateTimeDrill;
