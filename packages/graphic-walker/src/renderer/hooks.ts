import { useState, useEffect, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import type { DeepReadonly, IFilterField, IRow, IViewField, IDataQueryWorkflowStep, IComputationFunction } from '../interfaces';
import { useGlobalStore } from '../store';
import { useAppRootContext } from '../components/appRoot';
import { toWorkflow } from '../utils/workflow';
import { dataQueryServer } from '../computation/serverComputation';
import { fold2 } from '../lib/op/fold';

export const useComputationFunc = (): IComputationFunction => {
    const { vizStore } = useGlobalStore();
    return vizStore.computationFunction;
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
    folds?: string[];
}

interface UseRendererResult {
    viewData: IRow[];
    loading: boolean;
    parsed: {
        workflow: IDataQueryWorkflowStep[];
    };
}

export const useRenderer = (props: UseRendererProps): UseRendererResult => {
    const { allFields, viewDimensions, viewMeasures, filters, defaultAggregated, sort, limit, computationFunction, folds } = props;
    const [computing, setComputing] = useState(false);
    const taskIdRef = useRef(0);

    const workflow = useMemo(() => {
        return toWorkflow(filters, allFields, viewDimensions, viewMeasures, defaultAggregated, sort, folds, limit > 0 ? limit : undefined);
    }, [filters, allFields, viewDimensions, viewMeasures, defaultAggregated, sort, limit]);

    const [viewData, setViewData] = useState<IRow[]>([]);
    const [parsedWorkflow, setParsedWorkflow] = useState<IDataQueryWorkflowStep[]>([]);

    const appRef = useAppRootContext();

    useEffect(() => {
        const taskId = ++taskIdRef.current;
        appRef.current?.updateRenderStatus('computing');
        setComputing(true);
        dataQueryServer(computationFunction, workflow, limit > 0 ? limit : undefined)
            .then((res) => fold2(res, defaultAggregated, allFields, viewMeasures, viewDimensions, folds))
            .then((data) => {
                if (taskId !== taskIdRef.current) {
                    return;
                }
                appRef.current?.updateRenderStatus('rendering');
                unstable_batchedUpdates(() => {
                    setComputing(false);
                    setViewData(data);
                    setParsedWorkflow(workflow);
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
