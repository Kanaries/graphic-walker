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
    const commonStore = useGlobalStore();
    const { tmpDSRawFields, tmpDataSource } = commonStore;

    const metas = React.useMemo(() => toJS(tmpDSRawFields), [ tmpDSRawFields]);

    const computation = React.useMemo(() => getComputation(tmpDataSource), [tmpDataSource])

    return (
        <DataTable
            size={size}
            metas={metas}
            computation={computation}
            total={tmpDataSource.length}
            onMetaChange={(fid, fIndex, diffMeta) => {
                commonStore.updateTempDatasetMetas(fid, diffMeta);
            }}
        />
    );
};

export default observer(Table);
