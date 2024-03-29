import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '../utils/save';
import GwFile from './dataSelection/gwFile';
import DataSelection from './dataSelection';
import DropdownSelect from '../components/dropdownSelect';
import { IUIThemeConfig, IComputationFunction, IDarkMode, IDataSourceEventType, IDataSourceProvider, IMutField, IThemeKey } from '../interfaces';
import { ShadowDom } from '../shadow-dom';
import { CommonStore } from '../store/commonStore';
import { VizSpecStore } from '../store/visualSpecStore';
import { useCurrentMediaTheme } from '../utils/media';
import { GWGlobalConfig } from '../vis/theme';
import { composeContext } from '../utils/context';
import { portalContainerContext, themeContext, vegaThemeContext } from '../store/theme';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
        <div className="font-sans gap-2 flex flex-wrap items-center m-4 p-4 border rounded-md">
            {props.onLoad && <GwFile onImport={props.onLoad} fileRef={gwFileRef} />}
            {/* <label className="text-xs mr-1 whitespace-nowrap self-center h-4">
                {t("DataSource.labels.cur_dataset")}
            </label> */}
            <div>
                <DropdownSelect
                    className="text-xs !h-8"
                    options={dataSources.map((d) => ({ label: d.name, value: d.id }))}
                    selectedKey={selectedId}
                    onSelect={onSelectId}
                    placeholder={t('DataSource.labels.cur_dataset')}
                />
            </div>

            <Button
                size="sm"
                onClick={() => {
                    commonStore.startDSBuildingTask();
                }}
            >
                {t('DataSource.buttons.create_dataset')}
            </Button>
            {onSave && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                        const blob = await onSave();
                        downloadBlob(blob, 'graphic-walker-notebook.json');
                    }}
                >
                    {t('DataSource.buttons.export_as_file')}
                </Button>
            )}
            {props.onLoad && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        if (gwFileRef.current) {
                            gwFileRef.current.click();
                        }
                    }}
                >
                    {t('DataSource.buttons.import_file')}
                </Button>
            )}
            <Dialog
                onOpenChange={() => {
                    commonStore.setShowDSPanel(false);
                }}
                open={showDSPanel}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('DataSource.dialog.create_data_source')}</DialogTitle>
                    </DialogHeader>
                    <DataSelection commonStore={commonStore} />
                </DialogContent>
            </Dialog>
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

const DataSourceThemeContext = composeContext({ themeContext, vegaThemeContext, portalContainerContext });

export function DataSourceSegmentComponent(props: {
    provider: IDataSourceProvider;
    displayOffset?: number;
    /** @deprecated renamed to appearence */
    dark?: IDarkMode;
    appearance?: IDarkMode;
    /** @deprecated use vizThemeConfig instead */
    themeKey?: IThemeKey;
    /** @deprecated use vizThemeConfig instead */
    themeConfig?: GWGlobalConfig;
    vizThemeConfig?: IThemeKey | GWGlobalConfig;
    /** @deprecated renamed to uiTheme */
    colorConfig?: IUIThemeConfig;
    uiTheme?: IUIThemeConfig;
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

    const darkMode = useCurrentMediaTheme(props.appearance ?? props.dark);
    const [portal, setPortal] = useState<HTMLDivElement | null>(null);

    return (
        <>
            <ShadowDom uiTheme={props.uiTheme ?? props.colorConfig}>
                <DataSourceThemeContext
                    themeContext={darkMode}
                    vegaThemeContext={{ vizThemeConfig: props.vizThemeConfig ?? props.themeConfig ?? props.themeKey}}
                    portalContainerContext={portal}
                >
                    <div className={`${darkMode === 'dark' ? 'dark' : ''} App`}>
                        <DataSourceSegment
                            commonStore={commonStore}
                            dataSources={datasetList}
                            onSelectId={setSelectedId}
                            selectedId={selectedId}
                            onLoad={onLoad}
                            onSave={onSave}
                        />
                        <div ref={setPortal} />
                    </div>
                </DataSourceThemeContext>
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
