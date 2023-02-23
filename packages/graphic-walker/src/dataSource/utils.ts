import { IRow, IMutField } from "../interfaces";
import { inferMeta } from "../lib/inferMeta";
import { guardDataKeys } from "../utils/dataPrep";

export function transData(dataSource: IRow[]): {
    dataSource: IRow[];
    fields: IMutField[];
} {
    if (dataSource.length === 0) {
        return {
            dataSource: [],
            fields: [],
        };
    }
    const keys = Object.keys(dataSource[0]);
    const metas = inferMeta({
        dataSource,
        fields: keys.map((k) => ({
            fid: k,
            key: k,
            analyticType: "?",
            semanticType: "?",
        })),
    });
    const { safeData, safeMetas } = guardDataKeys(dataSource, metas);
    const finalData: IRow[] = [];
    for (let record of safeData) {
        const newRecord: IRow = {};
        for (let field of safeMetas) {
            if (field.semanticType === "quantitative") {
                newRecord[field.fid] = Number(record[field.fid]);
            } else {
                newRecord[field.fid] = record[field.fid];
            }
        }
        finalData.push(newRecord);
    }
    return {
        dataSource: finalData,
        fields: safeMetas
    };
}
