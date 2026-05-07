import type { Range } from 'xlsx';

export type SheetCellValue = string | number | boolean | null;

export interface SheetSpec {
    name: string;
    data: SheetCellValue[][];
    merges?: Range[];
}

export type SpreadsheetFileType = 'xlsx' | 'ods';

export function buildCsvContent(data: SheetCellValue[][]): string {
    const escapeCell = (value: SheetCellValue) => {
        if (value === null || value === undefined) return '';
        const text = `${value}`;
        if (/[",\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    };

    return data.map((row) => row.map(escapeCell).join(',')).join('\n');
}

export async function exportSpreadsheet(sheet: SheetSpec, filename: string, type: SpreadsheetFileType): Promise<void> {
    const XLSX = await import('../lib/sheetjsWriteWrapper');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.data);

    if (sheet.merges && sheet.merges.length > 0) {
        worksheet['!merges'] = sheet.merges;
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name || 'Sheet1');

    if (type === 'xlsx') {
        XLSX.writeFileXLSX(workbook, filename);
        return;
    }

    XLSX.writeFile(workbook, filename, { bookType: 'ods' });
}
