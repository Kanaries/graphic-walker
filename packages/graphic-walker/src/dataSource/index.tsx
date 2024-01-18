import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import Modal from '../components/modal';
import { downloadBlob } from '../utils/save';
import GwFile from './dataSelection/gwFile';
import DataSelection from './dataSelection';
import DefaultButton from '../components/button/default';
import DropdownSelect from '../components/dropdownSelect';
import PrimaryButton from '../components/button/primary';
import { IComputationFunction, IDataSourceEventType, IDataSourceProvider, IMutField } from '../interfaces';
import { ShadowDom } from '../shadow-dom';
import { CommonStore } from '../store/commonStore';
import { VizSpecStore } from '../store/visualSpecStore';

interface DSSegmentProps {
    commonStore: CommonStore;
    dataSources: { name: string; id: string }[];
    selectedId: string;
    onSelectId: (value: string) => void;
    onSave?: () => Promise<Blob>;
    onLoad?: (file: File) => void;
}

const DataSourceSegment: React.FC<DSSegmentProps> = observer((props) => {
    const { commonStore, dataSources, onSelectId, selectedId, onLoad, onSave } = props;
    const gwFileRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const { showDSPanel } = commonStore;
    return (
        <div className="font-sans flex items-center m-4 p-4 border border-gray-200 dark:border-gray-700">
            {props.onLoad && <GwFile onImport={props.onLoad} fileRef={gwFileRef} />}
            {/* <label className="text-xs mr-1 whitespace-nowrap self-center h-4">
                {t("DataSource.labels.cur_dataset")}
            </label> */}
            <div className="mr-2">
                <DropdownSelect
                    options={dataSources.map((d) => ({ label: d.name, value: d.id }))}
                    selectedKey={selectedId}
                    onSelect={onSelectId}
                    placeholder={t('DataSource.labels.cur_dataset')}
                />
            </div>

            <PrimaryButton
                className="mr-2"
                text={t('DataSource.buttons.create_dataset')}
                onClick={() => {
                    commonStore.startDSBuildingTask();
                }}
            />
            {onSave && (
                <DefaultButton
                    className="mr-2"
                    text={t('DataSource.buttons.export_as_file')}
                    onClick={async () => {
                        const blob = await onSave();
                        downloadBlob(blob, 'graphic-walker-notebook.json');
                    }}
                />
            )}
            {props.onLoad && (
                <DefaultButton
                    className="mr-2"
                    text={t('DataSource.buttons.import_file')}
                    onClick={() => {
                        if (gwFileRef.current) {
                            gwFileRef.current.click();
                        }
                    }}
                />
            )}
            <Modal
                title={t('DataSource.dialog.create_data_source')}
                onClose={() => {
                    commonStore.setShowDSPanel(false);
                }}
                show={showDSPanel}
            >
                <DataSelection commonStore={commonStore} />
            </Modal>
        </div>
    );
});

function once<T extends (...args: any[]) => any>(register: (x: T) => () => void, cb: T) {
    const disposer = { current: () => {} };
    const newCB = (...args: Parameters<T>) => {
        const result = cb(...args);
        disposer.current();
        return result;
    };
    disposer.current = register(newCB as T);
}

