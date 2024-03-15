import { _unstable_encodeRuleValue } from '@/utils';
import { IRow, IFilterFiledSimple } from '../interfaces';
import { newOffsetDate } from './op/offset';

const toFilterFunc = (filter: IFilterFiledSimple): ((row: IRow) => boolean) => {
    const { rule, fid } = filter;
    if (!rule) {
        return () => true;
    }
    switch (rule.type) {
        case 'one of': {
            const set = new Set(rule.value.map((x) => _unstable_encodeRuleValue(x)));
            return (which) => set.has(_unstable_encodeRuleValue(which[fid]));
        }
        case 'not in': {
            const set = new Set(rule.value.map((x) => _unstable_encodeRuleValue(x)));
            return (which) => !set.has(_unstable_encodeRuleValue(which[fid]));
        }
        case 'range': {
            return (which) => (rule.value[0] ?? -Infinity) <= which[fid] && which[fid] <= (rule.value[1] ?? Infinity);
        }
        case 'temporal range': {
            return (which) => {
                try {
                    const time = rule.offset ? newOffsetDate(rule.offset)(which[fid]).getTime() : new Date(which[fid]).getTime();
                    return (rule.value[0] ?? -Infinity) <= time && time <= (rule.value[1] ?? Infinity);
                } catch (error) {
                    console.error(error);
                    return false;
                }
            };
        }
        case 'regexp': {
            try {
                const regexp = new RegExp(rule.value, rule.caseSensitive ? '' : 'i');
                return (which) => regexp.test(which[fid]);
            } catch (error) {
                console.error(error);
                return () => false;
            }
        }
        default: {
            console.warn('Unresolvable filter rule', rule);
            return () => true;
        }
    }
};

export const filter = (dataSource: IRow[], filters: IFilterFiledSimple[]) => {
    const filterFuncs = filters.map(toFilterFunc);
    return dataSource.filter((which) => {
        for (const f of filterFuncs) {
            if (!f(which)) {
                return false;
            }
        }
        return true;
    });
};
