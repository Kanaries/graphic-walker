import React, { useEffect, useMemo, useState } from 'react';
import { StoreWrapper, useGlobalStore } from '../../store';
import { PivotTableDataProps, PivotTableStoreWrapper, usePivotTableStore } from './store';
import { applyFilter, applyViewQuery, transformDataService } from '../../services';
import { observer } from 'mobx-react-lite';
import LeftTree from './leftTree';
import TopTree from './topTree';
import {
    DeepReadonly,
    DraggableFieldState,
    IDarkMode,
    IRow,
    IThemeKey,
    IViewField,
    IVisualConfig,
} from '../../interfaces';
import { INestNode } from './inteface';
import { buildMetricTableFromNestTree, buildNestTree } from './utils';
import { getMeaAggKey } from '../../utils';
import { unstable_batchedUpdates } from 'react-dom';
import MetricTable from './metricTable';
import { toJS } from 'mobx';

// const PTStateConnector = observer(function StateWrapper (props: PivotTableProps) {
//     const store = usePivotTableStore();
//     const { vizStore } = useGlobalStore();
//     const { draggableFieldState } = vizStore;
//     const { rows, columns } = draggableFieldState;
//     return (
//         <PivotTable
//             {...props}
//             draggableFieldState={draggableFieldState}
//             visualConfig={visualConfig}
//         />
//     );
// })

interface PivotTableProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
    loading: boolean;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: IVisualConfig;
}
const PivotTable: React.FC<PivotTableProps> = (props) => {
    const { data, draggableFieldState } = props;
    // const store = usePivotTableStore();
    // const { vizStore } = useGlobalStore();
    // const { draggableFieldState } = vizStore;
    const { rows, columns } = draggableFieldState;
    const [leftTree, setLeftTree] = useState<INestNode | null>(null);
    const [topTree, setTopTree] = useState<INestNode | null>(null);
    const [metricTable, setMetricTable] = useState<any[][]>([]);

    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters, viewMeasures } = vizStore;
    const { currentDataset, tableCollapsedHeaderMap } = commonStore;
    const { dataSource } = currentDataset;
    const [ aggData, setAggData ] = useState<IRow[]>([]);
    const [ topTreeHeaderRowNum, setTopTreeHeaderRowNum ] = useState<number>(0);

    const dimsInRow = useMemo(() => {
        return rows.filter((f) => f.analyticType === 'dimension');
    }, [rows]);

    const dimsInColumn = useMemo(() => {
        return columns.filter((f) => f.analyticType === 'dimension');
    }, [columns]);

    const measInRow = useMemo(() => {
        return rows.filter((f) => f.analyticType === 'measure');
    }, [rows]);

    const measInColumn = useMemo(() => {
        return columns.filter((f) => f.analyticType === 'measure');
    }, [columns]);

    useEffect(() => {
        if ((dimsInRow.length > 0 || dimsInColumn.length > 0) && data.length > 0) {
            const lt = buildNestTree(
                dimsInRow.map((d) => d.fid),
                data,
                tableCollapsedHeaderMap
            );
            const tt = buildNestTree(
                dimsInColumn.map((d) => d.fid),
                data,
                tableCollapsedHeaderMap
            );
            const metric = buildMetricTableFromNestTree(lt, tt, [...data, ...aggData]);
            // debugger
            unstable_batchedUpdates(() => {
                setLeftTree(lt);
                setTopTree(tt);
                setMetricTable(metric);
            });
        }
    }, [dimsInColumn, dimsInRow, aggData, data]);

    useEffect(() => {
        if (tableCollapsedHeaderMap.size > 0) {
            commonStore.resetTableCollapsedHeader();
        }
    }, [dataSource, viewFilters, allFields, dimsInRow, dimsInColumn]);

    useEffect(() => {
        if (dimsInRow.length === 0 && dimsInColumn.length === 0) return;

        const collapsedDimList = Array.from(tableCollapsedHeaderMap).map(([key, path]) => {
            return path[path.length - 1].key;
        });
        const collapsedDimsInRow = dimsInRow.filter((dim) => collapsedDimList.includes(dim.fid));
        const collapsedDimsInColumn = dimsInColumn.filter((dim) => collapsedDimList.includes(dim.fid));
        const groupbyListInRow:IViewField[][] = collapsedDimsInRow.map((dim) => {
            return dimsInRow.slice(0, dimsInRow.indexOf(dim) + 1);
        });
        groupbyListInRow.push(dimsInRow)
        const groupbyListInCol:IViewField[][] = collapsedDimsInColumn.map((dim) => {
            return dimsInColumn.slice(0, dimsInColumn.indexOf(dim) + 1);
        });
        groupbyListInCol.push(dimsInColumn)
        const groupbyCombList:IViewField[][] = groupbyListInCol.flatMap(combInCol =>
            groupbyListInRow.map(combInRow => [...combInCol, ...combInRow])
        ).slice(0, -1);

        const groupbyPromises = groupbyCombList.map((dimComb) => {
            return applyFilter(dataSource, viewFilters)
                .then((data) => transformDataService(data, allFields))
                .then((d) => {
                    const dims = dimComb;
                    const meas = viewMeasures;
                    const config = toJS(vizStore.visualConfig);
                    return applyViewQuery(d, dims.concat(meas), {
                        op: config.defaultAggregated ? 'aggregate' : 'raw',
                        groupBy: dims.map((f) => f.fid),
                        measures: meas.map((f) => ({ field: f.fid, agg: f.aggName as any, asFieldKey: getMeaAggKey(f.fid, f.aggName!) })),
                    });
                })
                .then((data) => {
                    return data;
                })
                .catch((err) => {
                    console.error(err);
                    return [];
                });
        });
          
        Promise.all(groupbyPromises)
            .then((result) => {
                const finalizedData = [...result.flat()];
                setAggData(finalizedData);
            })
            .catch((err) => {
                console.error(err);
            });
    }, [tableCollapsedHeaderMap]);

    // const { leftTree, topTree, metricTable } = store;
    return (
        <div className="flex">
            <table className="border border-gray-300 border-collapse">
                <thead className="border border-gray-300">
                    {new Array(topTreeHeaderRowNum).fill(0).map((_, i) => (
                        <tr className="" key={i}>
                            <td className="p-2 m-1 text-xs text-white border border-gray-300" colSpan={dimsInRow.length + (measInRow.length > 0 ? 1 : 0)}>_</td>
                        </tr>
                    ))}
                </thead>
                {leftTree && 
                    <LeftTree 
                        data={leftTree} 
                        dimsInRow={dimsInRow} 
                        measInRow={measInRow} 
                        onHeaderCollapse={commonStore.updateTableCollapsedHeader.bind(commonStore)}
                    />}
            </table>
            <table className="border border-gray-300 border-collapse">
                {topTree && 
                    <TopTree 
                        data={topTree} 
                        dimsInCol={dimsInColumn} 
                        measInCol={measInColumn} 
                        onHeaderCollapse={commonStore.updateTableCollapsedHeader.bind(commonStore)}
                        onTopTreeHeaderRowNumChange={(num) => setTopTreeHeaderRowNum(num)}
                    />}
                {metricTable && 
                    <MetricTable 
                        matrix={metricTable} 
                        meaInColumns={measInColumn} 
                        meaInRows={measInRow} 
                    />}
            </table>
        </div>
    );
};

export default observer(PivotTable);

// const PivotTableApp: React.FC<PivotTableProps> = (props) => {
//     return (
//         <PivotTableStoreWrapper {...props}>
//             <PivotTable />
//         </PivotTableStoreWrapper>
//     );
// };
