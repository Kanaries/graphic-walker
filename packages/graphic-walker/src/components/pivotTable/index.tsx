import React, { useEffect, useMemo, useState, useRef } from 'react';
import { buildPivotTableService } from '../../services';
import { toWorkflow } from '../../utils/workflow';
import { dataQuery } from '../../computation';
import { useAppRootContext } from '../../components/appRoot';
import LeftTree from './leftTree';
import TopTree from './topTree';
import { observer } from 'mobx-react-lite';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IViewField, IVisualConfigNew, IVisualLayout } from '../../interfaces';
import { INestNode } from './inteface';
import { unstable_batchedUpdates } from 'react-dom';
import MetricTable from './metricTable';
import LoadingLayer from '../loadingLayer';
import { useCompututaion, useVizStore } from '../../store';
import { fold2 } from '../../lib/op/fold';
import { getSort, getSortedEncoding } from '../../utils';

interface PivotTableProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
    loading: boolean;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: IVisualConfigNew;
    layout: IVisualLayout;
}

const emptyMap = new Map();

const PivotTable: React.FC<PivotTableProps> = observer(function PivotTableComponent(props) {
    const { data, visualConfig, loading, layout, draggableFieldState } = props;
    const computation = useCompututaion();
    const appRef = useAppRootContext();
    const [leftTree, setLeftTree] = useState<INestNode | null>(null);
    const [topTree, setTopTree] = useState<INestNode | null>(null);
    const [metricTable, setMetricTable] = useState<any[][]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const vizStore = useVizStore();
    const enableCollapse = !!vizStore;
    const tableCollapsedHeaderMap = vizStore?.tableCollapsedHeaderMap ?? emptyMap;
    const { rows, columns } = draggableFieldState;
    const { defaultAggregated, folds } = visualConfig;
    const { showTableSummary } = layout;
    const aggData = useRef<IRow[]>([]);
    const [topTreeHeaderRowNum, setTopTreeHeaderRowNum] = useState<number>(0);

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
        if (!enableCollapse) {
            generateNewTable();
            return;
        }
        if (vizStore && vizStore.tableCollapsedHeaderMap.size > 0) {
            // If some visual configs change, clear the collapse state
            // As tableCollapsedHeaderMap is also listened, data will be reaggregated later.
            vizStore.resetTableCollapsedHeader();
            // This forces data to be reaggregated if showTableSummary is on, as aggregation will be skipped later.
            if (showTableSummary) {
                aggregateGroupbyData();
            }
        } else {
            aggregateThenGenerate();
        }
    }, [data, enableCollapse, vizStore]);

    useEffect(() => {
        if (!enableCollapse || showTableSummary) {
            // If showTableSummary is on, there is no need to generate extra queries. Directly generate new table.
            generateNewTable();
        } else {
            aggregateThenGenerate();
        }
    }, [enableCollapse, vizStore?.tableCollapsedHeaderMap]);

    const aggregateThenGenerate = async () => {
        await aggregateGroupbyData();
        generateNewTable();
    };

    const generateNewTable = () => {
        appRef.current?.updateRenderStatus('rendering');
        setIsLoading(true);
        const sort = getSort(draggableFieldState);
        const sortedEncoding = getSortedEncoding(draggableFieldState);
        buildPivotTableService(
            dimsInRow,
            dimsInColumn,
            data,
            aggData.current,
            Array.from(tableCollapsedHeaderMap.keys()),
            showTableSummary,
            sort !== 'none' && sortedEncoding !== 'none'
                ? {
                      fid: sortedEncoding === 'column' ? `${measInRow[0].fid}_${measInRow[0].aggName}` : `${measInColumn[0].fid}_${measInColumn[0].aggName}`,
                      mode: sortedEncoding,
                      type: sort,
                  }
                : undefined
        )
            .then((data) => {
                const { lt, tt, metric } = data;
                unstable_batchedUpdates(() => {
                    setLeftTree(lt);
                    setTopTree(tt);
                    setMetricTable(metric);
                });
                appRef.current?.updateRenderStatus('idle');
                setIsLoading(false);
            })
            .catch((err) => {
                appRef.current?.updateRenderStatus('error');
                console.log(err);
                setIsLoading(false);
            });
    };

    const aggregateGroupbyData = () => {
        if (dimsInRow.length === 0 && dimsInColumn.length === 0) return;
        if (data.length === 0) return;
        let groupbyCombListInRow: IViewField[][] = [];
        let groupbyCombListInCol: IViewField[][] = [];
        if (showTableSummary) {
            groupbyCombListInRow = dimsInRow.map((dim, idx) => dimsInRow.slice(0, idx));
            groupbyCombListInCol = dimsInColumn.map((dim, idx) => dimsInColumn.slice(0, idx));
        } else {
            const collapsedDimList = Array.from(tableCollapsedHeaderMap).map(([key, path]) => path[path.length - 1].key);
            const collapsedDimsInRow = dimsInRow.filter((dim) => collapsedDimList.includes(dim.fid));
            const collapsedDimsInColumn = dimsInColumn.filter((dim) => collapsedDimList.includes(dim.fid));
            groupbyCombListInRow = collapsedDimsInRow.map((dim) => dimsInRow.slice(0, dimsInRow.indexOf(dim) + 1));
            groupbyCombListInCol = collapsedDimsInColumn.map((dim) => dimsInColumn.slice(0, dimsInColumn.indexOf(dim) + 1));
        }
        groupbyCombListInRow.push(dimsInRow);
        groupbyCombListInCol.push(dimsInColumn);
        const groupbyCombList: IViewField[][] = groupbyCombListInCol
            .flatMap((combInCol) => groupbyCombListInRow.map((combInRow) => [...combInCol, ...combInRow]))
            .slice(0, -1);
        setIsLoading(true);
        appRef.current?.updateRenderStatus('computing');
        const groupbyPromises: Promise<IRow[]>[] = groupbyCombList.map((dimComb) => {
            if (!vizStore) return Promise.resolve([]);
            const { viewFilters, allFields, viewMeasures, sort, limit, config } = vizStore;
            const { timezoneDisplayOffset } = config;
            const workflow = toWorkflow(
                viewFilters,
                allFields,
                dimComb,
                viewMeasures,
                defaultAggregated,
                sort,
                folds ?? [],
                limit > 0 ? limit : undefined,
                timezoneDisplayOffset
            );
            return dataQuery(computation, workflow, limit > 0 ? limit : undefined)
                .then((res) => fold2(res, defaultAggregated, allFields, viewMeasures, dimComb, folds))
                .catch((err) => {
                    appRef.current?.updateRenderStatus('error');
                    return [];
                });
        });
        return new Promise<void>((resolve, reject) => {
            Promise.all(groupbyPromises)
                .then((result) => {
                    setIsLoading(false);
                    const finalizedData = [...result.flat()];
                    aggData.current = finalizedData;
                    resolve();
                })
                .catch((err) => {
                    console.error(err);
                    setIsLoading(false);
                    reject();
                });
        });
    };

    // const { leftTree, topTree, metricTable } = store;
    return (
        <div className="relative">
            {(isLoading || loading) && <LoadingLayer />}
            <div className="flex">
                <table className="border border-gray-300 border-collapse">
                    <thead className="border border-gray-300">
                        {new Array(Math.max(topTreeHeaderRowNum - 1, 0)).fill(0).map((_, i) => (
                            <tr className="" key={i}>
                                <td
                                    className="bg-zinc-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-100 p-2 m-1 text-xs border border-gray-300"
                                    colSpan={dimsInRow.length + (measInRow.length > 0 ? 1 : 0)}
                                >
                                    _
                                </td>
                            </tr>
                        ))}
                        {topTreeHeaderRowNum > 0 && (
                            <tr className="">
                                {dimsInRow.map((x) => (
                                    <td
                                        className="bg-zinc-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-100 p-2 m-1 text-xs border whitespace-nowrap border-gray-300"
                                        colSpan={1}
                                    >
                                        {x.name}
                                    </td>
                                ))}
                                {measInRow.length > 0 && (
                                    <td
                                        className="bg-zinc-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-100 p-2 m-1 text-xs border border-gray-300"
                                        colSpan={1}
                                    >
                                        _
                                    </td>
                                )}
                            </tr>
                        )}
                    </thead>
                    {leftTree && (
                        <LeftTree
                            data={leftTree}
                            dimsInRow={dimsInRow}
                            measInRow={measInRow}
                            onHeaderCollapse={(n) => vizStore?.updateTableCollapsedHeader(n)}
                            enableCollapse={enableCollapse}
                        />
                    )}
                </table>
                <table className="border border-gray-300 border-collapse">
                    {topTree && (
                        <TopTree
                            data={topTree}
                            dimsInCol={dimsInColumn}
                            measInCol={measInColumn}
                            onHeaderCollapse={(n) => vizStore?.updateTableCollapsedHeader(n)}
                            onTopTreeHeaderRowNumChange={(num) => setTopTreeHeaderRowNum(num)}
                            enableCollapse={enableCollapse}
                        />
                    )}
                    {metricTable && <MetricTable matrix={metricTable} meaInColumns={measInColumn} meaInRows={measInRow} />}
                </table>
            </div>
        </div>
    );
});

export default PivotTable;
