import { INestNode } from '../components/pivotTable/inteface';
import { buildMetricTableFromNestTree, buildNestTree } from '../components/pivotTable/utils';
import { IViewField, IRow } from '../interfaces';
import { PIVOT_TABLE_DEBUG } from '../constants';

const getFirsts = (item: INestNode): INestNode[] => {
    if (item.children.length > 0) {
        return [item, ...getFirsts(item.children[0])];
    }
    return [item];
};

function countTreeNodes(node: INestNode): number {
    let count = 1;
    for (const child of node.children) {
        count += countTreeNodes(child);
    }
    return count;
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
    const totalStart = performance.now();
    
    if (PIVOT_TABLE_DEBUG) {
        console.log('%c[buildPivotTable] START', 'color: #be4bdb; font-weight: bold');
        console.log(`  Input: allData=${allData.length.toLocaleString()}, aggData=${aggData.length.toLocaleString()}`);
        console.log(`  DimsInRow: ${dimsInRow.length}, DimsInColumn: ${dimsInColumn.length}`);
        console.log(`  Sort mode: ${sort?.mode || 'none'}`);
    }
    
    let lt: INestNode;
    let tt: INestNode;
    
    let ltBuildTime = 0;
    let ttBuildTime = 0;
    let dataSplitTime = 0;
    
    if (sort?.mode === 'row') {
        const ttStart = performance.now();
        tt = buildNestTree(
            dimsInColumn.map((d) => d.fid),
            allData,
            collapsedKeyList,
            showTableSummary
        );
        ttBuildTime = performance.now() - ttStart;
        
        if (dimsInColumn.length > 0) {
            const splitStart = performance.now();
            const ks = dimsInColumn.map((x) => x.fid);
            const vs = getFirsts(tt.children[0]).map((x) => x.value);
            // move data of First column to first
            const mentioned: IRow[] = [];
            const rest: IRow[] = [];
            allData.forEach((x) => (ks.every((k, i) => x[k] === vs[i]) ? mentioned.push(x) : rest.push(x)));
            dataSplitTime = performance.now() - splitStart;
            
            const ltStart = performance.now();
            lt = buildNestTree(
                dimsInRow.map((d) => d.fid),
                mentioned,
                collapsedKeyList,
                showTableSummary,
                sort,
                rest
            );
            ltBuildTime = performance.now() - ltStart;
        } else {
            const ltStart = performance.now();
            lt = buildNestTree(
                dimsInRow.map((d) => d.fid),
                allData,
                collapsedKeyList,
                showTableSummary,
                sort
            );
            ltBuildTime = performance.now() - ltStart;
        }
    } else {
        const ltStart = performance.now();
        lt = buildNestTree(
            dimsInRow.map((d) => d.fid),
            allData,
            collapsedKeyList,
            showTableSummary
        );
        ltBuildTime = performance.now() - ltStart;
        
        if (sort && dimsInRow.length > 0) {
            const splitStart = performance.now();
            const ks = dimsInRow.map((x) => x.fid);
            const vs = getFirsts(lt.children[0]).map((x) => x.value);
            // move data of First row to first
            const mentioned: IRow[] = [];
            const rest: IRow[] = [];
            allData.forEach((x) => (ks.every((k, i) => x[k] === vs[i]) ? mentioned.push(x) : rest.push(x)));
            dataSplitTime = performance.now() - splitStart;
            
            const ttStart = performance.now();
            tt = buildNestTree(
                dimsInColumn.map((d) => d.fid),
                mentioned,
                collapsedKeyList,
                showTableSummary,
                sort,
                rest
            );
            ttBuildTime = performance.now() - ttStart;
        } else {
            const ttStart = performance.now();
            tt = buildNestTree(
                dimsInColumn.map((d) => d.fid),
                allData,
                collapsedKeyList,
                showTableSummary,
                sort
            );
            ttBuildTime = performance.now() - ttStart;
        }
    }

    if (PIVOT_TABLE_DEBUG) {
        console.log(`  ─────────────────────────────────`);
        console.log(`  buildNestTree (left): ${ltBuildTime.toFixed(2)}ms → ${countTreeNodes(lt).toLocaleString()} nodes`);
        console.log(`  buildNestTree (top): ${ttBuildTime.toFixed(2)}ms → ${countTreeNodes(tt).toLocaleString()} nodes`);
        if (dataSplitTime > 0) {
            console.log(`  Data split: ${dataSplitTime.toFixed(2)}ms`);
        }
    }

    // Merge data for metric table
    const mergeStart = performance.now();
    const mergedData = [...allData, ...aggData];
    const mergeTime = performance.now() - mergeStart;
    
    // Use optimized hash_index algorithm O(D + N*M)
    const metricStart = performance.now();
    const metric = buildMetricTableFromNestTree(lt, tt, mergedData);
    const metricTime = performance.now() - metricStart;
    
    const totalTime = performance.now() - totalStart;
    
    if (PIVOT_TABLE_DEBUG) {
        console.log(`  Data merge: ${mergeTime.toFixed(2)}ms (${mergedData.length.toLocaleString()} rows)`);
        console.log(`  buildMetricTable: ${metricTime.toFixed(2)}ms`);
        console.log(`  ─────────────────────────────────`);
        console.log(`  TOTAL buildPivotTable: ${totalTime.toFixed(2)}ms`);
    }
    
    return { lt, tt, metric };
}