export function DataSourceSegmentComponent(props: {
    provider: IDataSourceProvider;
    displayOffset?: number;
    children: (props: {
        meta: IMutField[];
        onMetaChange: (fid: string, meta: Partial<IMutField>) => void;
        computation: IComputationFunction;
        storeRef: React.RefObject<VizSpecStore>;
        datasetName: string;
        syncSpecs: () => void;
    }) => JSX.Element;
}) {
    const [selectedId, setSelectedId] = useState('');
    const [datasetList, setDatasetList] = useState<{ name: string; id: string }[]>([]);
    useEffect(() => {
        props.provider.getDataSourceList().then(setDatasetList);
        return props.provider.registerCallback((e) => {
            if (e & IDataSourceEventType.updateList) {
                props.provider.getDataSourceList().then(setDatasetList);
            }
        });
    }, [props.provider]);

    const dataset = useMemo(() => datasetList.find((x) => x.id === selectedId), [datasetList, selectedId]);

    const [computationID, refreshComputation] = useReducer((x: number) => x + 1, 0);
    const [meta, setMeta] = useState<IMutField[]>([]);
    const vizSpecStoreRef = useRef<VizSpecStore>(null);

    useEffect(() => {
        if (dataset) {
            const { provider } = props;
            provider.getMeta(dataset.id).then(setMeta);
            provider.getSpecs(dataset.id).then((x) => {
                vizSpecStoreRef.current?.importRaw(JSON.parse(x));
            });
            const disposer = provider.registerCallback((e, datasetId) => {
                if (dataset.id === datasetId) {
                    if (e & IDataSourceEventType.updateData) {
                        refreshComputation();
                    }
                    if (e & IDataSourceEventType.updateMeta) {
                        provider.getMeta(datasetId).then(setMeta);
                    }
                    if (e & IDataSourceEventType.updateSpec) {
                        provider.getSpecs(datasetId).then((x) => (x) => {
                            vizSpecStoreRef.current?.importRaw(JSON.parse(x));
                        });
                    }
                }
            });
            return () => {
                disposer();
                const data = vizSpecStoreRef.current?.exportAllCharts();
                data && provider.saveSpecs(dataset.id, JSON.stringify(data));
            };
        }
    }, [dataset, props.provider]);

    const computation = useMemo<IComputationFunction>(
        () => async (payload) => {
            return selectedId ? props.provider.queryData(payload, [selectedId]) : [];
        },
        [computationID, props.provider, selectedId]
    );

    const onMetaChange = useCallback(
        (fid: string, meta: Partial<IMutField>) => {
            setMeta((x) => {
                const result = x.map((f) => (f.fid === fid ? { ...f, ...meta } : f));
                props.provider.setMeta(selectedId, result);
                return result;
            });
        },
        [props.provider, selectedId]
    );

    const commonStore = useMemo(() => new CommonStore(props.provider, setSelectedId, { displayOffset: props.displayOffset }), [props.provider]);

    useEffect(() => {
        commonStore.setDisplayOffset(props.displayOffset);
    }, [props.displayOffset, commonStore]);

    const onLoad = useMemo(() => {
        const importFile = props.provider.onImportFile;
        if (importFile) {
            return (file: File) => {
                importFile(file);
                once(props.provider.registerCallback, (e) => {
                    if (e & IDataSourceEventType.updateList) {
                        props.provider.getDataSourceList().then(([first]) => setSelectedId(first.id));
                    }
                });
            };
        }
    }, [props.provider]);

    const onSave = useMemo(() => {
        const exportFile = props.provider.onExportFile;
        const saveSpecs = props.provider.saveSpecs;
        if (exportFile) {
            return async () => {
                const data = vizSpecStoreRef.current?.exportAllCharts();
                if (data) {
                    await saveSpecs(selectedId, JSON.stringify(data));
                }
                return exportFile();
            };
        }
    }, [selectedId, props.provider]);

    const syncSpecs = useCallback(() => {
        const data = vizSpecStoreRef.current?.exportAllCharts();
        if (data) {
            props.provider.saveSpecs(selectedId, JSON.stringify(data));
        }
    }, [selectedId, props.provider]);

    return (
        <>
            <ShadowDom>
                <DataSourceSegment
                    commonStore={commonStore}
                    dataSources={datasetList}
                    onSelectId={setSelectedId}
                    selectedId={selectedId}
                    onLoad={onLoad}
                    onSave={onSave}
                />
            </ShadowDom>
            <props.children
                computation={computation}
                datasetName={dataset?.name ?? ''}
                meta={meta}
                onMetaChange={onMetaChange}
                storeRef={vizSpecStoreRef}
                syncSpecs={syncSpecs}
            />
        </>
    );
}

export default DataSourceSegment;
