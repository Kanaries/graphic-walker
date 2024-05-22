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
    function getISOYear(v: any) {
        const date = newDate(v);
        const y = date.getFullYear();
        const dayInFirstWeek = toOffsetDate(y, 0, 4);
        const firstMondayOfYear = newDate(newDate(dayInFirstWeek).setDate(dayInFirstWeek.getDate() - (dayInFirstWeek.getDay() || 7) + 1));
        if (date.getTime() < firstMondayOfYear.getTime()) {
            return y - 1;
        }
        const nextY = y + 1;
        const nextDayInFirstWeek = toOffsetDate(nextY, 0, 4);
        const nextFirstMondayOfYear = newDate(newDate(nextDayInFirstWeek).setDate(nextDayInFirstWeek.getDate() - (nextDayInFirstWeek.getDay() || 7) + 1));
        return date.getTime() < nextFirstMondayOfYear.getTime() ? y : nextY;
    }
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
                const Y = date.getFullYear();
                const firstDayOfYear = toOffsetDate(Y, 0, 1);
                const SundayOfFirstWeek = newDate(firstDayOfYear.setDate(firstDayOfYear.getDate() - firstDayOfYear.getDay()));
                const FirstSundayOfYear =
                    SundayOfFirstWeek.getFullYear() === Y ? SundayOfFirstWeek : newDate(SundayOfFirstWeek.setDate(SundayOfFirstWeek.getDate() + 7));
                const W = Math.floor((date.getTime() - FirstSundayOfYear.getTime()) / (7 * 24 * 60 * 60 * 1_000)) + 1;
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
        case 'iso_year': {
            const newValues = fieldValues.map(getISOYear);
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'iso_week': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                const y = getISOYear(v);
                const dayInFirstWeek = toOffsetDate(y, 0, 4);
                const firstMondayOfYear = newDate(newDate(dayInFirstWeek).setDate(dayInFirstWeek.getDate() - (dayInFirstWeek.getDay() || 7) + 1));
                const W = Math.floor((date.getTime() - firstMondayOfYear.getTime()) / (7 * 24 * 60 * 60 * 1_000)) + 1;
                return W;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'iso_weekday': {
            const newValues = fieldValues.map((v) => {
                const date = newDate(v);
                return date.getDay() || 7;
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
