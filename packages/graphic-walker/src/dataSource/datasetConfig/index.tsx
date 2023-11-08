import React from 'react';
import DatasetTable from '../../components/dataTable';
import { observer } from 'mobx-react-lite';
import { useCompututaion, useVizStore } from '../../store';
import { toJS } from 'mobx';

const DatasetConfig: React.FC = () => {
    const vizStore = useVizStore();
    const computation = useCompututaion();
    const metas = React.useMemo(() => toJS(vizStore.meta), [vizStore.meta]);

    return (
        <div className="relative">
            <DatasetTable
                size={100}
                metas={metas}
                computation={computation}
                onMetaChange={(fid, fIndex, diffMeta) => {
                    vizStore.updateCurrentDatasetMetas(fid, diffMeta);
                }}
            />
        </div>
    );
};

export default observer(DatasetConfig);
