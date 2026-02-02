let inited = false;

import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import initWasm, { parser_dsl_with_table } from '@kanaries/gw-dsl-parser';
import dslWasm from '@kanaries/gw-dsl-parser/gw_dsl_parser_bg.wasm?url';
import { nanoid } from 'nanoid';
import type { IDataSourceProvider, IMutField, IDataSourceListener } from '@kanaries/graphic-walker';
import { exportFullRaw, fromFields } from '@kanaries/graphic-walker';
import { Vector } from 'apache-arrow';
import { bigNumToString } from 'apache-arrow/util/bn';

// Debug logging configuration
// Can be enabled via:
// 1. window.__DUCKDB_DEBUG__ = true (runtime, can be toggled anytime)
// 2. VITE_DUCKDB_DEBUG=true in .env (compile time for Vite apps)
// 3. Automatically enabled in development mode

// Check if Vite env variable is set (evaluated once at load)
let envDebugEnabled = false;
try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DUCKDB_DEBUG) {
        const val = import.meta.env.VITE_DUCKDB_DEBUG;
        envDebugEnabled = val === 'true' || val === '1';
    }
} catch {}

// Dynamic check function - called for each log statement
function isDebugEnabled(): boolean {
    // Check runtime global flag first (allows toggling in console)
    if (typeof window !== 'undefined' && (window as any).__DUCKDB_DEBUG__ !== undefined) {
        return !!(window as any).__DUCKDB_DEBUG__;
    }
    // Check env variable (only enabled when explicitly set)
    return envDebugEnabled;
}

// Export for external access
export { isDebugEnabled as DUCKDB_DEBUG_CHECK };

// Allow runtime toggle: window.__DUCKDB_DEBUG__ = true/false
export function setDuckDBDebug(enabled: boolean): void {
    if (typeof window !== 'undefined') {
        (window as any).__DUCKDB_DEBUG__ = enabled;
        console.log(`%c[DuckDB] Debug logging ${enabled ? 'ENABLED' : 'DISABLED'}`, 
            `color: ${enabled ? '#40c057' : '#868e96'}; font-weight: bold`);
    }
}

// Query counter for tracking
let queryCounter = 0;

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
    },
};

let db: duckdb.AsyncDuckDB;

export async function init() {
    if (inited) return;
    inited = true;
    
    const initStart = performance.now();
    
    if (isDebugEnabled()) {
        console.log('%c[DuckDB] Initializing DuckDB-WASM...', 'color: #f08c00; font-weight: bold');
    }
    
    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    
    if (isDebugEnabled()) {
        console.log(`  Bundle selected: ${bundle.mainModule.includes('eh') ? 'EH (Exception Handling)' : 'MVP'}`);
    }

    const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${new URL(bundle.mainWorker!, window.location.href).href}");`], {
            type: 'text/javascript',
        })
    );

    // Instantiate the asynchronus version of DuckDB-Wasm
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(
        new URL(bundle.mainModule, window.location.href).href,
        bundle.pthreadWorker ? new URL(bundle.pthreadWorker, window.location.href).href : undefined
    );
    URL.revokeObjectURL(worker_url);
    await initWasm(dslWasm);
    
    const initTime = performance.now() - initStart;
    
    if (isDebugEnabled()) {
        console.log(`%c[DuckDB] ✓ Initialized in ${initTime.toFixed(2)}ms`, 'color: #40c057; font-weight: bold');
        console.log(`  DSL Parser: @kanaries/gw-dsl-parser loaded`);
    }
}

const ArrowToJSON = (v: any): any => {
    if (typeof v === 'object') {
        if (v instanceof Vector) {
            return Array.from(v).map(ArrowToJSON);
        } else {
            return parseInt(bigNumToString(v as any));
        }
    }
    if (typeof v === 'bigint') {
        return Number(v);
    }
    return v;
};

const transformData = (table: { toArray: () => any[] }) => {
    return table.toArray().map((r) => Object.fromEntries(Object.entries(r.toJSON()).map(([k, v]) => [k, ArrowToJSON(v)])));
};

