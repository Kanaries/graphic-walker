import type { DataSet, IDataQueryPayload, IFieldStats, IMutField, IRow } from "../interfaces";


export interface IDataQueryOptions {
    dataset: DataSet;
    columns: IMutField[];
}

export type GWTransformFunction = (payload: IDataQueryPayload, options: IDataQueryOptions) => Promise<IRow[]>;

export interface IGWDataLoader {
    transform: GWTransformFunction;
    statField: (dataset: DataSet, fid: string, attributes: {
        values?: boolean;
        range?: boolean;
    }) => Promise<IFieldStats>;
}
