import { INestNode } from "../components/pivotTable/inteface";
import { buildMetricTableFromNestTree, buildNestTree } from "../components/pivotTable/utils"
import { IViewField, IRow } from "../interfaces"

export function buildPivotTable (
    dimsInRow: IViewField[], 
    dimsInColumn: IViewField[], 
    allData: IRow[], 
    aggData: IRow[], 
    collapsedKeyList: string[], 
    showTableSummary: boolean
): {lt: INestNode, tt: INestNode, metric: (IRow | null)[][]} {
    const lt = buildNestTree(
        dimsInRow.map((d) => d.fid),
        allData,
        collapsedKeyList,
        showTableSummary
    );
    const tt = buildNestTree(
        dimsInColumn.map((d) => d.fid),
        allData,
        collapsedKeyList,
        showTableSummary
    );
    const metric = buildMetricTableFromNestTree(lt, tt, [...allData, ...aggData])
    return {lt, tt, metric}
}