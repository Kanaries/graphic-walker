import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_next from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_wasm_next,
        // mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).toString(),
        mainWorker: eh_worker
    },
}

export class DBEngine {
    public connection: duckdb.AsyncDuckDBConnection | null = null;
    public db: duckdb.AsyncDuckDB | null = null;
    constructor () {
        this.init();
    }
    public async init () {
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
        if (bundle.mainWorker) {
            const worker = new Worker(bundle.mainWorker);
            const logger = new duckdb.ConsoleLogger();
            const db = new duckdb.AsyncDuckDB(logger, worker);
            this.db = db;
            await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
            // this.connection = await this.db.connect();
        }
    }
    public async query (sql: string) {
        if (this.db === null) throw new Error('db is not init.')
        const conn = await this.db.connect();
        let res: any;
        if (conn) {
            res = await conn.query(sql);
        } else {
            console.error('connection not build')
        }
        
        await conn.close();
        return res.toArray().map(Object.fromEntries);
    }
}
