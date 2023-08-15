import { IRow } from "../../interfaces";
import { IFoldQuery } from "../../interfaces";

export function fold (data: IRow[], query: IFoldQuery): IRow[] {
    const { foldBy, newFoldKeyCol, newFoldValueCol } = query;
    const ans: IRow[] = [];
    for (let row of data) {
        for (let k of foldBy) {
            const newRow = { ...row };
            newRow[newFoldKeyCol] = k;
            newRow[newFoldValueCol] = row[k];
            delete newRow[k];
            ans.push(newRow);
        }
    }
    return ans;
}