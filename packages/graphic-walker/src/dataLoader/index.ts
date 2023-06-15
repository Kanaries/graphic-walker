import type { ILoadDataPayload, IDataQueryPayload, IFieldStats, IRow, IGWDatasetStat } from "../interfaces";
import type { IVisDataset } from "../vis/protocol/interface";


export type GWSyncMetaFunction = (dataset: IVisDataset) => Promise<void>;
export type GWSyncDataFunction = (dataSource: IRow[]) => Promise<void>;
export type GWLoadMetaFunction = () => Promise<IVisDataset>;
export type GWLoadDataFunction = (payload: ILoadDataPayload) => Promise<IRow[]>;
export type GWUseMetaFunction = () => [dataset: IVisDataset, loading: boolean];
export type GWUseDataFunction = (payload: ILoadDataPayload) => [data: IRow[], loading: boolean];
export type GWStatFunction = () => Promise<IGWDatasetStat>;
export type GWStatFieldFunction = (fid: string, attributes: { values?: boolean; range?: boolean; }) => Promise<IFieldStats>;
export type GWTransformFunction = (payload: IDataQueryPayload) => Promise<IRow[]>;

export interface IGWDataLoader {
    syncMeta: GWSyncMetaFunction;
    syncData: GWSyncDataFunction;
    loadMeta: GWLoadMetaFunction;
    useMeta: GWUseMetaFunction;
    loadData: GWLoadDataFunction;
    useData: GWUseDataFunction;
    stat: GWStatFunction;
    statField: GWStatFieldFunction;
    query: GWTransformFunction;
}
