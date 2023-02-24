import React from "react";
import DatasetTable from "../../components/dataTable";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../../store";

const DatasetConfig: React.FC = (props) => {
    const { commonStore, vizStore } = useGlobalStore();
    const { currentDataset } = commonStore;
    const { dataSource, rawFields } = currentDataset;
    return (
        <div>
            <DatasetTable size={100} data={dataSource} metas={rawFields}
                onMetaChange={(fid, fIndex, diffMeta) => {
                    commonStore.updateCurrentDatasetMetas(fid, diffMeta)
                }}
            />
        </div>
    );
};

export default observer(DatasetConfig);
