import React, { useEffect } from "react";
import DatasetTable from "../../components/dataTable";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";
import type { IGWDataLoader } from "../../dataLoader";

const DatasetConfig: React.FC<{ dataLoader: IGWDataLoader }> = ({ dataLoader }) => {
    const { commonStore } = useGlobalStore();
    const { currentDataset } = commonStore;
    const { dataSource } = currentDataset;
    const [{ count }] = dataLoader.useStat();
    useEffect(() => {
        dataLoader.syncData(dataSource);
    }, [dataLoader, dataSource]);
    return (
        <div className="relative">
            <DatasetTable size={100}
                total={count}
                onMetaChange={(fid, fIndex, diffMeta) => {
                    commonStore.updateCurrentDatasetMetas(fid, diffMeta)
                }}
                dataset={currentDataset}
                dataLoader={dataLoader}
            />
        </div>
    );
};

export default observer(DatasetConfig);
