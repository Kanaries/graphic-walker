import { getComputation } from '../computation/clientComputation';
import { IDataSourceEventType, IDataSourceListener, IDataSourceProvider } from '../interfaces';
import { DataStore } from '../store/dataStore';

export function createMemoryProvider(initData?: string | null): IDataSourceProvider & { exportData(): string } {
    const store = new DataStore();
    const listeners: IDataSourceListener[] = [];

    initData && store.importData(JSON.parse(initData));

    return {
        async getDataSourceList() {
            return store.dataSources.map((x) => ({
                id: x.id,
                name: x.name,
            }));
        },
        async addDataSource(data, meta, name) {
            const id = store.addDataSource({
                data,
                fields: meta,
                name,
            });
            listeners.forEach((cb) => cb(IDataSourceEventType.updateList, ''));
            return id;
        },
        async getMeta(datasetId) {
            const dataSet = store.dataSources.find((x) => x.id === datasetId);
            if (!dataSet) {
                throw new Error('cannot find dataset');
            }
            const metaId = dataSet.metaId;
            const meta = store.metaDict[metaId];
            if (!meta) {
                throw new Error('cannot find meta');
            }
            return meta.map((x) => ({ ...x, dataset: datasetId }));
        },
        async setMeta(datasetId, meta) {
            const dataSet = store.dataSources.find((x) => x.id === datasetId);
            if (!dataSet) {
                throw new Error('cannot find dataset');
            }
            const metaId = dataSet.metaId;
            store.metaDict[metaId] = meta;
            listeners.forEach((cb) => cb(IDataSourceEventType.updateMeta, dataSet.id));
        },
        async getSpecs(datasetId) {
            const dataSet = store.dataSources.find((x) => x.id === datasetId);
            if (!dataSet) {
                if (store.visDict[datasetId]) {
                    return JSON.stringify(store.visDict[datasetId]);
                }
                const datasets: string[] = JSON.parse(datasetId);
                const fields = store.dataSources
                    .filter((x) => datasets.includes(x.id))
                    .flatMap((ds) => store.metaDict[ds.metaId].map((x) => ({ ...x, dataset: ds.id })));
                store.createVis(datasetId, fields);
                return JSON.stringify(store.visDict[datasetId]);
            } else {
                const metaId = dataSet.metaId;
                const specs = store.visDict[metaId];
                if (!specs) {
                    throw new Error('cannot find specs');
                }
                return JSON.stringify(specs);
            }
        },
        async saveSpecs(datasetId, value) {
            const dataSet = store.dataSources.find((x) => x.id === datasetId);
            if (!dataSet) {
                if (!store.visDict[datasetId]) {
                    throw new Error('cannot find dataset');
                }
                store.visDict[datasetId] = JSON.parse(value);
                listeners.forEach((cb) => cb(IDataSourceEventType.updateSpec, datasetId));
            } else {
                const metaId = dataSet.metaId;
                store.visDict[metaId] = JSON.parse(value);
                listeners.forEach((cb) => cb(IDataSourceEventType.updateSpec, dataSet.id));
            }
        },
        async queryData(query, datasetIds) {
            const dataSets = store.dataSources.filter((x) => datasetIds.includes(x.id));
            if (!dataSets.length) {
                throw new Error('cannot find dataset');
            }
            if (dataSets.length === 1) {
                return getComputation(dataSets[0].data)(query);
            }
            return getComputation(Object.fromEntries(dataSets.map((x) => [x.id, x.data])))(query);
        },
        async onExportFile() {
            const data = store.exportData();
            const result = new Blob([JSON.stringify(data)], { type: 'text/plain' });
            return result;
        },
        async onImportFile(file) {
            const data = await file.text();
            store.importData(JSON.parse(data));
            listeners.forEach((cb) => cb(IDataSourceEventType.updateList, ''));
        },
        registerCallback(cb) {
            listeners.push(cb);
            return () => {
                listeners.filter((x) => x !== cb);
            };
        },
        exportData() {
            return JSON.stringify(store.exportData());
        },
    };
}
