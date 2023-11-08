import { IFilterRule, SetToArray } from '../interfaces';

export function encodeFilterRule(rule: IFilterRule | null): SetToArray<IFilterRule> | null {
    if (!rule) return null;
    if (rule.type === 'one of' || rule.type === 'not in') {
        return {
            ...rule,
            value: [...rule.value],
        };
    }
    return rule;
}
export function decodeFilterRule(rule: SetToArray<IFilterRule> | null): IFilterRule | null {
    if (!rule) return null;
    if (rule.type === 'one of' || rule.type === 'not in') {
        return {
            ...rule,
            value: new Set(rule.value),
        };
    }
    return rule;
}
