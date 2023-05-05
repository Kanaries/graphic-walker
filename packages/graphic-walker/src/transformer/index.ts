import type { DataSet, IDataQueryPayload, IMutField, IRow } from "../interfaces";


export interface IDataQueryOptions {
    dataset: DataSet;
    columns: IMutField[];
}

export type GWTransformFunction = (payload: IDataQueryPayload, options: IDataQueryOptions) => Promise<IRow[]>;

export interface IGWTransformer {
    transform: GWTransformFunction;
}
