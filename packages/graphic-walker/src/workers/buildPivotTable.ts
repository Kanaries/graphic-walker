import { INestNode } from '../components/pivotTable/inteface';
import { buildMetricTableFromNestTree, buildNestTree, createManualSortLookup } from '../components/pivotTable/utils';
import { IViewField, IRow, IManualSortValue, IWindowAgg } from '../interfaces';
import { getMeaAggKey } from '../utils';

const getFirsts = (item: INestNode): INestNode[] => {
    if (item.children.length > 0) {
        return [item, ...getFirsts(item.children[0])];
    }
    return [item];
};

export function buildPivotTable(
    dimsInRow: IViewField[],
    dimsInColumn: IViewField[],
    measures: IViewField[],
    allData: IRow[],
    aggData: IRow[],
    collapsedKeyList: string[],
    showTableSummary: boolean,
    sort?: {
        fid: string;
        type: 'ascending' | 'descending';
        mode: 'row' | 'column';
    },
    manualSortConfig?: Record<string, IManualSortValue[]>,
    alphabeticalSortConfig?: Record<string, 'ascending' | 'descending'>
): { lt: INestNode; tt: INestNode; metric: (IRow | null)[][] } {
    const manualSortLookup = createManualSortLookup(manualSortConfig);
    const dataWithWindow = applyWindowAggregations(allData, dimsInRow, dimsInColumn, measures);
    const aggDataWithWindow = applyWindowAggregations(aggData, dimsInRow, dimsInColumn, measures);
    let lt: INestNode;
    let tt: INestNode;
    if (sort?.mode === 'row') {
        tt = buildNestTree(
            dimsInColumn.map((d) => d.fid),
            dataWithWindow,
            collapsedKeyList,
            showTableSummary,
            undefined,
            undefined,
            manualSortLookup,
            alphabeticalSortConfig
        );
        if (dimsInColumn.length > 0) {
            const ks = dimsInColumn.map((x) => x.fid);
            const vs = getFirsts(tt.children[0]).map((x) => x.value);
            // move data of First column to first
            const mentioned: IRow[] = [];
            const rest: IRow[] = [];
            dataWithWindow.forEach((x) => (ks.every((k, i) => x[k] === vs[i]) ? mentioned.push(x) : rest.push(x)));
            lt = buildNestTree(
                dimsInRow.map((d) => d.fid),
                mentioned,
                collapsedKeyList,
                showTableSummary,
                sort,
                rest,
                manualSortLookup,
                alphabeticalSortConfig
            );
        } else {
            lt = buildNestTree(
                dimsInRow.map((d) => d.fid),
                dataWithWindow,
                collapsedKeyList,
                showTableSummary,
                sort,
                undefined,
                manualSortLookup,
                alphabeticalSortConfig
            );
        }
    } else {
        lt = buildNestTree(
            dimsInRow.map((d) => d.fid),
            dataWithWindow,
            collapsedKeyList,
            showTableSummary,
            undefined,
            undefined,
            manualSortLookup,
            alphabeticalSortConfig
        );
        if (sort && dimsInRow.length > 0) {
            const ks = dimsInRow.map((x) => x.fid);
            const vs = getFirsts(lt.children[0]).map((x) => x.value);
            // move data of First row to first
            const mentioned: IRow[] = [];
            const rest: IRow[] = [];
            dataWithWindow.forEach((x) => (ks.every((k, i) => x[k] === vs[i]) ? mentioned.push(x) : rest.push(x)));
            tt = buildNestTree(
                dimsInColumn.map((d) => d.fid),
                mentioned,
                collapsedKeyList,
                showTableSummary,
                sort,
                rest,
                manualSortLookup,
                alphabeticalSortConfig
            );
        } else {
            tt = buildNestTree(
                dimsInColumn.map((d) => d.fid),
                dataWithWindow,
                collapsedKeyList,
                showTableSummary,
                sort,
                undefined,
                manualSortLookup,
                alphabeticalSortConfig
            );
        }
    }

    const metric = buildMetricTableFromNestTree(lt, tt, [...dataWithWindow, ...aggDataWithWindow]);
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
    const getGroupKey = (row: IRow) => groupByKeys.map((key) => `${key}=${String(row[key])}`).join('|');
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
