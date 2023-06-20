import { useState, useEffect, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import type { DeepReadonly, IFilterField, IRow, IViewField } from '../interfaces';
import { applyFilter, applyViewQuery, transformDataService } from '../services';
import { getMeaAggKey } from '../utils';


interface UseRendererProps {
    data: IRow[];
    allFields: Omit<IViewField, 'dragId'>[];
    viewDimensions: IViewField[];
    viewMeasures: IViewField[];
    filters: readonly DeepReadonly<IFilterField>[];
    defaultAggregated: boolean;
}

interface UseRendererResult {
    viewData: IRow[];
    loading: boolean;
}

export const useRenderer = (props: UseRendererProps): UseRendererResult => {
    const { data, allFields, viewDimensions, viewMeasures, filters, defaultAggregated } = props;
    const [computing, setComputing] = useState(false);
    const taskIdRef = useRef(0);

    const [viewData, setViewData] = useState<IRow[]>([]);

    useEffect(() => {
        const taskId = ++taskIdRef.current;
        setComputing(true);
        applyFilter(data, filters)
            .then((data) => transformDataService(data, allFields))
            .then((d) => {
                // setViewData(d);
                const dims = viewDimensions;
                const meas = viewMeasures;
                return applyViewQuery(d, dims.concat(meas), {
                    op: defaultAggregated ? 'aggregate' : 'raw',
                    groupBy: dims.map((f) => f.fid),
                    measures: meas.map((f) => ({ field: f.fid, agg: f.aggName as any, asFieldKey: getMeaAggKey(f.fid, f.aggName!) })),
                });
            })
            .then(data => {
                if (taskId !== taskIdRef.current) {
                    return;
                }
                unstable_batchedUpdates(() => {
                    setComputing(false);
                    setViewData(data);
                });
            }).catch((err) => {
                if (taskId !== taskIdRef.current) {
                    return;
                }
                console.error(err);
                unstable_batchedUpdates(() => {
                    setComputing(false);
                    setViewData([]);
                });
            });
        return () => {
            taskIdRef.current++;
        };
    }, [data, filters, viewDimensions, viewMeasures, defaultAggregated]);

    return useMemo(() => {
        return {
            viewData,
            loading: computing,
        };
    }, [viewData, computing]);
};
