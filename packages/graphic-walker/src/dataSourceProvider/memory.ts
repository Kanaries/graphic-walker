import { getComputation as getClientComputation } from '../computation/clientComputation';
import { getDuckDBComputation, isDuckDBEnabled } from '../computation/duckdbComputation';
import { DUCKDB_DEBUG } from '../constants';
import { IComputationFunction, IDataSourceEventType, IDataSourceListener, IDataSourceProvider, IRow } from '../interfaces';
import { DataStore } from '../store/dataStore';

// Debug logging helper
const log = (...args: unknown[]) => { if (DUCKDB_DEBUG) console.log(...args); };

// Cache for DuckDB computations per dataset
const duckDBComputationCache = new Map<string, IComputationFunction>();

// Get computation function - uses DuckDB when enabled, falls back to client computation
async function getComputation(data: IRow[], datasetId: string): Promise<IComputationFunction> {
    log(`%c[MemoryProvider] getComputation called`, 'color: #339af0');
    log(`  Dataset: ${datasetId}, Rows: ${data.length}, DuckDB enabled: ${isDuckDBEnabled()}`);
    
    if (!isDuckDBEnabled()) {
        log('  → Using client computation (DuckDB disabled)');
        return getClientComputation(data);
    }
    
    // Check cache first
    const cached = duckDBComputationCache.get(datasetId);
    if (cached) {
        log('  → Using cached DuckDB computation');
        return cached;
    }
    
    // Try to get DuckDB computation
    log('  → Attempting to get DuckDB computation...');
    const duckDBComp = await getDuckDBComputation(data);
    if (duckDBComp) {
        log('%c  → DuckDB computation ready!', 'color: #40c057');
        duckDBComputationCache.set(datasetId, duckDBComp);
        return duckDBComp;
    }
    
    // Fallback to client computation
    log('%c  → Fallback to client computation', 'color: #868e96');
    return getClientComputation(data);
}

export function createMemoryProvider(initData?: string | null): IDataSourceProvider & { exportData(): string } {
    const store = new DataStore();
    const listeners: IDataSourceListener[] = [];
    
    // Log provider creation (only when debug enabled)
    if (DUCKDB_DEBUG) {
        if (isDuckDBEnabled()) {
            console.log('%c[MemoryProvider] DuckDB mode enabled', 'color: #40c057; font-weight: bold');
        } else {
            console.log('%c[MemoryProvider] Using in-memory JavaScript computation', 'color: #868e96');
        }
    }

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
            return meta;
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
                throw new Error('cannot find dataset');
            }
            const metaId = dataSet.metaId;
            const specs = store.visDict[metaId];
            if (!specs) {
                throw new Error('cannot find specs');
            }
            return JSON.stringify(specs);
        },
        async saveSpecs(datasetId, value) {
            const dataSet = store.dataSources.find((x) => x.id === datasetId);
            if (!dataSet) {
                throw new Error('cannot find dataset');
            }
            const metaId = dataSet.metaId;
            store.visDict[metaId] = JSON.parse(value);
            listeners.forEach((cb) => cb(IDataSourceEventType.updateSpec, dataSet.id));
        },
        async queryData(query, datasetIds) {
            log('%c[MemoryProvider] queryData called', 'color: #339af0', { datasetIds, query });
            // TODO: add support for querying multi datasource
            const dataSet = store.dataSources.find((x) => x.id === datasetIds[0]);
            if (!dataSet) {
                throw new Error('cannot find dataset');
            }
            const computation = await getComputation(dataSet.data, dataSet.id);
            const result = await computation(query);
            log('%c[MemoryProvider] queryData result', 'color: #339af0', { rows: result.length });
            return result;
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
