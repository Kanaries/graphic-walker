import { useState, useEffect, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import type { DeepReadonly, IFilterField, IRow, IViewField, IDataQueryWorkflowStep, IComputationFunction } from '../interfaces';
import { useGlobalStore } from '../store';
import { useAppRootContext } from '../components/appRoot';
import { toWorkflow } from '../utils/workflow';
import { dataQueryClient } from '../computation/clientComputation';
import { dataQueryServer } from '../computation/serverComputation';
import { useDebounceValue } from '../hooks';

export const useComputationFunc = (): IComputationFunction => {
    const { vizStore } = useGlobalStore();
    return vizStore.computationFuction;
};

interface UseRendererProps {
    allFields: Omit<IViewField, 'dragId'>[];
    viewDimensions: Omit<IViewField, 'dragId'>[];
    viewMeasures: Omit<IViewField, 'dragId'>[];
    filters: readonly DeepReadonly<IFilterField>[];
    defaultAggregated: boolean;
    sort: 'none' | 'ascending' | 'descending';
    limit: number;
    computationFunction: IComputationFunction;
}

interface UseRendererResult {
    viewData: IRow[];
    loading: boolean;
    parsed: {
        workflow: IDataQueryWorkflowStep[];
    };
}

export const useRenderer = (props: UseRendererProps): UseRendererResult => {
    const {
        allFields,
        viewDimensions,
        viewMeasures,
        filters,
        defaultAggregated,
        sort,
        limit: storeLimit,
        computationFunction,
    } = props;
    const [computing, setComputing] = useState(false);
    const taskIdRef = useRef(0);

    const limit = useDebounceValue(storeLimit);

    const workflow = useMemo(() => {
        return toWorkflow(
            filters,
            allFields,
            viewDimensions,
            viewMeasures,
            defaultAggregated,
            sort,
            limit > 0 ? limit : undefined
        );
    }, [filters, allFields, viewDimensions, viewMeasures, defaultAggregated, sort, limit]);

    const [viewData, setViewData] = useState<IRow[]>([]);
    const [parsedWorkflow, setParsedWorkflow] = useState<IDataQueryWorkflowStep[]>([]);

    const appRef = useAppRootContext();

    // useEffect(() => {
    //     if (computationMode !== 'client') {
    //         return;
    //     }
    //     if (!data) {
    //         console.warn('useRenderer error: prop `data` is required for "client" mode, but none is found.');
    //         return;
    //     }
    //     if (!allFields) {
    //         console.warn('useRenderer error: prop `fields` is required for "client" mode, but none is found.');
    //         return;
    //     }
    //     const taskId = ++taskIdRef.current;
    //     appRef.current?.updateRenderStatus('computing');
    //     setComputing(true);
    //     dataQueryClient(data, allFields, workflow).then(data => {
    //         if (taskId !== taskIdRef.current) {
    //             return;
    //         }
    //         appRef.current?.updateRenderStatus('rendering');
    //         unstable_batchedUpdates(() => {
    //             setComputing(false);
    //             setViewData(data);
    //             setParsedWorkflow(workflow);
    //         });
    //     }).catch((err) => {
    //         if (taskId !== taskIdRef.current) {
    //             return;
    //         }
    //         appRef.current?.updateRenderStatus('error');
    //         console.error(err);
    //         unstable_batchedUpdates(() => {
    //             setComputing(false);
    //             setViewData([]);
    //             setParsedWorkflow([]);
    //         });
    //     });
    //     return () => {
    //         taskIdRef.current++;
    //     };
    // }, [computationMode, data, allFields, workflow]);

    useEffect(() => {
        const taskId = ++taskIdRef.current;
        appRef.current?.updateRenderStatus('computing');
        setComputing(true);
        dataQueryServer(computationFunction, workflow, limit > 0 ? limit : undefined).then(data => {
            if (taskId !== taskIdRef.current) {
                return;
            }
            appRef.current?.updateRenderStatus('rendering');
            unstable_batchedUpdates(() => {
                setComputing(false);
                setViewData(data);
                setParsedWorkflow(workflow);
            });
        }).catch((err) => {
            if (taskId !== taskIdRef.current) {
                return;
            }
            appRef.current?.updateRenderStatus('error');
            console.error(err);
            unstable_batchedUpdates(() => {
                setComputing(false);
                setViewData([]);
                setParsedWorkflow([]);
            });
        });
    }, [computationFunction, workflow]);

    const parseResult = useMemo(() => {
        return {
            workflow: parsedWorkflow,
        };
    }, [parsedWorkflow]);

    return useMemo(() => {
        return {
            viewData,
            loading: computing,
            parsed: parseResult,
        };
    }, [viewData, computing]);
};
