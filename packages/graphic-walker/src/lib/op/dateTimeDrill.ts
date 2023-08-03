import { DATE_TIME_DRILL_LEVELS } from "../../constants";
import type { IExpParamter } from "../../interfaces";
import type { IDataFrame } from "../execExp";


function dateTimeDrill(resKey: string, params: IExpParamter[], data: IDataFrame): IDataFrame {
    const fieldKey = params.find(p => p.type === 'field')?.value;
    const drillLevel = params.find(p => p.type === 'value')?.value as typeof DATE_TIME_DRILL_LEVELS[number] | undefined;
    if (!fieldKey || !drillLevel) {
        return data;
    }
    const fieldValues = data[fieldKey];
    switch (drillLevel) {
        case 'year': {
            const newValues = fieldValues.map(v => {
                const date = new Date(v);
                const Y = date.getFullYear();
                return Y;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'quarter': {
            const newValues = fieldValues.map(v => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const Q = Math.floor(date.getMonth() / 3) + 1;
                return `${Y}Q${Q}`;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'month': {
            const newValues = fieldValues.map(v => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth() + 1;
                return `${Y}-${M}`;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'week': {
            const newValues = fieldValues.map(v => {
                const date = new Date(v);
                const _Y = date.getFullYear();
                const _firstDayOfYear = new Date(_Y, 0, 1);
                const _SundayOfFirstWeek = new Date(
                    new Date(_firstDayOfYear).setDate(_firstDayOfYear.getDate() - _firstDayOfYear.getDay())
                );
                const Y = date.getTime() - _SundayOfFirstWeek.getTime() > 1_000 * 60 * 60 * 24 * 7 ? _Y : _SundayOfFirstWeek.getFullYear();
                const firstDayOfYear = new Date(Y, 0, 1);
                const SundayOfFirstWeek = new Date(
                    new Date(firstDayOfYear).setDate(firstDayOfYear.getDate() - firstDayOfYear.getDay())
                );
                const W = Math.floor((date.getTime() - SundayOfFirstWeek.getTime()) / (7 * 24 * 60 * 60 * 1_000)) + 1;
                const SundayOfThisWeek = new Date(
                    new Date(date).setDate(date.getDate() - date.getDay())
                );
                const SaturdayOfThisWeek = new Date(
                    SundayOfThisWeek.getTime() + 6 * 24 * 60 * 60 * 1_000
                );
                const beginDay = SundayOfThisWeek.toLocaleDateString();
                const endDay = SaturdayOfThisWeek.toLocaleDateString();
                return `${Y} W${W < 10 ? ' ' : ''}${W} (${beginDay} ~ ${endDay})`;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'day': {
            const newValues = fieldValues.map(v => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth() + 1;
                const D = date.getDate();
                return `${Y}-${M}-${D}`;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'hour': {
            const newValues = fieldValues.map(v => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth() + 1;
                const D = date.getDate();
                const H = date.getHours();
                return `${Y}-${M}-${D} ${H}`;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'minute': {
            const newValues = fieldValues.map(v => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth() + 1;
                const D = date.getDate();
                const H = date.getHours();
                const m = date.getMinutes();
                return `${Y}-${M}-${D} ${H}:${m}`;
            });
            return {
                ...data,
                [resKey]: newValues,
            };
        }
        case 'second': {
            const newValues = fieldValues.map(v => {
                const date = new Date(v);
                const Y = date.getFullYear();
                const M = date.getMonth() + 1;
                const D = date.getDate();
                const H = date.getHours();
                const m = date.getMinutes();
                const s = date.getSeconds();
                return `${Y}-${M}-${D} ${H}:${m}:${s}`;
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
    // const { value: fieldKey } = params[0];
    // const fieldValues = data[fieldKey] as number[];
    // let _min = Infinity;
    // let _max = -Infinity;
    // for (let i = 0; i < fieldValues.length; i++) {
    //     let val = fieldValues[i];
    //     if (val > _max) _max = val;
    //     if (val < _min) _min = val;
    // }
    // const step = (_max - _min) / binSize;
    // const beaStep = Math.max(-Math.round(Math.log10(_max - _min)) + 2, 0)
    // const newValues = fieldValues.map((v: number) => {
    //     let bIndex = Math.floor((v - _min) / step);
    //     if (bIndex === binSize) bIndex = binSize - 1;
    //     return Number(((bIndex * step + _min)).toFixed(beaStep))
    // });
    // return {
    //     ...data,
    //     [resKey]: newValues,
    // }
}


export default dateTimeDrill;