export async function getMemoryProvider(): Promise<IDataSourceProvider> {
    await init();
    const conn = await db.connect();
    const datasets: { name: string; id: string }[] = [];
    const metaDict = new Map<string, IMutField[]>();
    const specDict = new Map<string, string>();
    const listeners: IDataSourceListener[] = [];
    
    if (isDebugEnabled()) {
        console.log('%c[DuckDB] getMemoryProvider() — Provider created', 'color: #f08c00; font-weight: bold');
        console.log('  Mode: In-memory DuckDB storage');
        console.log('  Data flow: DSL → SQL (gw-dsl-parser) → DuckDB → Results');
    }

    return {
        async getDataSourceList() {
            return datasets;
        },
        async addDataSource(data: Record<string, unknown>[], meta: IMutField[], name: string) {
            const startTime = performance.now();
            const id = nanoid().replace('-', '');
            const filename = `${id}.json`;
            await db.registerFileText(filename, JSON.stringify(data));
            await conn.insertJSONFromPath(filename, { name: id });
            datasets.push({ id, name });
            metaDict.set(id, meta);
            specDict.set(id, JSON.stringify([exportFullRaw(fromFields(meta, 'Chart 1'))]));
            
            const loadTime = performance.now() - startTime;
            
            if (isDebugEnabled()) {
                console.log('%c[DuckDB] addDataSource() — Data loaded into DuckDB', 'color: #40c057; font-weight: bold');
                console.log(`  Dataset: "${name}" (id: ${id})`);
                console.log(`  Rows: ${data.length.toLocaleString()}`);
                console.log(`  Fields: ${meta.length} (${meta.map(m => m.fid).join(', ')})`);
                console.log(`  Load time: ${loadTime.toFixed(2)}ms`);
                console.log(`  Table created: ${id}`);
            }
            
            return id;
        },
        async getMeta(datasetId: string) {
            const meta = metaDict.get(datasetId);
            if (!meta) {
                throw new Error('cannot find meta');
            }
            return meta;
        },
        async setMeta(datasetId: string, meta: IMutField[]) {
            metaDict.set(datasetId, meta);
            listeners.forEach((cb) => cb(2, datasetId));
        },
        async getSpecs(datasetId: string) {
            const specs = specDict.get(datasetId);
            if (!specs) {
                throw new Error('cannot find specs');
            }
            return specs;
        },
        async saveSpecs(datasetId: string, value: string) {
            specDict.set(datasetId, value);
            listeners.forEach((cb) => cb(4, datasetId));
        },
        async queryData(query: unknown, datasetIds: string[]) {
            const queryId = ++queryCounter;
            const startTime = performance.now();
            
            const sql = parser_dsl_with_table(datasetIds[0], JSON.stringify(query));
            
            if (isDebugEnabled()) {
                console.log(`%c[DuckDB] queryData() #${queryId} — Executing SQL`, 'color: #339af0; font-weight: bold');
                console.log('  DSL Query:', query);
                console.log('  Generated SQL:', sql);
            }
            
            const res = await conn.query(sql).then(transformData);
            
            const queryTime = performance.now() - startTime;
            
            if (isDebugEnabled()) {
                console.log(`%c[DuckDB] queryData() #${queryId} — Complete`, 'color: #40c057');
                console.log(`  Result rows: ${res.length.toLocaleString()}`);
                console.log(`  Query time: ${queryTime.toFixed(2)}ms`);
            }
            
            return res;
        },
        registerCallback(cb: IDataSourceListener) {
            listeners.push(cb);
            return () => {
                listeners.filter((x) => x !== cb);
            };
        },
    };
}

export async function getComputation(data: Record<string, unknown>[]) {
    if (data.length === 0) {
        if (isDebugEnabled()) {
            console.log('%c[DuckDB] getComputation() — Empty dataset, returning no-op', 'color: #868e96');
        }
        return {
            close: async () => {},
            computation: async () => [],
        };
    }
    
    await init();
    
    const setupStart = performance.now();
    const tableName = nanoid().replace('-', '');
    const fileName = `${tableName}.json`;
    const conn = await db.connect();
    await db.registerFileText(fileName, JSON.stringify(data));
    await conn.insertJSONFromPath(fileName, { name: tableName });
    const setupTime = performance.now() - setupStart;
    
    if (isDebugEnabled()) {
        console.log('%c[DuckDB] getComputation() — Computation context created', 'color: #f08c00; font-weight: bold');
        console.log(`  Table: ${tableName}`);
        console.log(`  Rows: ${data.length.toLocaleString()}`);
        console.log(`  Setup time: ${setupTime.toFixed(2)}ms`);
        console.log('  Data flow: DSL → SQL (gw-dsl-parser) → DuckDB → Results');
    }
    
    // Local query counter for this computation instance
    let localQueryCounter = 0;
    
    return {
        close: async () => {
            if (isDebugEnabled()) {
                console.log(`%c[DuckDB] Computation closed (table: ${tableName})`, 'color: #868e96');
            }
            await conn.close();
            await db.dropFile(fileName);
        },
        computation: async (query: unknown) => {
            const queryId = ++localQueryCounter;
            const startTime = performance.now();
            
            const sql = parser_dsl_with_table(tableName, JSON.stringify(query));
            
            if (isDebugEnabled()) {
                console.log(`%c[DuckDB] computation() #${queryId} — Executing SQL`, 'color: #339af0; font-weight: bold');
                console.log('  DSL Query:', query);
                console.log('  Generated SQL:', sql);
            }
            
            const res = await conn.query(sql).then(transformData);
            
            const queryTime = performance.now() - startTime;
            
            if (isDebugEnabled()) {
                console.log(`%c[DuckDB] computation() #${queryId} — Complete`, 'color: #40c057');
                console.log(`  Result rows: ${res.length.toLocaleString()}`);
                console.log(`  Query time: ${queryTime.toFixed(2)}ms`);
            }
            
            return res;
        },
    };
}
