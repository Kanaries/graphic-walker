import { useState, useEffect, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { toWorkflow } from '../utils/workflow';
import type { IVisSchema } from '../vis/protocol/interface';
import type { IGWDataLoader } from '../dataLoader';
import type { IDataQueryWorkflowStep, IRow } from '../interfaces';


interface UseRendererProps {
    spec: IVisSchema;
    dataLoader: IGWDataLoader;
}

interface UseRendererResult {
    viewData: IRow[];
    loading: boolean;
    parsed: {
        workflow: IDataQueryWorkflowStep[];
    };
}

export const useRenderer = (props: UseRendererProps): UseRendererResult => {
    const { spec, dataLoader } = props;
    const [computing, setComputing] = useState(false);

    const workflow = useMemo(() => {
        return toWorkflow(spec);
    }, [spec]);

    const [viewData, setViewData] = useState<IRow[]>([]);
    const [parsedWorkflow, setParsedWorkflow] = useState<IDataQueryWorkflowStep[]>([]);

    useEffect(() => {
        setComputing(true);
        dataLoader.query({ workflow }).then(data => {
            unstable_batchedUpdates(() => {
                setComputing(false);
                setViewData(data);
                setParsedWorkflow(workflow);
            });
        }).catch((err) => {
            console.error(err);
            unstable_batchedUpdates(() => {
                setComputing(false);
                setViewData([]);
                setParsedWorkflow([]);
            });
        });
    }, [dataLoader, workflow]);

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
