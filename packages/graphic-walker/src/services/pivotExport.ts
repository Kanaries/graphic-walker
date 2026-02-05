import { formatDate } from '@/utils';
import { parsedOffsetDate } from '@/lib/op/offset';
import { getMeaAggKey } from '@/utils';
import { IField, IRow } from '../interfaces';
import { INestNode } from '../components/pivotTable/inteface';
import type { Range } from 'xlsx';
import type { SheetCellValue } from './spreadsheetExport';


interface CellSpan {
    value: SheetCellValue;
    rowSpan?: number;
    colSpan?: number;
}

interface LeftHeaderBuildResult {
    rows: CellSpan[][];
    rowMeta: { leafIndex: number; measureIndex: number | null }[];
}

interface TopHeaderBuildResult {
    rows: CellSpan[][];
    columnMeta: { leafIndex: number; measureIndex: number | null }[];
}

function getChildCount(node: INestNode): number {
    if (node.isCollapsed || node.children.length === 0) {
        return 1;
    }
    return node.children.map(getChildCount).reduce((a, b) => a + b, 0);
}

function formatNodeValue(node: INestNode, field: IField | undefined, displayOffset?: number): string {
    if (field?.semanticType === 'temporal') {
        return formatDate(parsedOffsetDate(displayOffset, field.offset)(node.value));
    }
    return `${node.value}`;
}

function renderLeftTree(
    node: INestNode,
    dimsInRow: IField[],
    depth: number,
    cellRows: CellSpan[][],
    meaNumber: number,
    displayOffset?: number
) {
    const childrenSize = getChildCount(node);
    if (depth > dimsInRow.length) {
        return;
    }
    const field = depth > 0 ? dimsInRow[depth - 1] : undefined;
    cellRows[cellRows.length - 1].push({
        value: formatNodeValue(node, field, displayOffset),
        colSpan: node.isCollapsed ? node.height + 1 : 1,
        rowSpan: node.isCollapsed ? Math.max(meaNumber, 1) : childrenSize * Math.max(meaNumber, 1),
    });
    if (node.isCollapsed) return;
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        renderLeftTree(child, dimsInRow, depth + 1, cellRows, meaNumber, displayOffset);
        if (i < node.children.length - 1) {
            cellRows.push([]);
        }
    }
}

function renderTopTree(
    node: INestNode,
    dimsInCol: IField[],
    depth: number,
    cellRows: CellSpan[][],
    meaNumber: number,
    displayOffset?: number
) {
    const childrenSize = getChildCount(node);
    if (depth > dimsInCol.length) {
        return;
    }
    const field = depth > 0 ? dimsInCol[depth - 1] : undefined;
    cellRows[depth].push({
        value: formatNodeValue(node, field, displayOffset),
        colSpan: node.isCollapsed ? Math.max(meaNumber, 1) : childrenSize * Math.max(meaNumber, 1),
        rowSpan: node.isCollapsed ? node.height + 1 : 1,
    });
    if (node.isCollapsed) return;
    for (let i = 0; i < node.children.length; i++) {
        renderTopTree(node.children[i], dimsInCol, depth + 1, cellRows, meaNumber, displayOffset);
    }
}

function collectVisibleLeaves(tree: INestNode): INestNode[] {
    const leaves: INestNode[] = [];
    const stack: INestNode[] = [tree];

    while (stack.length > 0) {
        const node = stack.pop()!;
        if (node.children.length === 0 || node.isCollapsed) {
            leaves.push(node);
            continue;
        }
        for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push(node.children[i]);
        }
    }

    return leaves;
}

function buildLeftHeaderRows(
    leftTree: INestNode,
    dimsInRow: IField[],
    measInRow: IField[],
    displayOffset?: number
): LeftHeaderBuildResult {
    const cellRows: CellSpan[][] = [[]];
    renderLeftTree(leftTree, dimsInRow, 0, cellRows, measInRow.length, displayOffset);
    cellRows[0].shift();

    const rowMeta: { leafIndex: number; measureIndex: number | null }[] = [];

    if (measInRow.length > 0) {
        const rowsWithMeasures: CellSpan[][] = [];
        cellRows.forEach((row, leafIndex) => {
            rowsWithMeasures.push([
                ...row,
                {
                    value: `${measInRow[0].aggName}(${measInRow[0].name})`,
                },
            ]);
            rowMeta.push({ leafIndex, measureIndex: 0 });
            for (let i = 1; i < measInRow.length; i++) {
                rowsWithMeasures.push([
                    {
                        value: `${measInRow[i].aggName}(${measInRow[i].name})`,
                    },
                ]);
                rowMeta.push({ leafIndex, measureIndex: i });
            }
        });
        return { rows: rowsWithMeasures, rowMeta };
    }

    cellRows.forEach((_, leafIndex) => {
        rowMeta.push({ leafIndex, measureIndex: null });
    });

    return { rows: cellRows, rowMeta };
}

function buildTopHeaderRows(
    topTree: INestNode,
    dimsInCol: IField[],
    measInCol: IField[],
    displayOffset?: number
): TopHeaderBuildResult {
    const cellRows: CellSpan[][] = new Array(dimsInCol.length + 1).fill(0).map(() => []);
    renderTopTree(topTree, dimsInCol, 0, cellRows, measInCol.length, displayOffset);

    cellRows.forEach((row) => {
        const rowSpanValues = row.map((cell) => cell.rowSpan ?? 1);
        if (rowSpanValues.length > 0 && rowSpanValues[0] > 1 && rowSpanValues.every((v) => v === rowSpanValues[0])) {
            row.forEach((cell) => {
                cell.rowSpan = 1;
            });
        }
    });

    const totalChildrenSize = getChildCount(topTree);
    if (measInCol.length > 0) {
        cellRows.push(
            new Array(totalChildrenSize).fill(0).flatMap(() =>
                measInCol.map((m) => ({
                    value: `${m.aggName}(${m.name})`,
                }))
            )
        );
    }

    cellRows.shift();

    const visibleLeaves = collectVisibleLeaves(topTree);
    const columnMeta: { leafIndex: number; measureIndex: number | null }[] = [];
    visibleLeaves.forEach((_, leafIndex) => {
        if (measInCol.length > 0) {
            measInCol.forEach((__, measureIndex) => {
                columnMeta.push({ leafIndex, measureIndex });
            });
        } else {
            columnMeta.push({ leafIndex, measureIndex: null });
        }
    });

    const filteredRows = cellRows.filter((row) => row.length > 0);
    return { rows: filteredRows, columnMeta };
}

