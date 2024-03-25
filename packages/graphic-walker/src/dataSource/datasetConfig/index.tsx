import React, { useContext, useState } from 'react';
import DatasetTable from '../../components/dataTable';
import { observer } from 'mobx-react-lite';
import { DatasetNamesContext, useCompututaion, useVizStore } from '../../store';
import { DEFAULT_DATASET } from '@/constants';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getFieldIdentifier } from '@/utils';

const DatasetConfig: React.FC = () => {
    const vizStore = useVizStore();
    const computation = useCompututaion();
    const metas = vizStore.meta;
    const datasets = Array.from(new Set(metas.map((x) => x.dataset ?? DEFAULT_DATASET)));
    const [dataset, setDataset] = useState(datasets[0] ?? DEFAULT_DATASET);
    const datasetNames = useContext(DatasetNamesContext);
    const tableMeta = metas.filter((x) => dataset === (x.dataset ?? DEFAULT_DATASET));

    return (
        <div className="relative">
            {datasets.length > 1 && (
                <Tabs value={dataset} onValueChange={setDataset}>
                    <TabsList>
                        {datasets.map((ds) => (
                            <TabsTrigger value={ds}>{datasetNames?.[ds] ?? ds}</TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            )}

            <DatasetTable
                size={100}
                metas={tableMeta}
                computation={computation}
                displayOffset={vizStore.config.timezoneDisplayOffset}
                onMetaChange={(fid, fIndex, diffMeta) => {
                    vizStore.updateCurrentDatasetMetas(getFieldIdentifier(tableMeta[fIndex]), diffMeta);
                }}
            />
        </div>
    );
};

export default observer(DatasetConfig);
