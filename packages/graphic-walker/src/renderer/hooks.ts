import { useState, useEffect, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { type IDataQueryWorkflowStep, type IRow, type DeepReadonly, type IFilterField, type IViewField, type IComputationConfig, type IComputationOptions } from '../interfaces';
import { useGlobalStore } from '../store';
import { useAppRootContext } from '../components/appRoot';
import { toWorkflow } from '../utils/workflow';
import { dataQueryClient } from '../computation/clientComputation';
import { dataQueryServer } from '../computation/serverComputation';


export const getComputationConfig = (config: IComputationConfig): IComputationOptions => {
    if (typeof config === 'string') {
        return {
            mode: config,
        };
    }
    return config;
};

export const useComputationConfig = (): IComputationOptions => {
    const { vizStore } = useGlobalStore();
    const { computationConfig } = vizStore;
    return getComputationConfig(computationConfig);
};

interface UseRendererProps {
    data?: IRow[];
    allFields: Omit<IViewField, 'dragId'>[];
    viewDimensions: IViewField[];
    viewMeasures: IViewField[];
    filters: readonly DeepReadonly<IFilterField>[];
    defaultAggregated: boolean;
    datasetId?: string;
    computationConfig: IComputationConfig;
}

interface UseRendererResult {
    viewData: IRow[];
    loading: boolean;
    parsed: {
        workflow: IDataQueryWorkflowStep[];
    };
}

export const useRenderer = (props: UseRendererProps): UseRendererResult => {
    const { data, allFields, viewDimensions, viewMeasures, filters, defaultAggregated, computationConfig: _computationConfig, datasetId } = props;
    const computationConfig = getComputationConfig(_computationConfig);
    const { mode: computationMode } = computationConfig;
    const [computing, setComputing] = useState(false);
    const taskIdRef = useRef(0);

    const workflow = useMemo(() => {
        return toWorkflow(filters, allFields, viewDimensions, viewMeasures, defaultAggregated);
    }, [filters, allFields, viewDimensions, viewMeasures, defaultAggregated]);

    const [viewData, setViewData] = useState<IRow[]>([]);
    const [parsedWorkflow, setParsedWorkflow] = useState<IDataQueryWorkflowStep[]>([]);

    const appRef = useAppRootContext();

    useEffect(() => {
        if (computationMode !== 'client') {
            return;
        }
        if (!data) {
            console.warn('useRenderer error: prop `data` is required for "client" mode, but none is found.');
            return;
        }
        if (!allFields) {
            console.warn('useRenderer error: prop `fields` is required for "client" mode, but none is found.');
            return;
        }
        const taskId = ++taskIdRef.current;
        appRef.current?.updateRenderStatus('computing');
        setComputing(true);
        dataQueryClient(data, allFields, workflow).then(data => {
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
        return () => {
            taskIdRef.current++;
        };
    }, [computationMode, data, allFields, workflow]);

    useEffect(() => {
        if (computationMode !== 'server') {
            return;
        }
        if (!datasetId) {
            console.warn('useRenderer error: prop `datasetId` is required for "server" mode, but none is found.');
            return;
        }
        const taskId = ++taskIdRef.current;
        appRef.current?.updateRenderStatus('computing');
        setComputing(true);
        dataQueryServer(computationConfig, datasetId, workflow).then(data => {
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
    }, [computationMode, computationConfig, workflow, datasetId]);

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
