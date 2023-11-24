import { IRow, IFilterFiledSimple } from '../interfaces';
import { newOffsetDate } from './op/offset';

export const filter = (dataSource: IRow[], filters: IFilterFiledSimple[]) => {
    const filterFunctions = filters.flatMap<(item: IRow) => boolean>(({ rule, fid }) => {
        if (!rule) {
            return [];
        }
        switch (rule.type) {
            case 'one of': {
                const set = new Set(rule.value);
                return [(which) => set.has(which[fid])];
            }
            case 'not in': {
                const set = new Set(rule.value);
                return [(which) => !set.has(which[fid])];
            }
            case 'range': {
                return [(which) => rule.value[0] <= which[fid] && which[fid] <= rule.value[1]];
            }
            case 'temporal range': {
                return [
                    (which) => {
                        try {
                            const time = rule.offset ? newOffsetDate(rule.offset)(which[fid]).getTime() : new Date(which[fid]).getTime();
                            return rule.value[0] <= time && time <= rule.value[1];
                        } catch (error) {
                            console.error(error);
                            return false;
                        }
                    },
                ];
            }
            default: {
                console.warn('Unresolvable filter rule', rule);
                return [];
            }
        }
    });
    return dataSource.filter((which) => {
        for (const f of filterFunctions) {
            if (!f(which)) return false;
        }
        return true;
    });
};
