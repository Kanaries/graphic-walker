import { useState, useEffect, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import type { IDataQueryWorkflowStep, IRow, IViewField, IComputationConfig, IComputationMode } from '../interfaces';
import { useGlobalStore } from '../store';
import { toWorkflow } from '../utils/workflow';
import type { IVisSchema } from '../vis/protocol/interface';
import { dataQueryClient } from './webWorkerComputation';
import { dataQueryHttp } from './httpComputation';


export const useComputationConfig = (): Exclude<IComputationConfig, string> => {
    const { vizStore } = useGlobalStore();
    const { computationConfig } = vizStore;
    if (typeof computationConfig === 'string') {
        return {
            mode: computationConfig,
        };
    }
    return vizStore.computationConfig as Exclude<IComputationConfig, string>;
};

const useComputationMode = (computationConfig: IComputationConfig): IComputationMode => {
    if (typeof computationConfig === 'string') {
        return computationConfig;
    }
    return computationConfig.mode;
};

interface UseRendererProps {
    spec: IVisSchema;
    computationConfig: IComputationConfig;
    data?: IRow[];
    fields?: Omit<IViewField, 'dragId'>[];
    datasetId?: string;
}

interface UseRendererResult {
    viewData: IRow[];
    loading: boolean;
    parsed: {
        workflow: IDataQueryWorkflowStep[];
    };
}

export const useRenderer = (props: UseRendererProps): UseRendererResult => {
    const { spec, computationConfig, data, fields, datasetId } = props;
    const computationMode = useComputationMode(computationConfig);
    const host = typeof computationConfig === 'object' && computationConfig.mode === 'server' ? computationConfig.host : undefined;
    const [computing, setComputing] = useState(false);
    const taskIdRef = useRef(0);

    const workflow = useMemo(() => {
        return toWorkflow(spec);
    }, [spec]);

    const [viewData, setViewData] = useState<IRow[]>([]);
    const [parsedWorkflow, setParsedWorkflow] = useState<IDataQueryWorkflowStep[]>([]);

    useEffect(() => {
        if (computationMode !== 'client') {
            return;
        }
        if (!data) {
            console.warn('useRenderer error: prop `data` is required for "client" mode, but none is found.');
            return;
        }
        if (!fields) {
            console.warn('useRenderer error: prop `fields` is required for "client" mode, but none is found.');
            return;
        }
        const taskId = ++taskIdRef.current;
        setComputing(true);
        dataQueryClient(data, fields, workflow).then(data => {
            if (taskId !== taskIdRef.current) {
                return;
            }
            unstable_batchedUpdates(() => {
                setComputing(false);
                setViewData(data);
                setParsedWorkflow(workflow);
            });
        }).catch((err) => {
            if (taskId !== taskIdRef.current) {
                return;
            }
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
    }, [computationMode, data, fields, workflow]);

    useEffect(() => {
        if (computationMode !== 'server') {
            return;
        }
        if (!datasetId) {
            console.warn('useRenderer error: prop `datasetId` is required for "server" mode, but none is found.');
            return;
        }
        const taskId = ++taskIdRef.current;
        setComputing(true);
        dataQueryHttp(host, datasetId, workflow).then(data => {
            if (taskId !== taskIdRef.current) {
                return;
            }
            unstable_batchedUpdates(() => {
                setComputing(false);
                setViewData(data);
                setParsedWorkflow(workflow);
            });
        }).catch((err) => {
            if (taskId !== taskIdRef.current) {
                return;
            }
            console.error(err);
            unstable_batchedUpdates(() => {
                setComputing(false);
                setViewData([]);
                setParsedWorkflow([]);
            });
        });
    }, [computationMode, host, workflow, datasetId]);

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
    }, [viewData, computing, parseResult]);
};
