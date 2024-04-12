import { observer } from 'mobx-react-lite';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../ui/dialog';
import React, { useContext, useMemo, useState } from 'react';
import { ComputationContext, DatasetNamesContext, useVizStore } from '@/store';
import Combobox from '../dropdownSelect/combobox';
import { Button } from '../ui/button';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { IComputationFunction, IJoinPath } from '@/interfaces';
import { addJoinForQuery, changeDatasetForQuery } from '@/utils/workflow';
import DataTable from '../dataTable';
import { getFieldIdentifier } from '@/utils';

const Preview = observer(function Preview({ path }: { path: IJoinPath }) {
    const computation = useContext(ComputationContext);
    const vizStore = useVizStore();
    const { allFields } = vizStore;

    const transformedComputation = useMemo((): IComputationFunction => {
        return (query) =>
            computation(
                changeDatasetForQuery(
                    addJoinForQuery(query, [
                        {
                            type: 'join',
                            foreigns: [
                                {
                                    type: 'inner',
                                    keys: [
                                        { as: 'left', dataset: path.from, field: path.fid },
                                        { as: 'right', dataset: path.to, field: path.tid },
                                    ],
                                },
                            ],
                        },
                    ]),
                    [path.from, path.to]
                )
            );
    }, [computation, path]);
    const meta = useMemo(
        () =>
            allFields
                .filter((x) => x.dataset === path.from)
                .map((x) => ({ ...x, fid: `left.${x.fid}` }))
                .concat(allFields.filter((x) => x.dataset === path.to).map((x) => ({ ...x, fid: `right.${x.fid}` }))),
        [path, allFields]
    );
    return <DataTable size={20} computation={transformedComputation} metas={meta} />;
});

export const LinkDataset = observer(function LinkDataset() {
    const vizStore = useVizStore();
    const { linkingDataset, datasets, allFields } = vizStore;
    const datasetNames = useContext(DatasetNamesContext);
    const [refDataset, setRefDataset] = useState('');
    const [fromKey, setFromKey] = useState('');
    const [toKey, setToKey] = useState('');
    const isReady = refDataset && fromKey && toKey;
    const { t } = useTranslation();

    return (
        <Dialog open={linkingDataset !== undefined}>
            <DialogContent>
                <DialogHeader className="mb-2">
                    <DialogTitle>Create a Foreign Key</DialogTitle>
                </DialogHeader>
                {linkingDataset && (
                    <div className="flex flex-col space-y-2">
                        <div className="text-xs text-muted-foreground">Select a dataset</div>
                        <Combobox
                            className="w-[200px]"
                            options={datasets.map((dataset) => ({ label: datasetNames?.[dataset] ?? dataset, value: dataset }))}
                            selectedKey={linkingDataset}
                            onSelect={(v) => {
                                if (v) {
                                    vizStore.setLinkingDataset(v);
                                    setFromKey('');
                                    setRefDataset('');
                                    setToKey('');
                                }
                            }}
                        />
                        <div className="text-xs text-muted-foreground">Select a dataset to reference to</div>
                        <Combobox
                            className="w-[200px]"
                            options={datasets
                                .filter((d) => d !== linkingDataset)
                                .map((dataset) => ({ label: datasetNames?.[dataset] ?? dataset, value: dataset }))}
                            selectedKey={refDataset}
                            onSelect={(v) => {
                                setRefDataset(v);
                                setToKey('');
                            }}
                        />
                        {refDataset && (
                            <div className="text-xs text-muted-foreground">Select columns from {datasetNames?.[refDataset] ?? refDataset} reference to</div>
                        )}
                        {refDataset && (
                            <div className="grid grid-cols-[minmax(0,_1fr)_1rem_minmax(0,_1fr)] gap-2 w-fit">
                                <div className="text-xs text-muted-foreground">{datasetNames?.[linkingDataset] ?? linkingDataset}</div>
                                <div />
                                <div className="text-xs text-muted-foreground text-right">{datasetNames?.[refDataset] ?? refDataset} </div>
                                <Combobox
                                    options={allFields.filter((x) => x.dataset === linkingDataset).map((f) => ({ label: f.name, value: f.fid }))}
                                    selectedKey={fromKey}
                                    onSelect={setFromKey}
                                />
                                <div className="flex items-center">
                                    <ArrowRightIcon className="w-4 h-4" />
                                </div>
                                <Combobox
                                    options={allFields.filter((x) => x.dataset === refDataset).map((f) => ({ label: f.name, value: f.fid }))}
                                    selectedKey={toKey}
                                    onSelect={setToKey}
                                />
                            </div>
                        )}
                        {isReady && (
                            <div className="max-h-96 overflow-auto">
                                <Preview path={{ fid: fromKey, from: linkingDataset, to: refDataset, tid: toKey }} />
                            </div>
                        )}
                    </div>
                )}
                <DialogFooter className="mt-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            vizStore.setLinkingDataset();
                            setRefDataset('');
                            setFromKey('');
                            setToKey('');
                        }}
                    >
                        {t('actions.cancel')}
                    </Button>
                    <Button
                        disabled={!isReady}
                        onClick={() => {
                            vizStore.updateCurrentDatasetMetas(getFieldIdentifier({ fid: fromKey, dataset: linkingDataset }), {
                                foreign: {
                                    dataset: refDataset,
                                    fid: toKey,
                                },
                            });
                            vizStore.linkDataset(getFieldIdentifier({ dataset: linkingDataset, fid: fromKey }), refDataset, toKey);
                            vizStore.setLinkingDataset();
                            setRefDataset('');
                            setFromKey('');
                            setToKey('');
                        }}
                    >
                        {t('actions.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});
