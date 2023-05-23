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
import { builtInThemes } from '../../vis/theme';
import { useCurrentMediaTheme } from '../../utils/media';
import { getMeaAggKey } from '../../utils';
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
    const { data, draggableFieldState, themeKey = 'vega', dark = 'media' } = props;

    const mediaTheme = useCurrentMediaTheme(dark);
    const themeConfig = builtInThemes[themeKey]?.[mediaTheme];
    // const store = usePivotTableStore();
    // const { vizStore } = useGlobalStore();
    // const { draggableFieldState } = vizStore;
    const { rows, columns, table_values, color, opacity, size } = draggableFieldState;
    const [leftTree, setLeftTree] = useState<INestNode | null>(null);
    const [topTree, setTopTree] = useState<INestNode | null>(null);
    const [metricTable, setMetricTable] = useState<any[][]>([]);

    const dimsInRow = useMemo(() => {
        return rows.filter((f) => f.analyticType === 'dimension');
    }, [rows]);

    const dimsInColumn = useMemo(() => {
        return columns.filter((f) => f.analyticType === 'dimension');
    }, [columns]);

    const measures = useMemo(() => {
        return table_values.filter((f) => f.analyticType === 'measure');
    }, [table_values]);

    const colorMeaKey = useMemo(() => {
        return color.length === 1 && color[0].analyticType === 'measure'
            ? getMeaAggKey(color[0].fid, color[0].aggName)
            : undefined;
    }, [color]);

    const opacityMeaKey = useMemo(() => {
        return opacity.length === 1 && opacity[0].analyticType === 'measure'
            ? getMeaAggKey(opacity[0].fid, opacity[0].aggName)
            : undefined;
    }, [opacity]);

    const sizeMeaKey = useMemo(() => {
        return size.length === 1 && size[0].analyticType === 'measure'
            ? getMeaAggKey(size[0].fid, size[0].aggName)
            : undefined;
    }, [size]);

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
            // debugger
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
                    {new Array(dimsInColumn.length + (measures.length > 0 ? 1 : 0)).fill(0).map((_, i) => (
                        <tr className="" key={i}>
                            <td
                                className="p-2 m-1 text-xs text-white border border-gray-300"
                                colSpan={dimsInRow.length + (measures.length > 0 ? 1 : 0)}
                            >
                                _
                            </td>
                        </tr>
                    ))}
                </thead>
                {leftTree && <LeftTree data={leftTree} dimsInRow={dimsInRow} />}
            </table>
            <table className="border border-gray-300 border-collapse">
                {topTree && <TopTree data={topTree} dimsInCol={dimsInColumn} measures={measures} />}
                {metricTable && (
                    <MetricTable
                        matrix={metricTable}
                        measures={measures}
                        themeConfig={themeConfig}
                        colorMeaKey={colorMeaKey}
                        opacityMeaKey={opacityMeaKey}
                        sizeMeaKey={sizeMeaKey}
                    />
                )}
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
