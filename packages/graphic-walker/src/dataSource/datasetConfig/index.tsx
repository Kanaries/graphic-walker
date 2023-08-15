import React, { useContext, useEffect, useRef, useState } from 'react';
import DatasetTable from '../../components/dataTable';
import { observer } from 'mobx-react-lite';
import { ComputationContext, useVizStore } from '../../store';
import { datasetStats } from '../../computation';

const DatasetConfig: React.FC = () => {
    const vizStore = useVizStore();
    const computation = useContext(ComputationContext);

    const [count, setCount] = useState(0);
    const taskIdRef = useRef(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const taskId = ++taskIdRef.current;
        setLoading(true);
        datasetStats(computation)
            .then((res) => {
                if (taskId !== taskIdRef.current) {
                    return;
                }
                setCount(res.rowCount);
                setLoading(false);
            })
            .catch((err) => {
                if (taskId !== taskIdRef.current) {
                    return;
                }
                console.error(err);
                setLoading(false);
            });
        return () => {
            taskIdRef.current++;
        };
    }, [computation]);

    return (
        <div className="relative">
            <DatasetTable
                size={100}
                total={count}
                metas={vizStore.meta}
                loading={loading}
                computation={computation}
                onMetaChange={(fid, fIndex, diffMeta) => {
                    vizStore.updateCurrentDatasetMetas(fid, diffMeta);
                }}
            />
        </div>
    );
};

export default observer(DatasetConfig);