function placeCells(
    grid: SheetCellValue[][],
    occupied: boolean[][],
    merges: Range[],
    rowIndex: number,
    colStart: number,
    cells: CellSpan[]
) {
    let col = colStart;
    for (const cell of cells) {
        while (col < grid[rowIndex].length && occupied[rowIndex][col]) {
            col += 1;
        }
        if (col >= grid[rowIndex].length) {
            break;
        }
        const rowSpan = cell.rowSpan ?? 1;
        const colSpan = cell.colSpan ?? 1;
        grid[rowIndex][col] = cell.value;
        for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
            for (let c = col; c < col + colSpan; c++) {
                occupied[r][c] = true;
                if (r !== rowIndex || c !== col) {
                    grid[r][c] = null;
                }
            }
        }
        if (rowSpan > 1 || colSpan > 1) {
            merges.push({
                s: { r: rowIndex, c: col },
                e: { r: rowIndex + rowSpan - 1, c: col + colSpan - 1 },
            });
        }
        col += colSpan;
    }
}

function getMeasureValue(cell: IRow | null, measure: IField): SheetCellValue {
    if (!cell) return null;
    const key = getMeaAggKey(measure.fid, measure.aggName);
    const value = cell[key];
    if (value === undefined || value === null) return null;
    return value as SheetCellValue;
}

function formatPivotCell(
    cell: IRow | null,
    rowMeasure: IField | null,
    columnMeasure: IField | null
): SheetCellValue {
    if (!rowMeasure && !columnMeasure) {
        return true;
    }
    if (rowMeasure && columnMeasure) {
        const rowValue = getMeasureValue(cell, rowMeasure);
        const colValue = getMeasureValue(cell, columnMeasure);
        if (rowValue === null && colValue === null) return null;
        return `${rowValue ?? ''}${rowValue !== null && colValue !== null ? ', ' : ''}${colValue ?? ''}`;
    }
    if (rowMeasure) {
        return getMeasureValue(cell, rowMeasure);
    }
    if (columnMeasure) {
        return getMeasureValue(cell, columnMeasure);
    }
    return null;
}

export function buildPivotSheet(params: {
    leftTree: INestNode;
    topTree: INestNode;
    metricTable: Array<Array<IRow | null>>;
    dimsInRow: IField[];
    dimsInColumn: IField[];
    measInRow: IField[];
    measInColumn: IField[];
    displayOffset?: number;
}): { data: SheetCellValue[][]; merges: Range[] } {
    const { leftTree, topTree, metricTable, dimsInRow, dimsInColumn, measInRow, measInColumn, displayOffset } = params;

    const leftBuild = buildLeftHeaderRows(leftTree, dimsInRow, measInRow, displayOffset);
    const topBuild = buildTopHeaderRows(topTree, dimsInColumn, measInColumn, displayOffset);

    const headerRowsCount = topBuild.rows.length;
    const leftCols = dimsInRow.length + (measInRow.length > 0 ? 1 : 0);
    const dataCols = topBuild.columnMeta.length;
    const totalCols = leftCols + dataCols;
    const totalRows = headerRowsCount + leftBuild.rows.length;

    const grid: SheetCellValue[][] = Array.from({ length: totalRows }, () => Array(totalCols).fill(null));
    const occupied: boolean[][] = Array.from({ length: totalRows }, () => Array(totalCols).fill(false));
    const merges: Range[] = [];

    for (let r = 0; r < headerRowsCount; r++) {
        const leftRowValues: SheetCellValue[] = new Array(leftCols).fill(null);
        if (r === headerRowsCount - 1 && headerRowsCount > 0) {
            for (let i = 0; i < dimsInRow.length; i++) {
                leftRowValues[i] = dimsInRow[i].name;
            }
        }
        placeCells(
            grid,
            occupied,
            merges,
            r,
            0,
            leftRowValues.map((value) => ({ value }))
        );
        placeCells(grid, occupied, merges, r, leftCols, topBuild.rows[r]);
    }

    for (let r = 0; r < leftBuild.rows.length; r++) {
        const rowIndex = headerRowsCount + r;
        placeCells(grid, occupied, merges, rowIndex, 0, leftBuild.rows[r]);

        const rowMeta = leftBuild.rowMeta[r];
        const rowMeasure = rowMeta.measureIndex !== null ? measInRow[rowMeta.measureIndex] : null;
        const leafRow = metricTable[rowMeta.leafIndex] ?? [];

        const dataCells: CellSpan[] = topBuild.columnMeta.map((colMeta) => {
            const columnMeasure = colMeta.measureIndex !== null ? measInColumn[colMeta.measureIndex] : null;
            const cell = leafRow[colMeta.leafIndex] ?? null;
            return {
                value: formatPivotCell(cell, rowMeasure, columnMeasure),
            };
        });
        placeCells(grid, occupied, merges, rowIndex, leftCols, dataCells);
    }

    return { data: grid, merges };
}
