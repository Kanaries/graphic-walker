import { useState, useEffect, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import type { IDataQueryWorkflowStep, IRow, IViewField } from '../interfaces';
import { toWorkflow } from '../utils/workflow';
import type { IVisField, IVisSchema } from '../vis/protocol/interface';
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
        fields: IVisField[];
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
    const allFields = useMemo(() => {
        if (!fields) {
            console.warn('useRenderer error: prop `fields` is required for "client" mode, but none is found.');
            return [];
        }
        const res = [...fields];
        if (spec.computations?.length) {
            for (const computation of spec.computations) {
                if (res.find(f => f.fid === computation.field)) {
                    continue;
                }
                res.push({
                    fid: computation.field,
                    name: computation.name,
                    semanticType: computation.type,
                    analyticType: computation.type === 'quantitative' ? 'measure' : 'dimension',
                    computed: true,
                    expression: computation.expression,
                    aggName: computation.type === 'quantitative' ? 'sum' : undefined,
                });
            }
        }
        return res;
    }, [spec.computations, fields]);

    const [viewData, setViewData] = useState<IRow[]>([]);
    const [parsedWorkflow, setParsedWorkflow] = useState<IDataQueryWorkflowStep[]>([]);

    useEffect(() => {
        if (!data) {
            console.warn('useRenderer error: prop `data` is required for "client" mode, but none is found.');
            return;
        }
        const taskId = ++taskIdRef.current;
        setComputing(true);
        dataQueryClient(data, allFields, workflow).then(data => {
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
    }, [data, allFields, workflow]);

    const parseResult = useMemo<UseRendererResult['parsed']>(() => {
        return {
            workflow: parsedWorkflow,
            fields: allFields.map<IVisField>(f => ({
                key: f.fid,
                name: f.name,
                type: f.semanticType,
                expression: f.expression,
            })),
        };
    }, [parsedWorkflow, allFields]);

    return useMemo(() => {
        return {
            viewData,
            loading: computing,
            parsed: parseResult,
        };
    }, [viewData, computing, parseResult]);
};
