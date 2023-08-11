import React, { useEffect, useRef, useState } from "react";
import DatasetTable from "../../components/dataTable";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import { useComputationFunc } from "../../renderer/hooks";
import { datasetStatsServer } from "../../computation/serverComputation";

const DatasetConfig: React.FC = () => {
    const { commonStore } = useGlobalStore();
    const { currentDataset } = commonStore;

    const computationFunction = useComputationFunc();

    const [count, setCount] = useState(0);
    const taskIdRef = useRef(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const taskId = ++taskIdRef.current;
        setLoading(true);
        datasetStatsServer(computationFunction).then(res => {
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
    }, [computationFunction]);

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
