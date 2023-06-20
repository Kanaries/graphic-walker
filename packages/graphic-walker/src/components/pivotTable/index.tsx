import React, { useEffect, useMemo, useState } from 'react';
import LeftTree from './leftTree';
import TopTree from './topTree';
import {
    IAggregator,
    IDarkMode,
    IField,
    IRow,
    IThemeKey,
} from '../../interfaces';
import { IVisEncodingChannel, IVisField, IVisSchema } from '../../vis/protocol/interface';
import { INestNode } from './inteface';
import { buildMetricTableFromNestTree, buildNestTree } from './utils';
import { unstable_batchedUpdates } from 'react-dom';
import MetricTable from './metricTable';

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
    spec: IVisSchema;
    fields: readonly IVisField[];
    loading: boolean;
}
const PivotTable: React.FC<PivotTableProps> = (props) => {
    const { spec, data, fields } = props;
    // const store = usePivotTableStore();
    // const { vizStore } = useGlobalStore();
    // const { draggableFieldState } = vizStore;
    const { x, y, column, row } = spec.encodings;
    const rowRefs = useMemo(() => {
        let res: IVisEncodingChannel[] = [];
        if (y) {
            res = res.concat(y);
        }
        if (row) {
            res = res.concat(row);
        }
        return res;
    }, [y, row]);
    const colRefs = useMemo(() => {
        let res: IVisEncodingChannel[] = [];
        if (x) {
            res = res.concat(x);
        }
        if (column) {
            res = res.concat(column);
        }
        return res;
    }, [x, column]);
    const [rows, columns] = useMemo(() => {
        return [rowRefs, colRefs].map((refs) => {
            return refs.map<IField>(ref => {
                let f: IVisField = null!;
                let aggregate: IAggregator | null = null;
                if (typeof ref === 'string') {
                    f = fields.find(f => f.key === ref)!;
                } else {
                    f = fields.find(f => f.key === ref.field)!;
                    aggregate = ref.aggregate || null;
                }
                if (!f) {
                    return null!;
                }
                return {
                    fid: f.key,
                    name: f.name || f.key,
                    analyticType: Boolean(aggregate) ? 'measure' : 'dimension',
                    semanticType: f.type,
                    aggName: aggregate ?? undefined,
                    computed: Boolean(f.expression),
                    expression: f.expression,
                };
            }).filter(Boolean);
        });
    }, [rowRefs, colRefs, fields]);
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
