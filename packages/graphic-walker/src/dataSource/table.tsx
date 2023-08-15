import React from "react";
import { observer } from "mobx-react-lite";
import { useGlobalStore } from "../store";
import DataTable from "../components/dataTable";
import { toJS } from "mobx";
import { getComputation } from "../computation/clientComputation";

interface TableProps {
    size?: number;
}

const Table: React.FC<TableProps> = (props) => {
    const { size = 10 } = props;
    const { commonStore } = useGlobalStore();
    const { tmpDSRawFields, tmpDataSource } = commonStore;

    const computation = React.useMemo(() => getComputation(tmpDataSource, tmpDSRawFields), [tmpDataSource, tmpDSRawFields])

    return (
        <DataTable
            size={size}
            dataset={{
                id: "tmp",
                name: "tmp",
                dataSource: tmpDataSource,
                rawFields: toJS(tmpDSRawFields),
            }}
            computation={computation}
            total={tmpDataSource.length}
            onMetaChange={(fid, fIndex, diffMeta) => {
                commonStore.updateTempDatasetMetas(fid, diffMeta);
            }}
        />
    );
};

export default observer(Table);
