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

interface PivotTableProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
    loading: boolean;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: IVisualConfig;
}
const PivotTable: React.FC<PivotTableProps> = observer((props) => {
    const { data } = props;
    // const store = usePivotTableStore();
    const { vizStore } = useGlobalStore();
    const { draggableFieldState } = vizStore;
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

    const measures = useMemo(() => {
        return [...measInRow, ...measInColumn];
    }, [measInRow, measInColumn]);

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
            // console.log({
            //     lt,
            //     tt,
            //     metric,
            // });
            // debugger
            unstable_batchedUpdates(() => {
                setLeftTree(lt);
                setTopTree(tt);
                setMetricTable(metric);
            });
        }
    }, [dimsInRow, dimsInColumn, data]);

    // console.log('render');

    // const { leftTree, topTree, metricTable } = store;
    return (
        <div>
            <div>
                <h1>left</h1>
                {leftTree && <LeftTree data={leftTree} dimsInRow={dimsInRow} measInRow={measInRow}  />}
            </div>
            <div>
                <h1>top</h1>
                {topTree && <TopTree data={topTree} dimsInCol={dimsInColumn} measInCol={measInColumn} />}
            </div>
            <div>
                <h1>metric</h1>
                <MetricTable matrix={metricTable} measures={measures} />
            </div>
        </div>
    );
});

export default PivotTable;

// const PivotTableApp: React.FC<PivotTableProps> = (props) => {
//     return (
//         <PivotTableStoreWrapper {...props}>
//             <PivotTable />
//         </PivotTableStoreWrapper>
//     );
// };
