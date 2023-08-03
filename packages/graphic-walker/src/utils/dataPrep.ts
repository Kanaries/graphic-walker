import { IMutField, IRow } from "../interfaces";
import { isPlainObject } from "./is-plain-object";

function updateRowKeys(data: IRow[], keyEncodeList: { from: string[]; to: string }[]): IRow[] {
    return data.map((row) => {
        const newRow: IRow = {};
        for (let k in keyEncodeList) {
            const { from, to } = keyEncodeList[k];
            newRow[to] = getValueByKeyPath(row, from);
        }
        return newRow;
    });
}

/**
 * parse column id(key) to a safe string
 * @param metas
 */
function parseColumnMetas(metas: IMutField[]) {
    return metas.map((meta, i) => {
        const safeKey = `gwc_${i}`;
        return {
            ...meta,
            key: safeKey,
            fid: safeKey,
        };
    });
}

export function guardDataKeys(
    data: IRow[],
    metas: IMutField[]
): {
    safeData: IRow[];
    safeMetas: IMutField[];
} {
    const safeMetas = parseColumnMetas(metas);
    const keyEncodeList = safeMetas.map((f, i) => ({
        from: metas[i].path ?? [metas[i].fid],
        to: f.fid,
    }));
    const safeData = updateRowKeys(data, keyEncodeList);
    return {
        safeData,
        safeMetas,
    };
}
export function flatKeys(obj: Object, prefixKeys: string[] = []): string[][] {
    return Object.keys(obj).flatMap((k) =>
        isPlainObject(obj[k]) ? flatKeys(obj[k], prefixKeys.concat(k)) : [prefixKeys.concat(k)]
    );
}

export function getValueByKeyPath(object: any, keyPath: string[]): any {
    let value = object;
    for (let key of keyPath) {
        value = value[key];
    }
    return value;
}
