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

/** Result-column identity is separate from its display label, which need not be unique. */
export interface FoldBranch {
    readonly fid: string;
    readonly aggName?: string;
    readonly columnKey: string;
    readonly label: string;
}

export interface FoldRecordMetadata {
    readonly inputIndex: number;
    readonly branch?: FoldBranch;
}

function foldBranches(defaultAggregated: boolean, allFields: readonly IViewField[], meaVal: IViewField, folds?: readonly string[]): FoldBranch[] {
    return (folds ?? [])
        .map((fid) => allFields.find((field) => field.fid === fid))
        .filter((field): field is IViewField => Boolean(field))
        .filter((field) => defaultAggregated || field.aggName !== 'expr')
        .map((field) => {
            const effective = defaultAggregated ? replaceAggForFold(field, meaVal.aggName) : field;
            return {
                fid: field.fid,
                ...(defaultAggregated && effective.aggName ? { aggName: effective.aggName } : {}),
                columnKey: defaultAggregated ? getMeaAggKey(effective.fid, effective.aggName) : effective.fid,
                label: defaultAggregated ? getMeaAggName(effective.name, effective.aggName) : effective.name,
            };
        });
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
        const foldedFields = foldBranches(defaultAggregated, allFields, meaVal, folds);
        const set = new Set(foldedFields.map((x) => x.columnKey));
        return data.flatMap((x) => {
            const i = Object.fromEntries(Object.entries(x).filter((x) => !set.has(x[0])));
            return foldedFields.map((k) => ({
                ...i,
                [MEA_KEY_ID]: k.label,
                [defaultAggregated ? getMeaAggKey(MEA_VAL_ID, meaVal.aggName) : MEA_VAL_ID]: x[k.columnKey],
            }));
        });
    }
    return data;
}

/**
 * The same legacy fold values plus host-only provenance. No metadata is placed in a row
 * or IChart. Call with the query output before fold2, not an already folded result.
 */
export function fold2WithMetadata(
    data: readonly IRow[],
    defaultAggregated: boolean,
    allFields: readonly IViewField[],
    viewMeasures: readonly IViewField[],
    viewDimensions: readonly IViewField[],
    folds?: readonly string[]
): { records: readonly IRow[]; metadata: readonly FoldRecordMetadata[]; branches: readonly FoldBranch[]; active: boolean } {
    const meaVal = viewMeasures.find((field) => field.fid === MEA_VAL_ID);
    const active = Boolean(meaVal && viewDimensions.some((field) => field.fid === MEA_KEY_ID));
    const branches = active ? foldBranches(defaultAggregated, allFields, meaVal!, folds) : [];
    const records: readonly IRow[] = fold2(data, defaultAggregated, [...allFields], [...viewMeasures], [...viewDimensions], folds ? [...folds] : undefined);
    const metadata = active
        ? data.flatMap((_, inputIndex) => branches.map((branch) => ({ inputIndex, branch })))
        : data.map((_, inputIndex) => ({ inputIndex }));
    return { records, metadata, branches, active };
}
