import { MEA_VAL_ID, MEA_KEY_ID } from '../../constants';
import { IRow, IViewField } from '../../interfaces';
import { getMeaAggKey, getMeaAggName } from '../../utils';
import { IFoldQuery } from '../../interfaces';

export function fold(data: IRow[], query: IFoldQuery): IRow[] {
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

export function replaceAggForFold<T extends { aggName?: string }>(x: T, newAggName?: string) {
    if (x.aggName === 'expr') {
        return x;
    }
    return {
        ...x,
        aggName: newAggName,
    };
}

export function fold2(
    data: IRow,
    defaultAggregated: boolean,
    allFields: IViewField[],
    viewMeasures: IViewField[],
    viewDimensions: IViewField[],
    folds?: string[]
) {
    const meaVal = viewMeasures.find((x) => x.fid === MEA_VAL_ID);
    if (viewDimensions.find((x) => x.fid === MEA_KEY_ID) && meaVal) {
        if (!folds?.length) {
            return [];
        }
        const foldedFields = (folds ?? [])
            .map((x) => allFields.find((y) => y.fid === x)!)
            .filter(Boolean)
            .filter(x => defaultAggregated || x.aggName !== 'expr')
            .map((x) => {
                if (defaultAggregated) {
                    const fieldWithReplacedAgg = replaceAggForFold(x, meaVal.aggName);
                    return {
                        name: getMeaAggName(fieldWithReplacedAgg.name, fieldWithReplacedAgg.aggName),
                        fid: getMeaAggKey(fieldWithReplacedAgg.fid, fieldWithReplacedAgg.aggName),
                    };
                }
                return { name: x.name, fid: x.fid };
            });
        const set = new Set(foldedFields.map((x) => x.fid));
        return data.flatMap((x) => {
            const i = Object.fromEntries(Object.entries(x).filter((x) => !set.has(x[0])));
            return foldedFields.map((k) => ({
                ...i,
                [MEA_KEY_ID]: k.name,
                [defaultAggregated ? getMeaAggKey(MEA_VAL_ID, meaVal.aggName) : MEA_VAL_ID]: x[k.fid],
            }));
        });
    }
    return data;
}
