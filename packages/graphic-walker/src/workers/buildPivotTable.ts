import { INestNode } from '../components/pivotTable/inteface';
import { buildMetricTableFromNestTree, buildNestTree, createManualSortLookup } from '../components/pivotTable/utils';
import { IViewField, IRow, IManualSortValue } from '../interfaces';

const getFirsts = (item: INestNode): INestNode[] => {
    if (item.children.length > 0) {
        return [item, ...getFirsts(item.children[0])];
    }
    return [item];
};

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
    manualSortConfig?: Record<string, IManualSortValue[]>,
    alphabeticalSortConfig?: Record<string, 'ascending' | 'descending'>
): { lt: INestNode; tt: INestNode; metric: (IRow | null)[][] } {
    const manualSortLookup = createManualSortLookup(manualSortConfig);
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
            manualSortLookup,
            alphabeticalSortConfig
        );
        if (dimsInColumn.length > 0) {
            const ks = dimsInColumn.map((x) => x.fid);
            const vs = getFirsts(tt.children[0]).map((x) => x.value);
            // move data of First column to first
            const mentioned: IRow[] = [];
            const rest: IRow[] = [];
            allData.forEach((x) => (ks.every((k, i) => x[k] === vs[i]) ? mentioned.push(x) : rest.push(x)));
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
                allData,
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
            allData,
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
            allData.forEach((x) => (ks.every((k, i) => x[k] === vs[i]) ? mentioned.push(x) : rest.push(x)));
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
                allData,
                collapsedKeyList,
                showTableSummary,
                sort,
                undefined,
                manualSortLookup,
                alphabeticalSortConfig
            );
        }
    }

    const metric = buildMetricTableFromNestTree(lt, tt, [...allData, ...aggData]);
    return { lt, tt, metric };
}
