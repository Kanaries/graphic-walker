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
    console.log(keyEncodeList, metas, safeMetas)
    const safeData = updateRowKeys(data, keyEncodeList);
    return {
        safeData,
        safeMetas
    }
}