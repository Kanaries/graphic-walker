import { IRow, IFilterFiledSimple } from '../interfaces';
import { newOffsetDate } from './op/offset';

export const filter = (dataSource: IRow[], filters: IFilterFiledSimple[]) => {
    return dataSource.filter((which) => {
        for (const { rule, fid } of filters) {
            if (!rule) {
                continue;
            }
            switch (rule.type) {
                case 'one of': {
                    if (rule.value.has(which[fid])) {
                        break;
                    } else {
                        return false;
                    }
                }
                case 'not in': {
                    if (rule.value.has(which[fid])) {
                    } else {
                        break;
                    }
                }
                case 'range': {
                    if (rule.value[0] <= which[fid] && which[fid] <= rule.value[1]) {
                        break;
                    } else {
                        return false;
                    }
                }
                case 'temporal range': {
                    try {
                        const time = rule.offset ? newOffsetDate(rule.offset)(which[fid]).getTime() : new Date(which[fid]).getTime();
                        if (rule.value[0] <= time && time <= rule.value[1]) {
                            break;
                        } else {
                            return false;
                        }
                    } catch (error) {
                        console.error(error);
                        return false;
                    }
                }
                case 'regexp': {
                    if (new RegExp(rule.value, rule.caseSensitive ? '' : 'i').test(which[fid])) {
                        break;
                    } else {
                        return false;
                    }
                }
                default: {
                    console.warn('Unresolvable filter rule', rule);
                    continue;
                }
            }
        }

        return true;
    });
};
