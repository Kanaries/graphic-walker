import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { IDataQueryPayload, IRow } from '../../graphic-walker/src/interfaces';

export interface DuckDBExecuteOptions {
    emptySchema?: Record<string, 'DOUBLE' | 'VARCHAR' | 'BOOLEAN' | 'BIGINT'>;
}

export async function executeDuckDB(data: IRow[], payload: IDataQueryPayload, options: DuckDBExecuteOptions = {}): Promise<{ rows: IRow[]; sql: string }> {
    const runner = path.resolve(__dirname, 'duckdbRunner.mjs');
    const stdout = execFileSync(process.execPath, [runner], {
        input: JSON.stringify({ data, payload, options }),
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
}
