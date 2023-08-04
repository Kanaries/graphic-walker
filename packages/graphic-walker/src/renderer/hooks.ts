import { useState, useEffect, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import type { DeepReadonly, IFilterField, IRow, IViewField } from '../interfaces';
import { applyFilter, applySort, applyViewQuery, transformDataService } from '../services';
import { getMeaAggKey } from '../utils';
import { useAppRootContext } from '../components/appRoot';
import { useDebounceValue } from '../hooks';

interface UseRendererProps {
    data: IRow[];
    allFields: Omit<IViewField, 'dragId'>[];
    viewDimensions: IViewField[];
    viewMeasures: IViewField[];
    filters: readonly DeepReadonly<IFilterField>[];
    defaultAggregated: boolean;
    sort: 'none' | 'ascending' | 'descending';
    limit: number;
}

interface UseRendererResult {
    viewData: IRow[];
    loading: boolean;
}

export const useRenderer = (props: UseRendererProps): UseRendererResult => {
    const {
        data,
        allFields,
        viewDimensions,
        viewMeasures,
        filters,
        defaultAggregated,
        sort,
        limit: storeLimit,
    } = props;
    const [computing, setComputing] = useState(false);
    const taskIdRef = useRef(0);

    const limit = useDebounceValue(storeLimit);

    const [viewData, setViewData] = useState<IRow[]>([]);

    const appRef = useAppRootContext();

    useEffect(() => {
        const taskId = ++taskIdRef.current;
        appRef.current?.updateRenderStatus('computing');
        setComputing(true);
        applyFilter(data, filters)
            .then((data) => {
                if (viewDimensions.length === 0 && viewMeasures.length === 0) {
                    return data;
                }
                return transformDataService(data, allFields);
            })
            .then((d) => {
                if (viewDimensions.length === 0 && viewMeasures.length === 0) {
                    return data;
                }
                // setViewData(d);
                const dims = viewDimensions;
                const meas = viewMeasures;
                return applyViewQuery(d, dims.concat(meas), {
                    op: defaultAggregated ? 'aggregate' : 'raw',
                    groupBy: dims.map((f) => f.fid),
                    measures: meas.map((f) => ({
                        field: f.fid,
                        agg: f.aggName as any,
                        asFieldKey: getMeaAggKey(f.fid, f.aggName!),
                    })),
                });
            })
            .then((data) => {
                if (limit > 0 && sort !== 'none' && viewMeasures.length > 0) {
                    return applySort(data, viewMeasures, sort);
                }
                return data;
            })
            .then((data) => {
                if (limit > 0) {
                    return data.slice(0, limit);
                }
                return data;
            })
            .then((data) => {
                if (taskId !== taskIdRef.current) {
                    return;
                }
                appRef.current?.updateRenderStatus('rendering');
                unstable_batchedUpdates(() => {
                    setComputing(false);
                    setViewData(data);
                });
            })
            .catch((err) => {
                if (taskId !== taskIdRef.current) {
                    return;
                }
                appRef.current?.updateRenderStatus('error');
                console.error(err);
                unstable_batchedUpdates(() => {
                    setComputing(false);
                    setViewData([]);
                });
            });
        return () => {
            taskIdRef.current++;
        };
    }, [data, filters, viewDimensions, viewMeasures, defaultAggregated, limit]);

    return useMemo(() => {
        return {
            viewData,
            loading: computing,
        };
    }, [viewData, computing]);
};
