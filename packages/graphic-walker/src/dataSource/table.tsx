import React, { useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../store";
import DataTable from "../components/dataTable";
import { toJS } from "mobx";

interface TableProps {
    size?: number;
}

const Table: React.FC<TableProps> = (props) => {
    const { size = 10 } = props;
    const { commonStore } = useGlobalStore();
    const { tmpDSRawFields, tmpDataSource } = commonStore;

    const tempDataset = useMemo(() => {
        return {
            id: "tmp",
            name: "tmp",
            dataSource: tmpDataSource,
            rawFields: toJS(tmpDSRawFields),
        };
    }, [tmpDataSource, tmpDSRawFields]);

    return (
        <DataTable
            size={size}
            onMetaChange={(fid, fIndex, diffMeta) => {
                commonStore.updateTempDatasetMetas(fid, diffMeta);
            }}
            dataset={tempDataset}
            total={tmpDataSource.length}
            inMemory
        />
    );
};

export default observer(Table);
