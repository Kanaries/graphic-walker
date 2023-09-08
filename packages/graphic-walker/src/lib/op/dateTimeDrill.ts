import { DATE_TIME_DRILL_LEVELS } from '../../constants';
import type { IExpParamter } from '../../interfaces';
import type { IDataFrame } from '../execExp';

const formatDate = (date: Date) => {
    const Y = date.getFullYear();
    const M = date.getMonth() + 1;
    const D = date.getDate();
    const H = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();
    return `${Y}-${M}-${D} ${`${H}`.padStart(2, ' ')}:${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`;
};

function dateTimeDrill(resKey: string, params: IExpParamter[], data: IDataFrame): IDataFrame {
    const fieldKey = params.find((p) => p.type === 'field')?.value;
    const drillLevel = params.find((p) => p.type === 'value')?.value as (typeof DATE_TIME_DRILL_LEVELS)[number] | undefined;
    if (!fieldKey || !drillLevel) {
        return data;
    }
    const fieldValues = data[fieldKey];
    switch (drillLevel) {
        case 'year': {
            const newValues = fieldValues.map((v) => {
                const date = new Date(v);
                const Y = date.getFullYear();
                return formatDate(new Date(Y, 0, 1));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'quarter': {
            const newValues = fieldValues.map((v) => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const Q = Math.floor(date.getMonth() / 3);
                return formatDate(new Date(Y, Q * 3, 1));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'month': {
            const newValues = fieldValues.map((v) => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                return formatDate(new Date(Y, M, 1));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'week': {
            const newValues = fieldValues.map((v) => {
                const date = new Date(v);
                const _Y = date.getFullYear();
                const _firstDayOfYear = new Date(_Y, 0, 1);
                const _SundayOfFirstWeek = new Date(new Date(_firstDayOfYear).setDate(_firstDayOfYear.getDate() - _firstDayOfYear.getDay()));
                const Y = date.getTime() - _SundayOfFirstWeek.getTime() > 1_000 * 60 * 60 * 24 * 7 ? _Y : _SundayOfFirstWeek.getFullYear();
                const SundayOfThisWeek = new Date(new Date(date).setDate(date.getDate() - date.getDay()));
                return formatDate(SundayOfThisWeek);
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'day': {
            const newValues = fieldValues.map((v) => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                return formatDate(new Date(Y, M, D));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'hour': {
            const newValues = fieldValues.map((v) => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                const H = date.getHours();
                return formatDate(new Date(Y, M, D, H));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'minute': {
            const newValues = fieldValues.map((v) => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                const H = date.getHours();
                const m = date.getMinutes();
                return formatDate(new Date(Y, M, D, H, m));
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'second': {
            const newValues = fieldValues.map((v) => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth();
                const D = date.getDate();
                const H = date.getHours();
                const m = date.getMinutes();
                const s = date.getSeconds();
                return formatDate(new Date(Y, M, D, H, m, s));
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
