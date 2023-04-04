import { IRow } from "visual-insights";
import { IAggQuery } from "../interfaces";
import { sum, mean, median, stdev, variance, max, min, count } from "./stat";

const aggregatorMap = {
    sum,
    mean,
    median,
    stdev,
    variance,
    max,
    min,
    count,
};

const KEY_JOINER = '___';

export function aggregate (data: IRow[], query: IAggQuery): IRow[] {
    const { groupBy, agg } = query;
    const ans: Map<string, IRow> = new Map();
    const groups: Map<string, IRow[]> = new Map();
    for (let row of data) {
        const gk = groupBy.map((k) => row[k]).join(KEY_JOINER);

        if (!groups.has(gk)) {
            groups.set(gk, []);
        }
        groups.get(gk)?.push(row);
    }
    for (let [gk, subGroup] of groups) {
        if (subGroup.length === 0) {
            continue;
        }
        let aggRow: IRow = {};
        for (let k of groupBy) {
            aggRow[k] = subGroup[0][k];
        }
        for (let meaKey in agg) {
            if (aggRow[meaKey] === undefined) {
                aggRow[meaKey] = 0;
            }
            const values: number[] = subGroup.map((r) => r[meaKey]) ?? [];
            const aggregator = aggregatorMap[agg[meaKey]] ?? sum;
            aggRow[meaKey] = aggregator(values);
        }
        ans.set(gk, aggRow);
    }
    return Array.from(ans.values());
}