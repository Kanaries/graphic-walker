import path from 'node:path';
import { arrowToJSON } from '../../duckdb-wasm-computation/src/result';
import { transformData } from '../../duckdb-wasm-computation/src/result';
import { cleanupComputation, createInitializer, createListenerRegistry, loadJSONTable } from '../../duckdb-wasm-computation/src/runtime';
import { correctOpenRangeSQL } from '../../duckdb-wasm-computation/src/compile.cjs';
import { createDuckDBMemoryProvider } from '../../duckdb-wasm-computation/src/provider';

describe('DuckDB browser adapter regressions', () => {
    test('result conversion preserves null, dates, arrays, and plain objects', () => {
        const date = new Date('2024-01-02T03:04:05.000Z');

        expect(arrowToJSON(null)).toBeNull();
        expect(arrowToJSON(date)).toBe(date.getTime());
        expect(arrowToJSON([1, null, { nested: true }])).toEqual([1, null, { nested: true }]);
        expect(arrowToJSON({ label: 'value' })).toEqual({ label: 'value' });
        expect(arrowToJSON(9_007_199_254_740_993n)).toBe('9007199254740993');

        const ArrowVector = class Vector {
            *[Symbol.iterator]() {
                yield 1;
                yield null;
            }
        };
        expect(arrowToJSON(new ArrowVector())).toEqual([1, null]);
    });

    test('concurrent initialization callers await the same setup', async () => {
        let releaseSetup!: () => void;
        const setup = jest.fn(
            () =>
                new Promise<void>((resolve) => {
                    releaseSetup = resolve;
                }),
        );
        const initialize = createInitializer(setup);
        let secondFinished = false;

        const first = initialize();
        const second = initialize().then(() => {
            secondFinished = true;
        });
        await Promise.resolve();

        expect(setup).toHaveBeenCalledTimes(1);
        expect(secondFinished).toBe(false);

        releaseSetup();
        await Promise.all([first, second]);
    });

    test('failed initialization can be retried', async () => {
        const setup = jest.fn().mockRejectedValueOnce(new Error('load failed')).mockResolvedValueOnce(undefined);
        const initialize = createInitializer(setup);

        await expect(initialize()).rejects.toThrow('load failed');
        await expect(initialize()).resolves.toBeUndefined();
        expect(setup).toHaveBeenCalledTimes(2);
    });

    test('listener disposer removes the registered callback', () => {
        const listeners = createListenerRegistry<(event: number) => void>();
        const callback = jest.fn();
        const dispose = listeners.add(callback);

        listeners.emit(1);
        dispose();
        listeners.emit(2);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(1);
    });

    test('computation cleanup drops the table before releasing the connection and input file', async () => {
        const calls: string[] = [];
        const connection = {
            async query(sql: string) {
                calls.push(sql);
            },
            async close() {
                calls.push('close');
            },
        };
        const database = {
            async dropFile(fileName: string) {
                calls.push(`dropFile:${fileName}`);
            },
        };

        await cleanupComputation(connection, database, 'input.json', 'table_name');

        expect(calls).toEqual(['DROP TABLE IF EXISTS "table_name"', 'close', 'dropFile:input.json']);
    });

    test('failed table loading rolls back the table, connection, and input file without masking the insert error', async () => {
        const calls: string[] = [];
        const connection = {
            async insertJSONFromPath() {
                calls.push('insert');
                throw new Error('insert failed');
            },
            async query(sql: string) {
                calls.push(sql);
            },
            async close() {
                calls.push('close');
            },
        };
        const database = {
            async registerFileText() {
                calls.push('register');
            },
            async dropFile(fileName: string) {
                calls.push(`dropFile:${fileName}`);
            },
        };

        await expect(loadJSONTable(connection, database, 'input.json', 'table_name', [{ value: 1 }], true)).rejects.toThrow('insert failed');
        expect(calls).toEqual(['register', 'insert', 'DROP TABLE IF EXISTS "table_name"', 'close', 'dropFile:input.json']);
    });

    test('DuckDB provider emits updateList after a data source is ready', async () => {
        const connection = {
            async insertJSONFromPath() {},
            async query() {
                throw new Error('not used');
            },
            async close() {},
        };
        const database = {
            async registerFileText() {},
            async dropFile() {},
        };
        const provider = createDuckDBMemoryProvider({
            database,
            connection,
            compileQuery: () => 'SELECT 1',
            createInitialSpecs: () => '[]',
            eventTypes: { updateList: 1, updateMeta: 2, updateSpec: 4 },
        });
        const callback = jest.fn();
        provider.registerCallback(callback);

        const id = await provider.addDataSource([{ value: 1 }], [], 'dataset');

        expect(callback).toHaveBeenCalledWith(1, '');
        await expect(provider.getDataSourceList()).resolves.toEqual([{ id, name: 'dataset' }]);
    });

    test('result conversion handles a real DuckDB Arrow table', async () => {
        const duckdb = require('@duckdb/duckdb-wasm/blocking');
        const dist = path.dirname(require.resolve('@duckdb/duckdb-wasm'));
        const database = await duckdb.createDuckDB(
            {
                mvp: { mainModule: path.resolve(dist, 'duckdb-mvp.wasm') },
                eh: { mainModule: path.resolve(dist, 'duckdb-eh.wasm') },
            },
            new duckdb.VoidLogger(),
            duckdb.NODE_RUNTIME,
        );
        await database.instantiate(() => {});
        const connection = database.connect();
        try {
            const table = connection.query(
                "SELECT NULL AS nullable, DATE '2024-01-02' AS date_value, [1, 2] AS list_value, struct_pack(label := 'value') AS struct_value, 12.34::DECIMAL(10, 2) AS decimal_value",
            );
            expect(transformData(table)).toEqual([
                {
                    nullable: null,
                    date_value: Date.UTC(2024, 0, 2),
                    list_value: [1, 2],
                    struct_value: { label: 'value' },
                    decimal_value: 12.34,
                },
            ]);
        } finally {
            connection.close();
        }
    });

    test('open-range correction only changes generated WHERE predicates', () => {
        const payload = {
            workflow: [
                { type: 'filter' as const, filters: [{ fid: 'value', rule: { type: 'range' as const, value: [2, null] as [number, null] } }] },
            ],
        };
        const sql = 'SELECT "value" > 2 AS "comparison" FROM "data" WHERE "value" > 2';

        expect(correctOpenRangeSQL(sql, payload)).toBe('SELECT "value" > 2 AS "comparison" FROM "data" WHERE "value" >= 2');
        expect(correctOpenRangeSQL('SELECT * FROM "data" WHERE ("value" > 2)', payload)).toBe('SELECT * FROM "data" WHERE ("value" >= 2)');
    });
});
