import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '../utils/save';
import GwFile from './dataSelection/gwFile';
import DataSelection from './dataSelection';
import DropdownSelect from '../components/dropdownSelect';
import { FieldIdentifier, IUIThemeConfig, IComputationFunction, IDarkMode, IDataSourceEventType, IDataSourceProvider, IMutField, IThemeKey } from '../interfaces';
import { ShadowDom } from '../shadow-dom';
import { CommonStore } from '../store/commonStore';
import { VizSpecStore } from '../store/visualSpecStore';
import { useCurrentMediaTheme } from '../utils/media';
import { GWGlobalConfig } from '../vis/theme';
import { composeContext } from '../utils/context';
import { portalContainerContext, themeContext, vegaThemeContext } from '../store/theme';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MultiCombobox } from '@/components/dropdownSelect/combobox';
import { getFieldIdentifier } from '@/utils';

interface DSSegmentProps {
    commonStore: CommonStore;
    dataSources: { name: string; id: string }[];
    selectedIds: string[];
    onSelectIds: (value: string[]) => void;
    onSave?: () => Promise<Blob>;
    onLoad?: (file: File) => void;
}

const DataSourceSegment: React.FC<DSSegmentProps> = observer((props) => {
    const { commonStore, dataSources, onSelectIds, selectedIds, onLoad, onSave } = props;
    const gwFileRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const { showDSPanel } = commonStore;
    return (
        <div className="font-sans gap-2 flex flex-wrap items-center m-4 p-4 border rounded-md">
            {props.onLoad && <GwFile onImport={props.onLoad} fileRef={gwFileRef} />}
            {/* <label className="text-xs mr-1 whitespace-nowrap self-center h-4">
                {t("DataSource.labels.cur_dataset")}
            </label> */}
            <div className="mr-2">
                <MultiCombobox
                    className="text-xs !h-8"
                    options={dataSources.map((d) => ({ label: d.name, value: d.id }))}
                    selectedKeys={selectedIds}
                    onSelect={onSelectIds}
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
        fields: IMutField[];
        onMetaChange: (fid: FieldIdentifier, meta: Partial<IMutField>) => void;
        computation: IComputationFunction;
        storeRef: React.RefObject<VizSpecStore>;
        datasetNames: Record<string, string>;
        syncSpecs: () => void;
    }) => JSX.Element;
}) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [datasetList, setDatasetList] = useState<{ name: string; id: string }[]>([]);
    useEffect(() => {
        props.provider.getDataSourceList().then(setDatasetList);
        return props.provider.registerCallback((e) => {
            if (e & IDataSourceEventType.updateList) {
                props.provider.getDataSourceList().then(setDatasetList);
            }
        });
    }, [props.provider]);

    const datasets = useMemo(() => datasetList.filter((x) => selectedIds.includes(x.id)), [datasetList, selectedIds]);

    const [computationID, refreshComputation] = useReducer((x: number) => x + 1, 0);
    const [meta, setMeta] = useState<IMutField[]>([]);
    const vizSpecStoreRef = useRef<VizSpecStore>(null);
    const [computation, setComputation] = useState<IComputationFunction>(() => async () => []);

    useEffect(() => {
        if (datasets.length) {
            const { provider } = props;
            Promise.all(datasets.map(({ id }) => provider.getMeta(id).then((meta) => meta.map((x) => ({ ...x, dataset: id }))))).then((metas) => {
                setMeta(metas.flat());
            });
            const specKey = datasets.length > 1 ? JSON.stringify(datasets.map((x) => x.id).sort()) : datasets[0].id;

            provider.getSpecs(specKey).then((x) => {
                vizSpecStoreRef.current?.importRaw(JSON.parse(x));
            });
            const disposer = provider.registerCallback((e, datasetId) => {
                if (datasets.find((x) => x.id === datasetId)) {
                    if (e & IDataSourceEventType.updateData) {
                        refreshComputation();
                    }
                    if (e & IDataSourceEventType.updateMeta) {
                        Promise.all(datasets.map(({ id }) => provider.getMeta(id).then((meta) => meta.map((x) => ({ ...x, dataset: id }))))).then((metas) => {
                            setMeta(metas.flat());
                        });
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
                data && provider.saveSpecs(specKey, JSON.stringify(data));
            };
        }
    }, [datasets, props.provider]);

    useEffect(() => {
        setComputation(() => async (payload) => {
            return selectedIds ? props.provider.queryData(payload, selectedIds) : [];
        });
    }, [computationID, props.provider, selectedIds]);

    const onMetaChange = useCallback(
        (fid: FieldIdentifier, meta: Partial<IMutField>) => {
            setMeta((x) => {
                const oriMeta = x.find((f) => getFieldIdentifier(f) === fid);
                if (!oriMeta) {
                    return x;
                }
                const result = x.map((f) => (getFieldIdentifier(f) === fid ? { ...f, ...meta } : f));
                const dataset = oriMeta.dataset ?? selectedIds[0];
                props.provider.setMeta(
                    dataset,
                    result.filter((x) => x.dataset === dataset)
                );
                return result;
            });
        },
        [props.provider, selectedIds]
    );

    const commonStore = useMemo(() => new CommonStore(props.provider, (id) => setSelectedIds([id]), { displayOffset: props.displayOffset }), [props.provider]);

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
                        props.provider.getDataSourceList().then(([first]) => setSelectedIds([first.id]));
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
                const specKey = selectedIds.length > 1 ? JSON.stringify(selectedIds.map((x) => x).sort()) : selectedIds[0];
                if (data) {
                    await saveSpecs(specKey, JSON.stringify(data));
                }
                return exportFile();
            };
        }
    }, [selectedIds, props.provider]);

    const syncSpecs = useCallback(() => {
        const data = vizSpecStoreRef.current?.exportAllCharts();
        if (data) {
            const specKey = selectedIds.length > 1 ? JSON.stringify(selectedIds.map((x) => x).sort()) : selectedIds[0];
            props.provider.saveSpecs(specKey, JSON.stringify(data));
        }
    }, [selectedIds, props.provider]);

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
                            onSelectIds={setSelectedIds}
                            selectedIds={selectedIds}
                            onLoad={onLoad}
                            onSave={onSave}
                        />
                        <div ref={setPortal} />
                    </div>
                </DataSourceThemeContext>
            </ShadowDom>
            <props.children
                computation={computation}
                datasetNames={Object.fromEntries(datasets.map((x) => [x.id, x.name]))}
                fields={meta}
                onMetaChange={onMetaChange}
                storeRef={vizSpecStoreRef}
                syncSpecs={syncSpecs}
            />
        </>
    );
}

export default DataSourceSegment;
