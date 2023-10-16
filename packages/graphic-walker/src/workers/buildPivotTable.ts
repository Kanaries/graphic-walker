import { INestNode } from '../components/pivotTable/inteface';
import { buildMetricTableFromNestTree, buildNestTree } from '../components/pivotTable/utils';
import { IViewField, IRow } from '../interfaces';

const getFirsts = (item: INestNode): INestNode[] => {
    if (item.children.length > 0) {
        return [item, ...getFirsts(item.children[0])];
    }
    return [item];
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
    }
): { lt: INestNode; tt: INestNode; metric: (IRow | null)[][] } {
    let lt: INestNode;
    let tt: INestNode;
    if (sort?.mode === 'row') {
        tt = buildNestTree(
            dimsInColumn.map((d) => d.fid),
            allData,
            collapsedKeyList,
            showTableSummary
        );
        let data = allData;
        if (dimsInColumn.length > 0 ) {
            const ks = dimsInColumn.map(x => x.fid);
            const vs = getFirsts(tt.children[0]).map(x => x.value);
            data = allData.filter(x => ks.every((k, i) => x[k] === vs[i]));
        }
        lt = buildNestTree(
            dimsInRow.map((d) => d.fid),
            data,
            collapsedKeyList,
            showTableSummary,
            sort
        );
    } else {
        lt = buildNestTree(
            dimsInRow.map((d) => d.fid),
            allData,
            collapsedKeyList,
            showTableSummary
        );
        let data = allData;
        if (sort && dimsInRow.length > 0 ) {
            const ks = dimsInRow.map(x => x.fid);
            const vs = getFirsts(lt.children[0]).map(x => x.value);
            data = allData.filter(x => ks.every((k, i) => x[k] === vs[i]));
        }
        tt = buildNestTree(
            dimsInColumn.map((d) => d.fid),
            data,
            collapsedKeyList,
            showTableSummary,
            sort?.mode === 'column' ? sort : undefined
        );
    }

    const metric = buildMetricTableFromNestTree(lt, tt, [...allData, ...aggData]);
    return { lt, tt, metric };
}
