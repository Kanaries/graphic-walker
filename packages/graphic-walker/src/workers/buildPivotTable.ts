import { INestNode } from '../components/pivotTable/interface';
import { buildMetricTableFromNestTree, buildNestTree, createPivotPathKey, pivotTableValuesEqual } from '../components/pivotTable/utils';
import { IViewField, IRow, IWindowAgg } from '../interfaces';

import { getMeaAggKey } from '../utils';

const getFirstVisibleValuePath = (item: INestNode): INestNode[] => {
    const child = item.children.find((node) => node.kind === 'value');
    if (child) {
        return child.isCollapsed ? [child] : [child, ...getFirstVisibleValuePath(child)];
    }
    return [];
};

function getVisibleSlice(
    data: IRow[],
    visiblePrimaryData: IRow[],
    primaryDimensions: IViewField[],
    oppositeDimensions: IViewField[],
    oppositePath: INestNode[]
): IRow[] {
    const visibleDimensions = oppositeDimensions.slice(0, oppositePath.length);
    const hiddenDimensions = oppositeDimensions.slice(oppositePath.length);
    const visiblePrimaryKeys = new Set(
        visiblePrimaryData
            .filter((row) => primaryDimensions.every((field) => Object.prototype.hasOwnProperty.call(row, field.fid)))
            .map((row) => createPivotPathKey(primaryDimensions.map((field) => ({ key: field.fid, value: row[field.fid] }))))
    );
    return data.filter(
        (row) =>
            primaryDimensions.every((field) => Object.prototype.hasOwnProperty.call(row, field.fid)) &&
            visiblePrimaryKeys.has(createPivotPathKey(primaryDimensions.map((field) => ({ key: field.fid, value: row[field.fid] })))) &&
            visibleDimensions.every(
                (field, index) =>
                    Object.prototype.hasOwnProperty.call(row, field.fid) && pivotTableValuesEqual(row[field.fid], oppositePath[index].value)
            ) &&
            hiddenDimensions.every((field) => !Object.prototype.hasOwnProperty.call(row, field.fid))
    );
}

export function buildPivotTable(
    dimsInRow: IViewField[],
    dimsInColumn: IViewField[],
    allData: IRow[],
    aggData: IRow[],
    collapsedKeyList: string[],
    showTableSummary: boolean,
    sort?: {
        fid: string;
        type: 'ascending' | 'descending';
        mode: 'row' | 'column';
    },
    measures: IViewField[] = []
): { lt: INestNode; tt: INestNode; metric: (IRow | null | undefined)[][] } {
    allData = applyWindowAggregations(allData, dimsInRow, dimsInColumn, measures);
    aggData = applyWindowAggregations(aggData, dimsInRow, dimsInColumn, measures);
    let lt: INestNode;
    let tt: INestNode;
    if (sort?.mode === 'row') {
        tt = buildNestTree(
            dimsInColumn.map((d) => d.fid),
            allData,
            collapsedKeyList,
            showTableSummary,
            undefined,
            undefined,
            dimsInColumn
        );
        const firstColumnPath = getFirstVisibleValuePath(tt);
        if (dimsInColumn.length > 0 && firstColumnPath.length > 0) {
            const mentioned = getVisibleSlice([...allData, ...aggData], allData, dimsInRow, dimsInColumn, firstColumnPath);
            const mentionedSet = new Set(mentioned);
            const rest = allData.filter((row) => !mentionedSet.has(row));
            lt = buildNestTree(
                dimsInRow.map((d) => d.fid),
                mentioned,
                collapsedKeyList,
                showTableSummary,
                sort,
                rest,
                dimsInRow
            );
        } else {
            lt = buildNestTree(
                dimsInRow.map((d) => d.fid),
                allData,
                collapsedKeyList,
                showTableSummary,
                sort,
                undefined,
                dimsInRow
            );
        }
    } else {
        lt = buildNestTree(
            dimsInRow.map((d) => d.fid),
            allData,
            collapsedKeyList,
            showTableSummary,
            undefined,
            undefined,
            dimsInRow
        );
        const firstRowPath = getFirstVisibleValuePath(lt);
        if (sort && dimsInRow.length > 0 && firstRowPath.length > 0) {
            const mentioned = getVisibleSlice([...allData, ...aggData], allData, dimsInColumn, dimsInRow, firstRowPath);
            const mentionedSet = new Set(mentioned);
            const rest = allData.filter((row) => !mentionedSet.has(row));
            tt = buildNestTree(
                dimsInColumn.map((d) => d.fid),
                mentioned,
                collapsedKeyList,
                showTableSummary,
                sort,
                rest,
                dimsInColumn
            );
        } else {
            tt = buildNestTree(
                dimsInColumn.map((d) => d.fid),
                allData,
                collapsedKeyList,
                showTableSummary,
                sort,
                undefined,
                dimsInColumn
            );
        }
    }

    const metric = buildMetricTableFromNestTree(lt, tt, [...allData, ...aggData]);
    return { lt, tt, metric };
}

