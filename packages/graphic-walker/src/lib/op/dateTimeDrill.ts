import { DATE_TIME_DRILL_LEVELS } from '../../constants';
import type { IExpParameter } from '../../interfaces';
import type { IDataFrame } from '../execExp';
import { getOffsetDate } from './offset';

const formatDate = (date: Date) => date.getTime();

function dateTimeDrill(resKey: string, params: IExpParameter[], data: IDataFrame): IDataFrame {
    const fieldKey = params.find((p) => p.type === 'field')?.value;
    const drillLevel = params.find((p) => p.type === 'value')?.value as (typeof DATE_TIME_DRILL_LEVELS)[number] | undefined;
    const offset = params.find((p) => p.type === 'offset')?.value ?? (new Date().getTimezoneOffset());
    if (!fieldKey || !drillLevel) {
        return data;
    }
    const fieldValues = data[fieldKey];
    switch (drillLevel) {
        case 'year': {
            const newValues = fieldValues.map((v) => {
                const date = getOffsetDate(new Date(v), offset);
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
                const date = getOffsetDate(new Date(v), offset);
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
                const date = getOffsetDate(new Date(v), offset);
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
                const today = getOffsetDate(new Date(v), offset);
                const date = new Date(today.setDate(today.getDate() - today.getDay()));
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
        case 'day': {
            const newValues = fieldValues.map((v) => {
                const date = getOffsetDate(new Date(v), offset);
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
                const date = getOffsetDate(new Date(v), offset);
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
                const date = getOffsetDate(new Date(v), offset);
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
                const date = getOffsetDate(new Date(v), offset);
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
