import { useState, useEffect, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import type { IDataQueryWorkflowStep, IRow, IViewField } from '../interfaces';
import { toWorkflow } from '../utils/workflow';
import type { IVisSchema } from '../vis/protocol/interface';
import { dataQueryClient } from './webWorkerComputation';


interface UseRendererProps {
    spec: IVisSchema;
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
    const { spec, data, fields, datasetId } = props;
    const [computing, setComputing] = useState(false);
    const taskIdRef = useRef(0);

    const workflow = useMemo(() => {
        return toWorkflow(spec);
    }, [spec]);

    const [viewData, setViewData] = useState<IRow[]>([]);
    const [parsedWorkflow, setParsedWorkflow] = useState<IDataQueryWorkflowStep[]>([]);

    useEffect(() => {
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
    }, [data, fields, workflow]);

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
