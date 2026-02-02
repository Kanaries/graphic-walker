/* eslint no-restricted-globals: 0 */
/* eslint-disable */ 
import { buildPivotTable } from "./buildPivotTable"
import { PIVOT_TABLE_DEBUG } from "../constants"

/**
 * @param {import('../interfaces').IViewField[]} dimsInRow
 * @param {import('../interfaces').IViewField[]} dimsInColumn
 * @param {import('../interfaces').IRow[]} allData
 * @param {import('../interfaces').IRow} aggData
 * @param {string[]} collapsedKeyList
 * @param {boolean} showTableSummary
 * @return {{lt: import('../components/pivotTable/inteface').INestNode, tt: import('../components/pivotTable/inteface').INestNode, metric: import('../interfaces').(IRow | null)[][]}}
 */

/**
 * @param {MessageEvent<{ dimsInRow: import('../interfaces').IViewField[]; dimsInColumn: import('../interfaces').IViewField[]; allData: import('../interfaces').IRow[]; aggData: import('../interfaces').IRow[]; collapsedKeyList: string[]; showTableSummary: boolean }>} e
 */
const main = e => {
    const workerStartTime = performance.now();
    
    const { dimsInRow, dimsInColumn, allData, aggData, collapsedKeyList, showTableSummary, sort } = e.data;
    
    if (PIVOT_TABLE_DEBUG) {
        console.log('%c[Worker] Message received', 'color: #ffa94d; font-weight: bold');
        console.log(`  Data size: allData=${allData.length.toLocaleString()}, aggData=${aggData.length.toLocaleString()}`);
        console.log(`  Dims: rows=${dimsInRow.length}, cols=${dimsInColumn.length}`);
    }
    
    try {
        const buildStartTime = performance.now();
        const ans = buildPivotTable(dimsInRow, dimsInColumn, allData, aggData, collapsedKeyList, showTableSummary, sort);
        const buildEndTime = performance.now();
        
        const postStartTime = performance.now();
        self.postMessage(ans);
        const postEndTime = performance.now();
        
        const workerEndTime = performance.now();
        
        if (PIVOT_TABLE_DEBUG) {
            console.log('%c[Worker] Processing complete', 'color: #ffa94d; font-weight: bold');
            console.log(`  ─────────────────────────────────`);
            console.log(`  Result: lt=${ans.lt?.children?.length || 0} children, tt=${ans.tt?.children?.length || 0} children`);
            console.log(`  Matrix: ${ans.metric?.length || 0} × ${ans.metric?.[0]?.length || 0}`);
            console.log(`  ─────────────────────────────────`);
            console.log(`  buildPivotTable(): ${(buildEndTime - buildStartTime).toFixed(2)}ms`);
            console.log(`  postMessage(): ${(postEndTime - postStartTime).toFixed(2)}ms`);
            console.log(`  Total worker time: ${(workerEndTime - workerStartTime).toFixed(2)}ms`);
        }
    } catch (error) {
        console.error('[Worker] Error:', error);
        self.postMessage({ error: error.message });
    }
};

self.addEventListener('message', main, false);
