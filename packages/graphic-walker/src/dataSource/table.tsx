import React from 'react';
import { observer } from 'mobx-react-lite';
import { useGlobalStore } from '../store';
import DataTable from '../components/dataTable';
import { toJS } from 'mobx';
import { getComputation } from '../computation/clientComputation';

interface TableProps {
    size?: number;
}

const Table: React.FC<TableProps> = (props) => {
    const { size = 10 } = props;
    const commonStore = useGlobalStore();
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
