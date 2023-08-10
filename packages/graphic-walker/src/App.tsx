import React, { useEffect, useRef, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { IComputationFunction, IDarkMode, IMutField, IRow, ISegmentKey, IThemeKey, Specification } from './interfaces';
import type { IReactVegaHandler } from './vis/react-vega';
import VisualSettings from './visualSettings';
import PosFields from './fields/posFields';
import AestheticFields from './fields/aestheticFields';
import DatasetFields from './fields/datasetFields/index';
import ReactiveRenderer from './renderer/index';
import DataSourceSegment from './dataSource/index';
import { IGlobalStore, useGlobalStore } from './store';
import VisNav from './segments/visNav';
import { mergeLocaleRes, setLocaleLanguage } from './locales/i18n';
import FilterField from './fields/filterField';
import { guardDataKeys } from './utils/dataPrep';
import SegmentNav from './segments/segmentNav';
import DatasetConfig from './dataSource/datasetConfig';
import { useCurrentMediaTheme } from './utils/media';
import CodeExport from './components/codeExport';
import VisualConfig from './components/visualConfig';
import type { ToolbarItemProps } from './components/toolbar';
import AskViz from './components/askViz';
import { getComputation } from './computation/clientComputation';

export interface IGWProps {
    dataSource?: IRow[];
    rawFields?: IMutField[];
    spec?: Specification;
    hideDataSourceConfig?: boolean;
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    keepAlive?: boolean | string;
    /**
     * auto parse field key into a safe string. default is true
     */
    fieldKeyGuard?: boolean;
    /** @default "vega" */
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    storeRef?: React.MutableRefObject<IGlobalStore | null>;
    computation?: IComputationFunction;
    toolbar?: {
        extra?: ToolbarItemProps[];
        exclude?: string[];
    };
    enhanceAPI?: {
        header?: Record<string, string>;
        features?: {
            askviz?: string | boolean;
        }
    };
}

const App = observer<IGWProps>(function App(props) {
    const {
        dataSource = [],
        rawFields = [],
        spec,
        i18nLang = 'en-US',
        i18nResources,
        hideDataSourceConfig,
        fieldKeyGuard = true,
        themeKey = 'vega',
        dark = 'media',
        computation,
        toolbar,
        enhanceAPI,
    } = props;
    const { commonStore, vizStore } = useGlobalStore();

    const { datasets, segmentKey } = commonStore;

    const { t, i18n } = useTranslation();
    const curLang = i18n.language;

    useEffect(() => {
        if (i18nResources) {
            mergeLocaleRes(i18nResources);
        }
    }, [i18nResources]);

    useEffect(() => {
        if (i18nLang !== curLang) {
            setLocaleLanguage(i18nLang);
        }
    }, [i18nLang, curLang]);

    const [sampleRemoteData, setSampleRemoteData] = useState<IRow[]>([]);
    const remoteDataContext = useRef(0);

    useEffect(() => {
        if (!computation) return;
        async () => {
            const ts = Date.now();
            remoteDataContext.current = ts;
            const resp = await computation({ workflow: [{ type: 'view', query: [{ op: 'raw', fields: ['*'] }] }], limit: 1 });
            if (remoteDataContext.current === ts) {
                setSampleRemoteData(resp);
            }
        };
    }, [computation]);
    
    const remoteDataSource = dataSource.length > 0 ? dataSource : sampleRemoteData;

    const safeDataset = useMemo(() => {
        let safeData = remoteDataSource;
        let safeMetas = rawFields;
        if (fieldKeyGuard) {
            const { safeData: _safeData, safeMetas: _safeMetas } = guardDataKeys(remoteDataSource, rawFields);
            safeData = _safeData;
            safeMetas = _safeMetas;
        }
        return {
            safeData,
            safeMetas,
        };
    }, [rawFields, remoteDataSource, computation, fieldKeyGuard]);

    // use as an embeding module, use outside datasource from props.
    useEffect(() => {
        if (safeDataset.safeData.length > 0 && safeDataset.safeMetas.length > 0) {
            commonStore.addAndUseDS({
                name: 'context dataset',
                dataSource: safeDataset.safeData,
                rawFields: safeDataset.safeMetas,
            });
        }
    }, [safeDataset]);

    useEffect(() => {
        if (safeDataset.safeData.length > 0 && safeDataset.safeMetas.length > 0 && spec) {
            vizStore.renderSpec(spec);
        }
    }, [spec, safeDataset]);

    useEffect(() => {
        if (computation) {
            vizStore.setComputationFunction(computation);
        } else {
            vizStore.setComputationFunction(getComputation(commonStore.currentDataset.dataSource));
        }
    }, [vizStore, computation ?? commonStore.currentDataset.dataSource]);

    const darkMode = useCurrentMediaTheme(dark);

    const rendererRef = useRef<IReactVegaHandler>(null);

    return (
        <div
            className={`${
                darkMode === 'dark' ? 'dark' : ''
            } App font-sans bg-white dark:bg-zinc-900 dark:text-white m-0 p-0`}
        >
            {/* <div className="grow-0">
                <PageNav />
            </div> */}
            <div className="bg-white dark:bg-zinc-900 dark:text-white">
                {!hideDataSourceConfig && <DataSourceSegment />}
                <div className="px-2 mx-2">
                    <SegmentNav />
                    {segmentKey === ISegmentKey.vis && <VisNav />}
                </div>
                {segmentKey === ISegmentKey.vis && (
                    <div
                        style={{ marginTop: '0em', borderTop: 'none' }}
                        className="m-4 p-4 border border-gray-200 dark:border-gray-700"
                    >
                        {enhanceAPI?.features?.askviz && (
                            <AskViz api={typeof enhanceAPI.features.askviz === 'string' ? enhanceAPI.features.askviz : ''} headers={enhanceAPI?.header} />
                        )}
                        <VisualSettings rendererHandler={rendererRef} darkModePreference={dark} exclude={toolbar?.exclude} extra={toolbar?.extra} />
                        <CodeExport />
                        <VisualConfig />
                        <div className="md:grid md:grid-cols-12 xl:grid-cols-6">
                            <div className="md:col-span-3 xl:col-span-1">
                                <DatasetFields />
                            </div>
                            <div className="md:col-span-2 xl:col-span-1">
                                <FilterField />
                                <AestheticFields />
                            </div>
                            <div className="md:col-span-7 xl:col-span-4">
                                <div>
                                    <PosFields />
                                </div>
                                <div
                                    className="m-0.5 p-1 border border-gray-200 dark:border-gray-700"
                                    style={{ minHeight: '600px', overflow: 'auto' }}
                                    // onMouseLeave={() => {
                                    //     vizEmbededMenu.show && commonStore.closeEmbededMenu();
                                    // }}
                                    // onClick={() => {
                                    //     vizEmbededMenu.show && commonStore.closeEmbededMenu();
                                    // }}
                                >
                                    {datasets.length > 0 && (
                                        <ReactiveRenderer ref={rendererRef} themeKey={themeKey} dark={dark} computationFunction={vizStore.computationFuction} />
                                    )}
                                    {/* {vizEmbededMenu.show && (
                                        <ClickMenu x={vizEmbededMenu.position[0]} y={vizEmbededMenu.position[1]}>
                                            <div
                                                className="flex items-center whitespace-nowrap py-1 px-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                                onClick={() => {
                                                    commonStore.closeEmbededMenu();
                                                    commonStore.setShowInsightBoard(true);
                                                }}
                                            >
                                                <span className="flex-1 pr-2">
                                                    {t("App.labels.data_interpretation")}
                                                </span>
                                                <LightBulbIcon className="ml-1 w-3 flex-grow-0 flex-shrink-0" />
                                            </div>
                                        </ClickMenu>
                                    )} */}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {segmentKey === ISegmentKey.data && (
                    <div
                        className="m-4 p-4 border border-gray-200 dark:border-gray-700"
                        style={{ marginTop: '0em', borderTop: 'none' }}
                    >
                        <DatasetConfig />
                    </div>
                )}
            </div>
        </div>
    );
});

export default App;

export type { ToolbarItemProps };
