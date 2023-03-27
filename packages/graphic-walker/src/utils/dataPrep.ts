import { IRow } from "visual-insights";
import { IMutField } from "../interfaces";

function updateRowKeys(data: IRow[], keyEncodeList: {from: string; to: string}[]): IRow[] {
    return data.map((row) => {
        const newRow: IRow = {};
        for (let k in keyEncodeList) {
            const { from, to } = keyEncodeList[k];
            newRow[to] = row[from];
        }
        return newRow;
    });
}

/**
 * parse column id(key) to a safe string
 * @param metas 
 */
function parseColumnMetas (metas: IMutField[]) {
    return metas.map((meta, i) => {
        const safeKey = `gwc_${i}`;
        return {
            ...meta,
            key: safeKey,
            fid: safeKey,
        };
    });
}

export function guardDataKeys (data: IRow[], metas: IMutField[]): {
    safeData: IRow[];
    safeMetas: IMutField[];
} {
    const safeMetas = parseColumnMetas(metas)
    const keyEncodeList = safeMetas.map((f, i) => ({
        from: metas[i].fid,
        to: f.fid
    }));
    const safeData = updateRowKeys(data, keyEncodeList);
    return {
        safeData,
        safeMetas
    }
}

const SPLITOR = '__'
export function flatNestKeys (object: any): string[] {
    const keys = Object.keys(object);
    let flatColKeys: string[] = [];
    for (let key of keys) {
        if (typeof object[key] === 'object') {
            const subKeys = flatNestKeys(object[key]);
            flatColKeys = flatColKeys.concat(subKeys.map(k => `${key}${SPLITOR}${k}`));
        } else {
            flatColKeys.push(key)
        }
    }
    return flatColKeys;
}

export function getValueByKeyPath (object: any, keyPath: string): any {
    const keys = keyPath.split(SPLITOR);
    let value = object;
    for (let key of keys) {
        value = value[key];
    }
    return value;
}