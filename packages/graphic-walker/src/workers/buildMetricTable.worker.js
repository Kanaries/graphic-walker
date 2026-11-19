/* eslint no-restricted-globals: 0 */
/* eslint-disable */ 
import { buildPivotTable } from "./buildPivotTable"
/**
 * @param {import('../interfaces').IViewField[]} dimsInRow
 * @param {import('../interfaces').IViewField[]} dimsInColumn
 * @param {import('../interfaces').IRow[]} allData
 * @param {import('../interfaces').IRow} aggData
 * @param {string[]} collapsedKeyList
 * @param {boolean} showTableSummary
 * @return {{lt: import('../components/pivotTable/interface').INestNode, tt: import('../components/pivotTable/interface').INestNode, metric: (import('../interfaces').IRow | null | undefined)[][]}}
 */

/**
 * @param {MessageEvent<{ dimsInRow: import('../interfaces').IViewField[]; dimsInColumn: import('../interfaces').IViewField[]; allData: import('../interfaces').IRow[]; aggData: import('../interfaces').IRow[]; collapsedKeyList: string[]; showTableSummary: boolean }>} e
 */
const main = e => {
    const { dimsInRow, dimsInColumn, allData, aggData, collapsedKeyList, showTableSummary, sort, measures } = e.data;
    try {
        const ans = buildPivotTable(dimsInRow, dimsInColumn, allData, aggData, collapsedKeyList, showTableSummary, sort, measures);
        self.postMessage(ans);
    } catch (error) {
        self.postMessage(error instanceof Error ? error.message : String(error));
    }
};

self.addEventListener('message', main, false);
