import type { IDataQueryPayload } from '@kanaries/graphic-walker';

export declare function correctOpenRangeSQL(sql: string, payload: IDataQueryPayload): string;
export declare function compileWorkflowToSQL(parser: (tableName: string, payload: string) => string, tableName: string, payload: IDataQueryPayload): string;
