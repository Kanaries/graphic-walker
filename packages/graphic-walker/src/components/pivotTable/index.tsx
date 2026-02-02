import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { buildPivotTableService } from '../../services';
import { toWorkflow } from '../../utils/workflow';
import { dataQuery } from '../../computation';
import { useAppRootContext } from '../../components/appRoot';
import LeftTree from './leftTree';
import TopTree from './topTree';
import { DeepReadonly, DraggableFieldState, IRow, IThemeKey, IViewField, IVisualConfigNew, IVisualLayout, IVisualConfig } from '../../interfaces';
import { INestNode } from './inteface';
import { unstable_batchedUpdates } from 'react-dom';
import MetricTable from './metricTable';
import LoadingLayer from '../loadingLayer';
import { useCompututaion, useVizStore } from '../../store';
import { fold2 } from '../../lib/op/fold';
import { getFieldIdentifier, getSort, getSortedEncoding } from '../../utils';
import { GWGlobalConfig } from '@/vis/theme';
import { getAllFields, getViewEncodingFields } from '../../store/storeStateLib';
import { PIVOT_TABLE_COLUMN_LIMIT, PIVOT_TABLE_DEBUG, PIVOT_TABLE_DEFAULT_LIMIT, PIVOT_TABLE_ROW_LIMIT } from '../../constants';
import { countLeafNodes, pruneTreeByLeafLimit } from './utils';
import { useNotifications } from '../notifications';

interface PivotTableProps {
    vizThemeConfig?: IThemeKey | GWGlobalConfig;
    data: IRow[];
    draggableFieldState: DraggableFieldState;
    visualConfig: IVisualConfigNew;
    layout: IVisualLayout;
    disableCollapse?: boolean;
}