function applyWindowAggregations(
    data: IRow[],
    dimsInRow: IViewField[],
    dimsInColumn: IViewField[],
    measures: IViewField[]
): IRow[] {
    if (data.length === 0) return data;
    const windowMeasures = measures.filter(
        (field) => field.analyticType === 'measure' && field.semanticType === 'quantitative' && field.windowAgg && field.aggName && field.aggName !== 'expr'
    );
    if (windowMeasures.length === 0) return data;

    const orderField = dimsInRow.length > 0 ? dimsInRow[dimsInRow.length - 1] : dimsInColumn[dimsInColumn.length - 1];
    if (!orderField) return data;
    const orderKey = orderField.fid;
    const groupByKeys = [...dimsInRow, ...dimsInColumn].map((field) => field.fid).filter((fid) => fid !== orderKey);

    const grouped = new Map<string, IRow[]>();
    const getGroupKey = (row: IRow) => createPivotPathKey(groupByKeys.map((key) => ({ key, value: row[key] })));
    data.forEach((row) => {
        const groupKey = getGroupKey(row);
        const bucket = grouped.get(groupKey);
        if (bucket) {
            bucket.push(row);
        } else {
            grouped.set(groupKey, [row]);
        }
    });

    const result = data.map((row) => ({ ...row }));
    const rowToResult = new Map<IRow, IRow>();
    data.forEach((row, index) => rowToResult.set(row, result[index]));

    grouped.forEach((rows) => {
        const orderedRows = rows.slice().sort((a, b) => {
            const av = a[orderKey];
            const bv = b[orderKey];
            if (av === bv) return 0;
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            // Match Vega-Lite and 0.4.84: the window follows the field values.
            // Header sort settings only change the display order.
            if (typeof av === 'number' && typeof bv === 'number') return av - bv;
            return String(av).localeCompare(String(bv));
        });

        windowMeasures.forEach((measure) => {
            const windowAgg = measure.windowAgg as IWindowAgg;
            const baseKey = getMeaAggKey(measure.fid, measure.aggName);
            const windowKey = getMeaAggKey(measure.fid, measure.aggName, windowAgg);
            let runningTotal = 0;
            let prevValue: number | null = null;
            const windowValues: number[] = [];

            orderedRows.forEach((row) => {
                const targetRow = rowToResult.get(row);
                if (!targetRow) return;
                const rawValue = row[baseKey];
                const numericValue = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;

                if (windowAgg === 'running_total') {
                    if (numericValue === null) {
                        targetRow[windowKey] = null;
                        return;
                    }
                    runningTotal += numericValue;
                    targetRow[windowKey] = runningTotal;
                    return;
                }

                if (windowAgg === 'difference') {
                    if (numericValue === null || prevValue === null) {
                        targetRow[windowKey] = null;
                    } else {
                        targetRow[windowKey] = numericValue - prevValue;
                    }
                    prevValue = numericValue === null ? prevValue : numericValue;
                    return;
                }

                if (windowAgg === 'moving_average') {
                    if (numericValue !== null) {
                        windowValues.push(numericValue);
                    } else {
                        windowValues.push(NaN);
                    }
                    const slice = windowValues.slice(-3).filter((value) => Number.isFinite(value));
                    targetRow[windowKey] = slice.length ? slice.reduce((sum, val) => sum + val, 0) / slice.length : null;
                    return;
                }

                if (windowAgg === 'growth_rate') {
                    if (numericValue === null || prevValue === null || prevValue === 0) {
                        targetRow[windowKey] = null;
                    } else {
                        targetRow[windowKey] = numericValue / prevValue - 1;
                    }
                    prevValue = numericValue === null ? prevValue : numericValue;
                }
            });

            if (windowAgg === 'rank') {
                let currentRank = 0;
                let lastOrderValue: any = undefined;
                orderedRows.forEach((row, index) => {
                    const targetRow = rowToResult.get(row);
                    if (!targetRow) return;
                    const orderValue = row[orderKey];
                    if (orderValue === null || orderValue === undefined) {
                        targetRow[windowKey] = null;
                        return;
                    }
                    if (index === 0) {
                        currentRank = 1;
                    } else if (orderValue !== lastOrderValue) {
                        currentRank = index + 1;
                    }
                    targetRow[windowKey] = currentRank;
                    lastOrderValue = orderValue;
                });
            }
        });
    });

    return result;
}
