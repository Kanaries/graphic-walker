import { computed, makeAutoObservable, toJS } from 'mobx';
import { DataSet, IAnalyticType, IDataSource, IMutField, IRow, ISemanticType } from '../interfaces';
import { VizSpecStore } from './visualSpecStore';
import { getComputation } from '../computation/clientComputation';
import { IStoInfo, IStoInfoV2, IStoInfoV2SchemaUrl, forwardVisualConfigs, visSpecDecoder } from '../utils/save';
import { uniqueId } from '../models/utils';

const emptyMeta: IMutField[] = [];

const emptyVizStore = new VizSpecStore([]);

export class DataStore {
    metaDict: Record<string, IMutField[]> = {};
    metaMap: Record<string, string> = {};
    visDict: Record<string, VizSpecStore> = {};
    dataSources: Required<IDataSource>[] = [];
    dsIndex = 0;

    constructor() {
        makeAutoObservable(this, {
            dataSource: computed.struct,
        });
    }

    get dataSource(): Required<IDataSource> | undefined {
        return this.dataSources[this.dsIndex];
    }

    get metaId() {
        return this.dataSource?.metaId;
    }

    get meta() {
        if (!this.metaId) return emptyMeta;
        return this.metaDict[this.metaId] ?? emptyMeta;
    }

    get computation() {
        return this.dataSource?.data ? getComputation(toJS(this.dataSource.data)) : async () => [];
    }

    get visSpecStore() {
        if (!this.metaId || !this.meta.length) return emptyVizStore;
        if (!this.visDict[this.metaId])
            this.visDict[this.metaId] = new VizSpecStore(this.meta, { onMetaChange: (f, d) => this.updateCurrentDatasetMetas(f, d) });
        return this.visDict[this.metaId];
    }

    get currentDataset(): DataSet {
        return {
            dataSource: this.dataSource?.data ?? [],
            id: this.dataSource?.id ?? '',
            name: this.dataSource?.name ?? '',
            rawFields: this.meta,
        };
    }

    updateCurrentDatasetMetas(fid: string, diffMeta: Partial<IMutField>) {
        const field = this.meta.find((f) => f.fid === fid);
        if (field) {
            for (let mk in diffMeta) {
                field[mk] = diffMeta[mk];
            }
        }
    }

    useDS(dsid: string) {
        const index = this.dataSources.findIndex((x) => x.id === dsid);
        if (index > -1) {
            this.setDatasetIndex(index);
        }
    }

    setDatasetIndex(i: number) {
        this.dsIndex = i;
    }

    importData(data: IStoInfo) {
        if (data.$schema === IStoInfoV2SchemaUrl) {
            this.metaDict = data.metaDict;
            const metaMap: Record<string, string> = {};
            Object.keys(data.metaDict).forEach((k) => {
                const meta = data.metaDict[k];
                metaMap[encodeMeta(meta)] = k;
            });
            this.metaMap = metaMap;
            this.dataSources = data.datasets;
            this.visDict = Object.fromEntries(
                Object.entries(data.specDict).map(([key, info]) => {
                    const store = new VizSpecStore(data.metaDict[key], { empty: true, onMetaChange: (f, d) => this.updateCurrentDatasetMetas(f, d) });
                    store.importRaw(info);
                    return [key, store];
                })
            );
        } else {
            const metaDict: Record<string, IMutField[]> = {};
            const dsDict = Object.fromEntries(data.dataSources.map((x) => [x.id, x]));
            const dataSources: Required<IDataSource>[] = [];
            const metaMap: Record<string, string> = {};
            const visDict: Record<string, VizSpecStore> = {};
            data.datasets.forEach(({ dsId, id, name, rawFields }) => {
                const key = encodeMeta(rawFields);
                if (metaMap[key]) {
                    id = metaMap[key];
                } else {
                    metaMap[key] = id;
                    metaDict[id] = rawFields;
                    visDict[id] = new VizSpecStore(rawFields, { empty: true, onMetaChange: (f, d) => this.updateCurrentDatasetMetas(f, d) });
                }
                const ds = dsDict[dsId]!;
                dataSources.push({
                    data: ds.data,
                    id: dsId,
                    metaId: id,
                    name,
                });
            });
            const [defaultId] = Object.keys(metaDict);
            if (defaultId) {
                data.specList.forEach((x) => {
                    const key = encodeMeta(x.encodings.dimensions.concat(x.encodings.measures).filter((x) => !x.computed));
                    const store = visDict[key] || visDict[defaultId];
                    store.appendFromOld(x);
                });
            }
            this.metaDict = metaDict;
            this.visDict = visDict;
            this.dataSources = dataSources;
            this.dsIndex = 0;
        }
    }

    exportData(): IStoInfoV2 {
        const resultSpecList: Record<string, string[]> = {};
        Object.keys(this.visDict).forEach((k) => {
            resultSpecList[k] = this.visDict[k].exportAllCharts();
        });
        return {
            $schema: IStoInfoV2SchemaUrl,
            datasets: toJS(this.dataSources),
            metaDict: toJS(this.metaDict),
            specDict: resultSpecList,
        };
    }

    addDataSource(data: { data: IRow[]; fields: IMutField[]; name: string }) {
        const metaKey = encodeMeta(data.fields);
        if (!this.metaMap[metaKey]) {
            this.metaMap[metaKey] = uniqueId();
        }
        const id = this.metaMap[metaKey];
        this.metaDict[id] = data.fields;
        this.dataSources.push({
            data: data.data,
            id: uniqueId(),
            metaId: id,
            name: data.name,
        });
        this.dsIndex = this.dataSources.length - 1;
    }
}

function encodeMeta(
    m: {
        name?: string;
        analyticType: IAnalyticType;
        semanticType: ISemanticType;
    }[]
) {
    return m
        .map((x) => `${x.name}-${x.analyticType[0]}-${x.semanticType[0]}`)
        .sort()
        .join(',');
}
