import type { IDataQueryPayload, IDataSourceListener, IDataSourceProvider, IMutField, IRow } from '@kanaries/graphic-walker';
import { nanoid } from 'nanoid';
import { createListenerRegistry, loadJSONTable } from './runtime';
import { transformData } from './result';

interface ProviderDatabase {
    registerFileText(fileName: string, content: string): Promise<unknown>;
    dropFile(fileName: string): Promise<unknown>;
}

interface ProviderConnection {
    insertJSONFromPath(fileName: string, options: { name: string }): Promise<unknown>;
    query(sql: string): Promise<any>;
    close(): Promise<void>;
}

interface ProviderDependencies {
    database: ProviderDatabase;
    connection: ProviderConnection;
    compileQuery(tableName: string, query: IDataQueryPayload): string;
    createInitialSpecs(meta: IMutField[]): string;
    eventTypes: {
        updateList: number;
        updateMeta: number;
        updateSpec: number;
    };
}

export function createDuckDBMemoryProvider({ database, connection, compileQuery, createInitialSpecs, eventTypes }: ProviderDependencies): IDataSourceProvider {
    const datasets: { name: string; id: string }[] = [];
    const metaDict = new Map<string, IMutField[]>();
    const specDict = new Map<string, string>();
    const listeners = createListenerRegistry<IDataSourceListener>();

    return {
        async getDataSourceList() {
            return datasets;
        },
        async addDataSource(data: IRow[], meta: IMutField[], name: string) {
            const id = nanoid().replace('-', '');
            const fileName = `${id}.json`;
            await loadJSONTable(connection, database, fileName, id, data, false);
            datasets.push({ id, name });
            metaDict.set(id, meta);
            specDict.set(id, createInitialSpecs(meta));
            listeners.emit(eventTypes.updateList, '');
            return id;
        },
        async getMeta(datasetId) {
            const meta = metaDict.get(datasetId);
            if (!meta) throw new Error('cannot find meta');
            return meta;
        },
        async setMeta(datasetId, meta) {
            metaDict.set(datasetId, meta);
            listeners.emit(eventTypes.updateMeta, datasetId);
        },
        async getSpecs(datasetId) {
            const specs = specDict.get(datasetId);
            if (!specs) throw new Error('cannot find specs');
            return specs;
        },
        async saveSpecs(datasetId, value) {
            specDict.set(datasetId, value);
            listeners.emit(eventTypes.updateSpec, datasetId);
        },
        async queryData(query, datasetIds) {
            const sql = compileQuery(datasetIds[0], query);
            if (process.env.NODE_ENV !== 'production') console.log(query, sql);
            return connection.query(sql).then(transformData);
        },
        registerCallback(callback) {
            return listeners.add(callback);
        },
    };
}
