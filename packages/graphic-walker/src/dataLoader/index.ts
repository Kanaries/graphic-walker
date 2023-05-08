import type { DataSet, IDataPreviewPayload, IDataQueryPayload, IFieldStats, IMutField, IRow } from "../interfaces";


export interface IDataQueryOptions {
    dataset: DataSet;
    columns: IMutField[];
}

export type GWStatFunction = (dataset: DataSet) => Promise<{ count: number }>;
export type GWPreviewFunction = (payload: IDataPreviewPayload, options: IDataQueryOptions) => Promise<IRow[]>;
export type GWTransformFunction = (payload: IDataQueryPayload, options: IDataQueryOptions) => Promise<IRow[]>;
export type GWStatFieldFunction = (dataset: DataSet, fid: string, attributes: { values?: boolean; range?: boolean; }) => Promise<IFieldStats>;

export interface IGWDataLoader {
    stat: GWStatFunction;
    preview: GWPreviewFunction;
    transform: GWTransformFunction;
    statField: GWStatFieldFunction;
}
