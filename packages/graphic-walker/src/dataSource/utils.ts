import { IRow, IMutField } from '../interfaces';
import { inferMeta } from '../lib/inferMeta';
import { flatKeys, guardDataKeys } from '../utils/dataPrep';

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
    const sampleRecord = dataSource[0];
    // const rawKeys = Object.keys(sampleRecord);
    // let flatColKeys: string[] = flatNestKeys(sampleRecord);

    const keys = flatKeys(sampleRecord);
    const metas = inferMeta({
        dataSource,
        fields: keys.map((k) => ({
            fid: k[k.length - 1],
            key: k[k.length - 1],
            analyticType: '?',
            semanticType: '?',
            path: k,
            basename: k[k.length - 1],
            name: k.join('.'),
        })),
    });
    const { safeData, safeMetas } = guardDataKeys(dataSource, metas);
    const finalData: IRow[] = [];
    for (let record of safeData) {
        const newRecord: IRow = {};
        for (let field of safeMetas) {
            if (field.semanticType === 'quantitative') {
                newRecord[field.fid] = Number(record[field.fid]);
            } else {
                newRecord[field.fid] = record[field.fid]; //getValueByKeyPath(record, field.fid);// record[field.fid];
            }
        }
        finalData.push(newRecord);
    }
    return {
        dataSource: finalData,
        fields: safeMetas,
    };
}
