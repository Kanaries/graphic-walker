import React, { FC, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ShadowDom } from './shadow-dom';
import { GraphicWalker } from '.';
import type { IDataQueryWorkflowStep, IGWHandler, IMutField, IRow } from './interfaces';
import Toggle from './components/toggle';


const ServerStorageKey = 'debugger:server';
const DatasetIdStorageKey = 'debugger:datasetId';

const DebuggerApp: FC = () => {
    const [server, setServer] = useState(() => {
        const storedServer = localStorage.getItem(ServerStorageKey);
        return storedServer || 'http://localhost:2333';
    });

    useEffect(() => {
        localStorage.setItem(ServerStorageKey, server);
    }, [server]);

    const [datasetId, setDatasetId] = useState(() => {
        const storedDatasetId = localStorage.getItem(DatasetIdStorageKey);
        return storedDatasetId || 'csj7r83s8tmo';
    });

    const [dataset, setDataset] = useState<{
        id: string;
        data: IRow[];
        fields: IMutField[];
    } | null>(null);

    useEffect(() => {
        if (dataset) {
            localStorage.setItem(DatasetIdStorageKey, dataset.id);
        }
    }, [dataset]);

    const submitDatasetId = async () => {
        const response = await fetch(`${server.replace(/\/$/, '')}/api/ce/dataset/v2?datasetId=${datasetId}`, {
            method: 'GET',
            credentials: 'include',
        });
        const result = await response.json();
        const fullDataResponse = await fetch(`${server.replace(/\/$/, '')}/api/ce/dataset/v2/query`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                datasetId: result.data.id,
                query: {
                    workflow: [{
                        type: 'view',
                        query: [{
                            op: 'raw',
                            fields: ['*'],
                        }],
                    }],
                },
            }),
        });
        const { data: fullData } = await fullDataResponse.json();
        setDataset({
            id: result.data.id,
            data: fullData,
            fields: result.data.fieldsMeta.map(f => ({
                fid: f.fid,
                key: f.key,
                name: f.name,
                semanticType: f.semanticType,
                analyticType: f.semanticType === 'quantitative' ? 'measure' : 'dimension',
            })),
        });
    };

    const [serverComputation, setServerComputation] = useState(true);

    const [workflow, setWorkflow] = useState<IDataQueryWorkflowStep[]>([]);
    
    useEffect(() => {
        setWorkflow([]);
    }, [dataset]);

    const ref = useRef<IGWHandler>(null);

    useEffect(() => {
        const dispose = ref.current?.onRenderStatusChange((status, entry) => {
            setWorkflow(entry.workflow);
        });
        return dispose;
    }, []);

    return (
        <ShadowDom>
            <div className="p-8 grid grid-cols-4 gap-4">
                <div className="col-span-4 flex space-x-4 items-center">
                    <label
                        className="block text-sm font-medium text-gray-700 flex-none"
                        htmlFor="server"
                    >
                        Server
                    </label>
                    <div className="grow-[0.5] h-full">
                        <input
                            type="text"
                            name="debugger:server"
                            id="server"
                            className="shadow-sm h-full px-4 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="Enter server"
                            value={server}
                            onChange={(e) => setServer(e.target.value)}
                        />
                    </div>
                    <label
                        className="block text-sm font-medium text-gray-700 flex-none"
                        htmlFor="datasetId"
                    >
                        Dataset ID
                    </label>
                    <div className="flex-1 h-full">
                        <input
                            type="text"
                            name="debugger:datasetId"
                            id="datasetId"
                            className="shadow-sm h-full px-4 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="Enter dataset ID"
                            value={datasetId}
                            onChange={(e) => setDatasetId(e.target.value)}
                        />
                    </div>
                    {/* submit */}
                    <button
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                        onClick={submitDatasetId}
                    >
                        Import
                    </button>
                </div>
                <div>
                    <header className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">Debugger</h2>
                    </header>
                    <div className="mt-4">
                        <Toggle
                            enabled={serverComputation}
                            label="Server Computation"
                            onChange={setServerComputation}
                        />
                    </div>
                    <div className="mt-4">
                        <h3 className="text-sm font-medium text-gray-900">Workflow</h3>
                        <div className="mt-1">
                            <pre className="text-xs text-gray-500">{JSON.stringify(workflow, null, 2)}</pre>
                        </div>
                    </div>
                </div>
                <div className="col-span-3">
                    <GraphicWalker
                        themeKey="g2"
                        hideDataSourceConfig
                        datasetId={dataset?.id}
                        computation={serverComputation ? { mode: 'server', server } : undefined}
                        fieldKeyGuard={false}
                        dataSource={dataset?.data}
                        rawFields={dataset?.fields}
                        ref={ref}
                    />
                </div>
            </div>
        </ShadowDom>
    );
};

ReactDOM.render(
    <React.StrictMode>
        <DebuggerApp />
    </React.StrictMode>,
    document.getElementById('root') as HTMLElement
);