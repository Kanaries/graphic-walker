import { branchFields } from './compiler';
import { isRange } from './keys';
import { resultKey, type Plan, type Row } from './types';

/** The records behind the marks of a sheet, as a table a host can save. */
export interface ResultTable {
    columns: { key: string; label: string }[];
    rows: Row[];
}

/**
 * One table per query whose records are drawn. Queries that only order members are left out.
 * Columns read like a table: the dimensions first, in the order of rows, columns and then
 * the rest; after them the fields drawn as an axis without aggregation, such as a date or
 * the values of a box plot; last the aggregated measures. Rows are what the query
 * returned, in its order and after any limit.
 */
export function resultTables(plan: Plan, results: Map<string, Row[]>): ResultTable[] {
    const instances = Object.values(plan.spec.instances);
    const shelf = [...plan.rows, ...plan.columns].flatMap(branchFields).filter(f => !f.aggregate).map(f => f.field);
    return [...new Set(plan.bindings.map(binding => binding.taskId))].map(id => {
        const task = plan.tasks.find(t => t.id === id)!;
        const discrete = (field: string) => instances.some(f => f.field === field && !f.aggregate && f.display === 'discrete');
        const position = (field: string) => { const index = shelf.indexOf(field); return (discrete(field) ? 0 : 1e6) + (index < 0 ? shelf.length : index); };
        const dimensions = [...task.groupBy].sort((a, b) => position(a) - position(b));
        return {
            columns: [
                ...dimensions.map(field => ({ key: field, label: instances.find(f => f.field === field && !f.aggregate)?.label ?? field })),
                ...task.measures.map(f => ({ key: resultKey(f), label: f.label })),
            ],
            rows: results.get(id) ?? [],
        };
    });
}

const cell = (value: unknown): string => {
    const text = value == null ? '' : value instanceof Date ? value.toISOString() : isRange(value) ? value.join(' – ') : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
/** Comma-separated text with a header line. Values are written as stored; a bin is written as its two bounds. */
export function tableToCSV(table: ResultTable): string {
    return [table.columns.map(c => cell(c.label)), ...table.rows.map(row => table.columns.map(c => cell(row[c.key])))].map(line => line.join(',')).join('\n');
}
