let inited = false;

import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import initWasm, { parser_dsl_with_table } from "@kanaries-temp/gw-dsl-parser";
import dslWasm from "@kanaries-temp/gw-dsl-parser/gw_dsl_parser_bg.wasm?url";
import { nanoid } from "nanoid";

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

  // Select a bundle based on browser checks
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: "text/javascript",
    })
  );

  // Instantiate the asynchronus version of DuckDB-Wasm
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);
  await initWasm(dslWasm);
  inited = true;
}

export async function getComutation(data: Record<string, number>[]) {
  if (data.length === 0) {
    return {
      close: async () => {},
      computation: async () => [],
    };
  }
  const tableName = nanoid().replace("-", '');
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
      console.log(query, sql);
      const res = await conn
        .query(sql)
        .then((x) => x.toArray().map((r) => JSON.parse(r.toString())));
      console.log(res);
      return res;
    },
  };
}

const nowComputation = {
  current: null as null | ReturnType<typeof getComutation>,
};

export function getComutationSingleton(data: Record<string, number>[]) {
  nowComputation.current?.then((x) => x.close());
  nowComputation.current = getComutation(data);
  return async (query: any) =>
    (await nowComputation.current)!.computation(query);
}
