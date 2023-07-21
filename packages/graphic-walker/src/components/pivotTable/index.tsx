import React, { useEffect, useMemo, useState } from 'react';
import { StoreWrapper, useGlobalStore } from '../../store';
import { PivotTableDataProps, PivotTableStoreWrapper, usePivotTableStore } from './store';
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
    visualConfig: DeepReadonly<IVisualConfig>;
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
                data
            );
            const tt = buildNestTree(
                dimsInColumn.map((d) => d.fid),
                data
            );
            const metric = buildMetricTableFromNestTree(lt, tt, data);
            unstable_batchedUpdates(() => {
                setLeftTree(lt);
                setTopTree(tt);
                setMetricTable(metric);
            });
        }
    }, [dimsInRow, dimsInColumn, data]);

    // const { leftTree, topTree, metricTable } = store;
    return (
        <div className="flex">
            <table className="border border-gray-300 border-collapse">
                <thead className="border border-gray-300">
                    {new Array(dimsInColumn.length + (measInColumn.length > 0 ? 1 : 0)).fill(0).map((_, i) => (
                        <tr className="" key={i}>
                            <td className="p-2 m-1 text-xs text-white border border-gray-300" colSpan={dimsInRow.length + (measInRow.length > 0 ? 1 : 0)}>_</td>
                        </tr>
                    ))}
                </thead>
                {leftTree && <LeftTree data={leftTree} dimsInRow={dimsInRow} measInRow={measInRow} />}
            </table>
            <table className="border border-gray-300 border-collapse">
                {topTree && <TopTree data={topTree} dimsInCol={dimsInColumn} measInCol={measInColumn} />}
                {metricTable && <MetricTable matrix={metricTable} meaInColumns={measInColumn} meaInRows={measInRow} />}
            </table>
        </div>
    );
};

export default PivotTable;

// const PivotTableApp: React.FC<PivotTableProps> = (props) => {
//     return (
//         <PivotTableStoreWrapper {...props}>
//             <PivotTable />
//         </PivotTableStoreWrapper>
//     );
// };
