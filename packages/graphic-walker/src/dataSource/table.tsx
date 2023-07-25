import React from "react";
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

    const tempDataset = React.useMemo(() => {
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
            dataset={tempDataset}
            total={tmpDataSource.length}
            onMetaChange={(fid, fIndex, diffMeta) => {
                commonStore.updateTempDatasetMetas(fid, diffMeta);
            }}
        />
    );
};

export default observer(Table);
