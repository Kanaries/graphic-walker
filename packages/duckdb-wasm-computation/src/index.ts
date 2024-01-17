let inited = false;

import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import initWasm, { parser_dsl_with_table } from '@kanaries-temp/gw-dsl-parser';
import dslWasm from '@kanaries-temp/gw-dsl-parser/gw_dsl_parser_bg.wasm?url';
import { nanoid } from 'nanoid';
import { IDataSourceProvider, IMutField, IDataSourceListener, exportFullRaw, fromFields } from '@kanaries/graphic-walker';
import { Table } from 'apache-arrow';
import { bigNumToString } from 'apache-arrow/util/bn';

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
    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

    const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], {
            type: 'text/javascript',
        })
    );

    // Instantiate the asynchronus version of DuckDB-Wasm
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);
    await initWasm(dslWasm);
}

const transformData = (table: Table) => {
    return table
        .toArray()
        .map((r) =>
            Object.fromEntries(
                Object.entries(r.toJSON()).map(([k, v]) => [
                    k,
                    typeof v === 'object' ? parseInt(bigNumToString(v as any)) : typeof v === 'bigint' ? Number(v) : v,
                ])
            )
        );
};

export async function getMemoryProvider(): Promise<IDataSourceProvider> {
    await init();
    const conn = await db.connect();
    const datasets: { name: string; id: string }[] = [];
    const metaDict = new Map<string, IMutField[]>();
    const specDict = new Map<string, string>();
    const listeners: IDataSourceListener[] = [];

    return {
        async getDataSourceList() {
            return datasets;
        },
        async addDataSource(data, meta, name) {
            const id = nanoid().replace('-', '');
            const filename = `${id}.json`;
            await db.registerFileText(filename, JSON.stringify(data));
            await conn.insertJSONFromPath(filename, { name: id });
            datasets.push({ id, name });
            metaDict.set(id, meta);
            specDict.set(id, JSON.stringify([exportFullRaw(fromFields(meta, 'Chart 1'))]));
            return id;
        },
        async getMeta(datasetId) {
            const meta = metaDict.get(datasetId);
            if (!meta) {
                throw new Error('cannot find meta');
            }
            return meta;
        },
        async setMeta(datasetId, meta) {
            metaDict.set(datasetId, meta);
            listeners.forEach((cb) => cb(2, datasetId));
        },
        async getSpecs(datasetId) {
            const specs = specDict.get(datasetId);
            if (!specs) {
                throw new Error('cannot find specs');
            }
            return specs;
        },
        async saveSpecs(datasetId, value) {
            specDict.set(datasetId, value);
            listeners.forEach((cb) => cb(4, datasetId));
        },
        async queryData(query, datasetIds) {
            const sql = parser_dsl_with_table(datasetIds[0], JSON.stringify(query));
            if (process.env.NODE_ENV !== 'production') {
                console.log(query, sql);
            }
            const res = await conn.query(sql).then(transformData);
            return res;
        },
        registerCallback(cb) {
            listeners.push(cb);
            return () => {
                listeners.filter((x) => x !== cb);
            };
        },
    };
}

export async function getComputation(data: Record<string, number>[]) {
    if (data.length === 0) {
        return {
            close: async () => {},
            computation: async () => [],
        };
    }
    const tableName = nanoid().replace('-', '');
    const fileName = `${tableName}.json`;
    const conn = await db.connect();
    await db.registerFileText(fileName, JSON.stringify(data));
    await conn.insertJSONFromPath(fileName, { name: tableName });
    return {
        close: async () => {
            await conn.close();
            await db.dropFile(fileName);
        },
        computation: async (query: any) => {
            const sql = parser_dsl_with_table(tableName, JSON.stringify(query));
            if (process.env.NODE_ENV !== 'production') {
                console.log(query, sql);
            }
            const res = await conn.query(sql).then(transformData);
            return res;
        },
    };
}
