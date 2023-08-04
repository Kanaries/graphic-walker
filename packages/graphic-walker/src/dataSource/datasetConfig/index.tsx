import React, { useEffect, useRef, useState } from "react";
import DatasetTable from "../../components/dataTable";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import { useComputationConfig } from "../../renderer/hooks";
import { datasetStatsClient } from "../../computation/clientComputation";
import { datasetStatsServer } from "../../computation/serverComputation";

const DatasetConfig: React.FC = () => {
    const { commonStore } = useGlobalStore();
    const { currentDataset } = commonStore;
    const { dataSource, id: datasetId } = currentDataset;

    const computationConfig = useComputationConfig();
    const computationMode = computationConfig.mode;

    const [count, setCount] = useState(0);
    const taskIdRef = useRef(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (computationMode !== 'client') {
            return;
        }
        const taskId = ++taskIdRef.current;
        setLoading(true);
        datasetStatsClient(dataSource).then(res => {
            if (taskId !== taskIdRef.current) {
                return;
            }
            setCount(res.rowCount);
            setLoading(false);
        }).catch(err => {
            if (taskId !== taskIdRef.current) {
                return;
            }
            console.error(err);
            setLoading(false);
        });
        return () => {
            taskIdRef.current++;
        };
    }, [computationMode, dataSource]);

    useEffect(() => {
        if (computationMode !== 'server') {
            return;
        }
        const taskId = ++taskIdRef.current;
        setLoading(true);
        datasetStatsServer(computationConfig, datasetId).then(res => {
            if (taskId !== taskIdRef.current) {
                return;
            }
            setCount(res.rowCount);
            setLoading(false);
        }).catch(err => {
            if (taskId !== taskIdRef.current) {
                return;
            }
            console.error(err);
            setLoading(false);
        });
        return () => {
            taskIdRef.current++;
        };
    }, [computationMode, computationConfig, datasetId]);

    return (
        <div className="relative">
            <DatasetTable size={100}
                total={count}
                dataset={currentDataset}
                loading={loading}
                onMetaChange={(fid, fIndex, diffMeta) => {
                    commonStore.updateCurrentDatasetMetas(fid, diffMeta)
                }}
            />
        </div>
    );
};

export default observer(DatasetConfig);
