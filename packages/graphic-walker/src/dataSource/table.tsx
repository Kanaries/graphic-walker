import React from 'react';
import { observer } from 'mobx-react-lite';
import DataTable from '../components/dataTable';
import { toJS } from 'mobx';
import { getComputation } from '../computation/clientComputation';
import { CommonStore } from '../store/commonStore';

interface TableProps {
    size?: number;
    commonStore: CommonStore;
}

const Table: React.FC<TableProps> = ({ commonStore, size = 10 }) => {
    const { tmpDSRawFields, tmpDataSource } = commonStore;

    const metas = toJS(tmpDSRawFields);

    const computation = React.useMemo(() => getComputation(tmpDataSource), [tmpDataSource]);

    return (
        <div className="rounded border-gray-200 dark:border-gray-700 border">
            <DataTable
                size={size}
                metas={metas}
                computation={computation}
                onMetaChange={(fid, fIndex, diffMeta) => {
                    commonStore.updateTempDatasetMetas(fid, diffMeta);
                }}
            />
        </div>
    );
};

export default observer(Table);