const PivotTable: React.FC<PivotTableProps> = function PivotTableComponent(props) {
    const { data, visualConfig, layout, draggableFieldState } = props;
    const computation = useCompututaion();
    const appRef = useAppRootContext();
    const [leftTree, setLeftTree] = useState<INestNode | null>(null);
    const [topTree, setTopTree] = useState<INestNode | null>(null);
    const [metricTable, setMetricTable] = useState<any[][]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const enableCollapse = !props.disableCollapse;
    const [tableCollapsedHeaderMap, setTableCollapsedHeaderMap] = useState<Record<string, INestNode['path']>>({});
    const updateTableCollapsedHeader = useCallback((node: INestNode) => {
        const { uniqueKey, height } = node;
        if (height < 1) return;
        setTableCollapsedHeaderMap((map) => {
            const updatedMap = { ...map };
            // if some child nodes of the incoming node are collapsed, remove them first
            Object.entries(updatedMap).forEach(([existingKey, existingPath]) => {
                if (existingKey.startsWith(uniqueKey) && existingKey.length > uniqueKey.length) {
                    delete updatedMap[existingKey];
                }
            });
            if (!updatedMap[uniqueKey]) {
                updatedMap[uniqueKey] = node.path;
            } else {
                delete updatedMap[uniqueKey];
            }
            return updatedMap;
        });
    }, []);
    const { rows, columns } = draggableFieldState;
    const { defaultAggregated, folds } = visualConfig;
    const { showTableSummary } = layout;
    const aggData = useRef<IRow[]>([]);
    const [topTreeHeaderRowNum, setTopTreeHeaderRowNum] = useState<number>(0);
    const { notify } = useNotifications();
    const lastNoticeRef = useRef<Record<string, string>>({});
    const { t } = useTranslation('translation', { keyPrefix: 'pivotTable' });
    
    // Track pending table generation to prevent parallel calls
    const pendingGenerationRef = useRef<{ cancel: boolean; id: number }>({ cancel: false, id: 0 });
    
    // Debounce timer for generateNewTable
    const generateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (Object.keys(tableCollapsedHeaderMap).length > 0) {
            // If some visual configs change, clear the collapse state
            // As tableCollapsedHeaderMap is also listened, data will be reaggregated later.
            setTableCollapsedHeaderMap({});
            // This forces data to be reaggregated if showTableSummary is on, as aggregation will be skipped later.
            if (showTableSummary) {
                aggregateGroupbyData();
            }
        } else {
            aggregateThenGenerate();
        }
    }, [data, enableCollapse]);

    useEffect(() => {
        if (!enableCollapse || showTableSummary) {
            // If showTableSummary is on, there is no need to generate extra queries. Directly generate new table.
            generateNewTable();
        } else {
            aggregateThenGenerate();
        }
    }, [enableCollapse, tableCollapsedHeaderMap]);

    useEffect(() => {
        aggregateThenGenerate();
    }, [showTableSummary]);

    const aggregateThenGenerate = async () => {
        await aggregateGroupbyData();
        generateNewTable();
    };

    const generateNewTableImmediate = () => {
        // Cancel any pending generation and create new generation ID
        pendingGenerationRef.current.cancel = true;
        const generationId = ++pendingGenerationRef.current.id;
        pendingGenerationRef.current = { cancel: false, id: generationId };
        
        const totalStartTime = performance.now();
        
        appRef.current?.updateRenderStatus('rendering');
        setIsLoading(true);
        const sort = getSort(draggableFieldState);
        const sortedEncoding = getSortedEncoding(draggableFieldState);
        
        if (PIVOT_TABLE_DEBUG) {
            console.log(`%c[PivotTable] generateNewTable executing (id: ${generationId})`, 'color: #e599f7');
        }
        
        const serviceCallStart = performance.now();
        
        buildPivotTableService(
            dimsInRow,
            dimsInColumn,
            data,
            aggData.current,
            Object.keys(tableCollapsedHeaderMap),
            showTableSummary,
            sort !== 'none' && sortedEncoding !== 'none'
                ? {
                      fid: sortedEncoding === 'column' ? `${measInRow[0].fid}_${measInRow[0].aggName}` : `${measInColumn[0].fid}_${measInColumn[0].aggName}`,
                      mode: sortedEncoding,
                      type: sort,
                  }
                : undefined
        )
            .then((result) => {
                const serviceCallTime = performance.now() - serviceCallStart;
                
                // Check if this generation was cancelled
                if (pendingGenerationRef.current.id !== generationId) {
                    if (PIVOT_TABLE_DEBUG) {
                        console.log(`%c[PivotTable] Result discarded (id: ${generationId}, current: ${pendingGenerationRef.current.id})`, 'color: #868e96');
                    }
                    return;
                }
                
                const postProcessStart = performance.now();
                
                const { lt, tt, metric } = result;
                
                // Count leaf nodes
                const countStart = performance.now();
                const leafColumnCount = countLeafNodes(tt);
                const measureColumnCount = measInColumn.length > 0 ? measInColumn.length : 1;
                const totalColumnCount = leafColumnCount * measureColumnCount;
                const leafRowCount = countLeafNodes(lt);
                const measureRowCount = measInRow.length > 0 ? measInRow.length : 1;
                const totalRowCount = leafRowCount * measureRowCount;
                const countTime = performance.now() - countStart;

                let nextLeftTree = lt;
                let nextTopTree = tt;
                let nextMetricTable = metric;
                
                let pruneColTime = 0;
                let pruneRowTime = 0;

                if (data.length >= PIVOT_TABLE_DEFAULT_LIMIT && PIVOT_TABLE_DEFAULT_LIMIT > 0) {
                    const message = t('dataTruncated', { limit: PIVOT_TABLE_DEFAULT_LIMIT });
                    if (lastNoticeRef.current.dataLimit !== message) {
                        notify('warning', message);
                        lastNoticeRef.current.dataLimit = message;
                    }
                }

                if (totalColumnCount > PIVOT_TABLE_COLUMN_LIMIT) {
                    const pruneColStart = performance.now();
                    const maxLeafColumns = Math.min(
                        leafColumnCount,
                        Math.max(1, Math.floor(PIVOT_TABLE_COLUMN_LIMIT / measureColumnCount))
                    );
                    const { tree: prunedTopTree } = pruneTreeByLeafLimit(tt, maxLeafColumns);
                    nextTopTree = prunedTopTree;
                    nextMetricTable = nextMetricTable.map((row) => row.slice(0, maxLeafColumns));
                    pruneColTime = performance.now() - pruneColStart;
                    const message = t('columnLimit', { limit: PIVOT_TABLE_COLUMN_LIMIT });
                    if (lastNoticeRef.current.columnLimit !== message) {
                        notify('warning', message);
                        lastNoticeRef.current.columnLimit = message;
                    }
                }

                if (totalRowCount > PIVOT_TABLE_ROW_LIMIT) {
                    const pruneRowStart = performance.now();
                    const maxLeafRows = Math.min(
                        leafRowCount,
                        Math.max(1, Math.floor(PIVOT_TABLE_ROW_LIMIT / measureRowCount))
                    );
                    const { tree: prunedLeftTree } = pruneTreeByLeafLimit(nextLeftTree, maxLeafRows);
                    nextLeftTree = prunedLeftTree;
                    nextMetricTable = nextMetricTable.slice(0, maxLeafRows);
                    pruneRowTime = performance.now() - pruneRowStart;
                    const message = t('rowLimit', { limit: PIVOT_TABLE_ROW_LIMIT });
                    if (lastNoticeRef.current.rowLimit !== message) {
                        notify('warning', message);
                        lastNoticeRef.current.rowLimit = message;
                    }
                }

                const postProcessTime = performance.now() - postProcessStart;
                
                if (PIVOT_TABLE_DEBUG) {
                    console.log('%c[PivotTable] Post-process details:', 'color: #ff922b');
                    console.log(`  countLeafNodes: ${countTime.toFixed(2)}ms (rows: ${leafRowCount.toLocaleString()}, cols: ${leafColumnCount.toLocaleString()})`);
                    if (pruneColTime > 0) {
                        console.log(`  pruneColumns: ${pruneColTime.toFixed(2)}ms`);
                    }
                    if (pruneRowTime > 0) {
                        console.log(`  pruneRows: ${pruneRowTime.toFixed(2)}ms`);
                    }
                    console.log(`  Total post-process: ${postProcessTime.toFixed(2)}ms`);
                }
                const stateUpdateStart = performance.now();

                unstable_batchedUpdates(() => {
                    setLeftTree(nextLeftTree);
                    setTopTree(nextTopTree);
                    setMetricTable(nextMetricTable);
                });
                
                const stateUpdateTime = performance.now() - stateUpdateStart;
                
                appRef.current?.updateRenderStatus('idle');
                setIsLoading(false);
                
                const totalTime = performance.now() - totalStartTime;
                
                if (PIVOT_TABLE_DEBUG) {
                    console.log('%c[PivotTable] Full cycle complete', 'color: #20c997; font-weight: bold');
                    console.log(`  ─────────────────────────────────`);
                    console.log(`  Service call: ${serviceCallTime.toFixed(2)}ms`);
                    console.log(`  Post-process (prune/count): ${postProcessTime.toFixed(2)}ms`);
                    console.log(`  State update (setState): ${stateUpdateTime.toFixed(2)}ms`);
                    console.log(`  ─────────────────────────────────`);
                    console.log(`  TOTAL (generateNewTable → state ready): ${totalTime.toFixed(2)}ms`);
                    console.log(`  Matrix: ${nextMetricTable.length} × ${nextMetricTable[0]?.length || 0}`);
                    
                    // Schedule a check after React render
                    requestAnimationFrame(() => {
                        const renderCompleteTime = performance.now() - totalStartTime;
                        console.log(`%c[PivotTable] First paint: ${renderCompleteTime.toFixed(2)}ms`, 'color: #20c997');
                    });
                }
            })
            .catch((err) => {
                appRef.current?.updateRenderStatus('error');
                console.log(err);
                setIsLoading(false);
            });
    };
    
    // Debounced version to prevent multiple rapid calls
    const generateNewTable = useCallback(() => {
        if (generateDebounceRef.current) {
            clearTimeout(generateDebounceRef.current);
        }
        
        if (PIVOT_TABLE_DEBUG) {
            console.log('%c[PivotTable] generateNewTable scheduled', 'color: #fab005');
        }
        
        // Use microtask-level debounce (0ms) to batch multiple calls in same tick
        generateDebounceRef.current = setTimeout(() => {
            generateDebounceRef.current = null;
            generateNewTableImmediate();
        }, 0);
    }, [generateNewTableImmediate]);

    const groupbyCombListRef = useRef<IViewField[][]>([]);

    const aggregateGroupbyData = () => {
        if (dimsInRow.length === 0 && dimsInColumn.length === 0) return;
        if (data.length === 0) return;
        let groupbyCombListInRow: IViewField[][] = [];
        let groupbyCombListInCol: IViewField[][] = [];
        if (showTableSummary) {
            groupbyCombListInRow = dimsInRow.map((dim, idx) => dimsInRow.slice(0, idx));
            groupbyCombListInCol = dimsInColumn.map((dim, idx) => dimsInColumn.slice(0, idx));
        } else {
            const collapsedDimList = Object.entries(tableCollapsedHeaderMap).map(([key, path]) => path[path.length - 1].key);
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
        if (
            groupbyCombListRef.current.length === groupbyCombList.length &&
            groupbyCombListRef.current.every(
                (x, i) => x.length === groupbyCombList[i].length && x.every((y, j) => getFieldIdentifier(y) === getFieldIdentifier(groupbyCombList[i][j]))
            )
        ) {
            return;
        }
        groupbyCombListRef.current = groupbyCombList;
        setIsLoading(true);
        appRef.current?.updateRenderStatus('computing');
        const groupbyPromises: Promise<IRow[]>[] = groupbyCombList.map((dimComb) => {
            const viewFilters = draggableFieldState.filters;
            const allFields = getAllFields(draggableFieldState);
            const viewFields = getViewEncodingFields(draggableFieldState, 'table');
            const viewMeasures = viewFields.filter((f) => f.analyticType === 'measure');
            const sort = getSort(draggableFieldState);
            const { limit } = visualConfig;
            const { timezoneDisplayOffset } = visualConfig;
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
            {isLoading && <LoadingLayer />}
            <div className="flex">
                <table className="border border-collapse">
                    <thead className="border">
                        {new Array(Math.max(topTreeHeaderRowNum - 1, 0)).fill(0).map((_, i) => (
                            <tr className="" key={i}>
                                <td
                                    className="bg-secondary text-secondary-foreground p-2 m-1 text-xs border"
                                    colSpan={dimsInRow.length + (measInRow.length > 0 ? 1 : 0)}
                                >
                                    _
                                </td>
                            </tr>
                        ))}
                        {topTreeHeaderRowNum > 0 && (
                            <tr className="">
                                {dimsInRow.map((x) => (
                                    <td className="bg-secondary text-secondary-foreground p-2 m-1 text-xs border whitespace-nowrap" colSpan={1}>
                                        {x.name}
                                    </td>
                                ))}
                                {measInRow.length > 0 && (
                                    <td className="bg-secondary text-secondary-foreground p-2 m-1 text-xs border" colSpan={1}>
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
                            onHeaderCollapse={(n) => updateTableCollapsedHeader(n)}
                            enableCollapse={enableCollapse}
                            displayOffset={visualConfig.timezoneDisplayOffset}
                        />
                    )}
                </table>
                <table className="border border-collapse">
                    {topTree && (
                        <TopTree
                            data={topTree}
                            dimsInCol={dimsInColumn}
                            measInCol={measInColumn}
                            onHeaderCollapse={(n) => updateTableCollapsedHeader(n)}
                            onTopTreeHeaderRowNumChange={(num) => setTopTreeHeaderRowNum(num)}
                            enableCollapse={enableCollapse}
                            displayOffset={visualConfig.timezoneDisplayOffset}
                        />
                    )}
                    {metricTable && (
                        <MetricTable matrix={metricTable} meaInColumns={measInColumn} meaInRows={measInRow} numberFormat={layout.format.numberFormat || ''} />
                    )}
                </table>
            </div>
        </div>
    );
};

export default PivotTable;
