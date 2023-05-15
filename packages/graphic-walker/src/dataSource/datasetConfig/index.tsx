import React, { useState, useEffect } from "react";
import DatasetTable from "../../components/dataTable";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";

const DatasetConfig: React.FC = (props) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { currentDataset } = commonStore;
    const { dataLoader } = vizStore;
    const [count, setCount] = useState(0);
    useEffect(() => {
        let isCurrent = true;
        const task = dataLoader.stat(currentDataset);
        task.then(d => {
            if (isCurrent) {
                setCount(d.count);
            }
        }).finally(() => {
            isCurrent = false;
        });
        return () => {
            setCount(0);
            isCurrent = false;
        };
    }, [currentDataset]);
    return (
        <div className="relative">
            <DatasetTable size={100}
                total={count}
                onMetaChange={(fid, fIndex, diffMeta) => {
                    commonStore.updateCurrentDatasetMetas(fid, diffMeta)
                }}
                dataset={currentDataset}
            />
        </div>
    );
};

export default observer(DatasetConfig);
