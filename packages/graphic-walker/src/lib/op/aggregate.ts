import { IRow } from "../../interfaces";
import { getMeaAggKey } from "../../utils";
import { IAggQuery } from "../../interfaces";
import { sum, mean, median, stdev, variance, max, min, count, distinctCount } from "./stat";

const aggregatorMap = {
    sum,
    mean,
    median,
    stdev,
    variance,
    max,
    min,
    count,
    distinctCount,
};

const KEY_JOINER = '___';

export function aggregate (data: IRow[], query: IAggQuery): IRow[] {
    const { groupBy, measures } = query;
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
        for (let mea of measures) {
            const aggMeaKey = mea.asFieldKey || getMeaAggKey(mea.field, mea.agg);
            if (aggRow[aggMeaKey] === undefined) {
                aggRow[aggMeaKey] = 0;
            }
            const values: number[] = subGroup
                .map((r) => r[mea.field])
                .map((x) => {
                    if (mea.format) {
                        return new Date(x).getTime();
                    }
                    return x;
                });
            const aggregator = aggregatorMap[mea.agg] ?? sum;
            aggRow[aggMeaKey] = aggregator(values);
        }
        ans.set(gk, aggRow);
    }
    return Array.from(ans.values());
}