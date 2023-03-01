import { IRow } from "visual-insights";
import { IAggQuery } from "../interfaces";

const KEY_JOINER = '___';

export function aggregate (data: IRow[], query: IAggQuery): IRow[] {
    const { groupBy, agg } = query;
    const ans: Map<string, IRow> = new Map();
    for (let row of data) {
        const gk = groupBy.map((k) => row[k]).join(KEY_JOINER);
        let aggRow: IRow = {};

        if (!ans.has(gk)) {
            for (let k of groupBy) {
                aggRow[k] = row[k];
            }
            ans.set(gk, aggRow);
        }


        aggRow = ans.get(gk)!;
        for (let k in agg) {
            if (aggRow[k] === undefined) {
                aggRow[k] = 0;
            }
            switch (agg[k]) {
                case 'sum':
                    aggRow[k] += row[k];
                    break;
                case 'avg':
                    aggRow[k] += row[k];
                    break;
                case 'count':
                    aggRow[k] += 1;
                    break;
                case 'max':
                    aggRow[k] = Math.max(aggRow[k], row[k]);
                    break;
                case 'min':
                    aggRow[k] = Math.min(aggRow[k], row[k]);
                    break;
            }
        }
    }
    return Array.from(ans.values());
}