import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Vector } from 'apache-arrow';
import { bigNumToString } from 'apache-arrow/util/bn';

const require = createRequire(import.meta.url);

function readStdin() {
    return fs.readFileSync(0, 'utf8');
}

function quoteIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
}

function arrowToJSON(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (value instanceof Vector) {
        return Array.from(value).map(arrowToJSON);
    }
    if (Array.isArray(value)) {
        return value.map(arrowToJSON);
    }
    if (typeof value === 'bigint') {
        return Number(value);
    }
    if (typeof value === 'object') {
        if (value instanceof Date) {
            return value.getTime();
        }
        if (value.constructor?.name?.includes('BigNum')) {
            return Number(bigNumToString(value));
        }
    }
    return value;
}

function transformResult(table) {
    return table.toArray().map((row) => Object.fromEntries(Object.entries(row.toJSON()).map(([key, value]) => [key, arrowToJSON(value)])));
}

async function main() {
    const { data, payload, options } = JSON.parse(readStdin());
    const duckdb = require('@duckdb/duckdb-wasm/blocking');
    const dist = path.dirname(require.resolve('@duckdb/duckdb-wasm'));
    const bundles = {
        mvp: { mainModule: path.resolve(dist, 'duckdb-mvp.wasm') },
        eh: { mainModule: path.resolve(dist, 'duckdb-eh.wasm') },
    };
    const db = await duckdb.createDuckDB(bundles, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME);
    await db.instantiate(() => {});

    const parserDir = path.dirname(require.resolve('@kanaries/gw-dsl-parser/package.json'));
    const parser = await import(pathToFileURL(path.join(parserDir, 'gw_dsl_parser.js')).href);
    await parser.default(fs.readFileSync(path.join(parserDir, 'gw_dsl_parser_bg.wasm')));

    const tableName = 'gw_conf_table';
    const conn = db.connect();
    try {
        if (data.length === 0 && options.emptySchema) {
            const columns = Object.entries(options.emptySchema)
                .map(([field, type]) => `${quoteIdentifier(field)} ${type}`)
                .join(', ');
            conn.query(`CREATE TABLE ${quoteIdentifier(tableName)} (${columns})`);
        } else {
            const fileName = `${tableName}.json`;
            db.registerFileText(fileName, JSON.stringify(data));
            conn.insertJSONFromPath(fileName, { name: tableName });
        }

        const sql = parser.parser_dsl_with_table(tableName, JSON.stringify(payload));
        const rows = transformResult(conn.query(sql));
        process.stdout.write(JSON.stringify({ rows, sql }));
    } finally {
        conn.close();
    }
}

main().catch((error) => {
    if (process.env.GW_CONFORMANCE_VERBOSE_ERRORS) {
        process.stderr.write(error?.stack || String(error));
    }
    process.exit(1);
});
