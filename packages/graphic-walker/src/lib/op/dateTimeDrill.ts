import { DATE_TIME_DRILL_LEVELS } from '../../constants';
import type { IExpParameter } from '../../interfaces';
import type { IDataFrame } from '../execExp';
import { OffsetDate, newOffsetDate } from './offset';

const formatDate = (date: Date) => date.getTime();

const isoLargeYears = [
    4, 9, 15, 20, 26, 32, 37, 43, 48, 54, 60, 65, 71, 76, 82, 88, 93, 99, 105, 111, 116, 122, 128, 133, 139, 144, 150, 156, 161, 167, 172, 178, 184, 189, 195,
    201, 207, 212, 218, 224, 229, 235, 240, 246, 252, 257, 263, 268, 274, 280, 285, 291, 296, 303, 308, 314, 320, 325, 331, 336, 342, 348, 353, 359, 364, 370,
    376, 381, 387, 392, 398,
];

function dateTimeDrill(resKey: string, params: IExpParameter[], data: IDataFrame): IDataFrame {
    const fieldKey = params.find((p) => p.type === 'field')?.value;
    const drillLevel = params.find((p) => p.type === 'value')?.value as (typeof DATE_TIME_DRILL_LEVELS)[number] | undefined;
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
                const Y = date.getFullYear();
                return formatDate(toOffsetDate(Y, 0, 1));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'quarter': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const Y = date.getFullYear();
                const Q = Math.floor(date.getMonth() / 3);
                return formatDate(toOffsetDate(Y, Q * 3, 1));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'month': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                return formatDate(toOffsetDate(Y, M, 1));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'week': {
            const newValues = fieldValues.map((v) => {
                const today = newDate(v);
                const date = newDate(today.setDate(today.getDate() - today.getDay()));
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                return formatDate(toOffsetDate(Y, M, D));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'day': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                return formatDate(toOffsetDate(Y, M, D));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'iso_year': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const _Y = date.getFullYear();
                const dayInFirstWeek = toOffsetDate(_Y, 0, 4);
                const firstMondayOfYear = newDate(newDate(dayInFirstWeek).setDate(dayInFirstWeek.getDate() - (dayInFirstWeek.getDay() || 7) + 1));
                if (date.getTime() < firstMondayOfYear.getTime()) {
                    return formatDate(toOffsetDate(_Y - 1, 0, 1));
                }
                const nextDayInFirstWeek = toOffsetDate(_Y + 1, 0, 4);
                const nextFirstMondayOfYear = newDate(
                    newDate(nextDayInFirstWeek).setDate(nextDayInFirstWeek.getDate() - (nextDayInFirstWeek.getDay() || 7) + 1)
                );
                return formatDate(toOffsetDate(date.getTime() < nextFirstMondayOfYear.getTime() ? _Y : _Y + 1, 0, 1));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'iso_week': {
            const newValues = fieldValues.map((v) => {
                const today = newDate(v);
                const date = newDate(today.setDate(today.getDate() - (today.getDay() || 7) + 1));
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                return formatDate(toOffsetDate(Y, M, D));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'hour': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                const H = date.getHours();
                return formatDate(toOffsetDate(Y, M, D, H));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'minute': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                const H = date.getHours();
                const m = date.getMinutes();
                return formatDate(toOffsetDate(Y, M, D, H, m));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'second': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                const H = date.getHours();
                const m = date.getMinutes();
                const s = date.getSeconds();
                return formatDate(toOffsetDate(Y, M, D, H, m, s));
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
