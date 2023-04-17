import { IMutField, IRow } from "../../interfaces";
import { IFoldQuery } from "../interfaces";

export function fold (data: IRow[], query: IFoldQuery, metas: IMutField[]): IRow[] {
    const { foldBy, newFoldKeyCol, newFoldValueCol } = query;
    const ans: IRow[] = [];
    for (let row of data) {
        for (let k of foldBy) {
            const newRow = { ...row };
            newRow[newFoldKeyCol] = metas.find(f => f.fid === k)?.name || k;
            newRow[newFoldValueCol] = row[k];
            delete newRow[k];
            ans.push(newRow);
        }
    }
    return ans;
}