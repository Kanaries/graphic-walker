import React, { useState, useEffect, useRef, useMemo } from "react";
import { Specification } from "visual-insights";
import { observer } from "mobx-react-lite";
import { LightBulbIcon } from "@heroicons/react/24/outline";
import { toJS } from "mobx";
import { useTranslation } from "react-i18next";
import { IMutField, IRow, ISegmentKey } from "./interfaces";
import type { IReactVegaHandler } from "./vis/react-vega";
import VisualSettings from "./visualSettings";
import { Container, NestContainer } from "./components/container";
import ClickMenu from "./components/clickMenu";
import InsightBoard from "./insightBoard/index";
import PosFields from "./fields/posFields";
import AestheticFields from "./fields/aestheticFields";
import DatasetFields from "./fields/datasetFields/index";
import ReactiveRenderer from "./renderer/index";
import DataSourceSegment from "./dataSource/index";
import { useGlobalStore } from "./store";
import { preAnalysis, destroyWorker } from "./services";
import VisNav from "./segments/visNav";
import { mergeLocaleRes, setLocaleLanguage } from "./locales/i18n";
import FilterField from "./fields/filterField";
import { guardDataKeys } from "./utils/dataPrep";
import SegmentNav from "./segments/segmentNav";
import DatasetConfig from "./dataSource/datasetConfig";

export interface IGWProps {
    dataSource?: IRow[];
    rawFields?: IMutField[];
    spec?: Specification;
    hideDataSourceConfig?: boolean;
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    keepAlive?: boolean;
    /** @default "auto" */
    overflowMode?: 'auto' | 'hidden';
    /**
     * auto parse field key into a safe string. default is true
     */
    fieldKeyGuard?: boolean;
    /** @default "vega" */
    themeKey?: 'vega' | 'g2';
}

const App = observer<IGWProps>(function App (props) {
    const {
        dataSource = [],
        rawFields = [],
        spec,
        i18nLang = "en-US",
        i18nResources,
        hideDataSourceConfig,
        overflowMode = 'auto',
        fieldKeyGuard = true,
        themeKey = 'vega',
    } = props;
    const { commonStore, vizStore } = useGlobalStore();
    const [insightReady, setInsightReady] = useState<boolean>(true);

    const { currentDataset, datasets, vizEmbededMenu, segmentKey } = commonStore;

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

    const safeDataset = useMemo(() => {
        let safeData = dataSource;
        let safeMetas = rawFields;
        if (fieldKeyGuard) {
            const { safeData: _safeData, safeMetas: _safeMetas } = guardDataKeys(dataSource, rawFields);
            safeData = _safeData;
            safeMetas = _safeMetas;
        }
        return {
            safeData,
            safeMetas,
        };
    }, [rawFields, dataSource, fieldKeyGuard]);

    // use as an embeding module, use outside datasource from props.
    useEffect(() => {
        if (safeDataset.safeData.length > 0 && safeDataset.safeMetas.length > 0) {
            commonStore.addAndUseDS({
                name: "context dataset",
                dataSource: safeDataset.safeData,
                rawFields: safeDataset.safeMetas,
            });
        }
    }, [safeDataset]);

    // do preparation analysis work when using a new dataset
    useEffect(() => {
        const ds = currentDataset;
        if (ds && ds.dataSource.length > 0 && ds.rawFields.length > 0) {
            setInsightReady(false);
            preAnalysis({
                dataSource: ds.dataSource,
                fields: toJS(ds.rawFields),
            }).then(() => {
                setInsightReady(true);

                if (spec) {
                    vizStore.renderSpec(spec);
                }
            });
        }
        return () => {
            destroyWorker();
        };
    }, [currentDataset, spec]);

    const rendererRef = useRef<IReactVegaHandler>(null);

    return (
        <div className="App dark:bg-zinc-900 dark:text-white m-0 p-0 w-full h-full overflow-hidden">
            {/* <div className="grow-0">
                <PageNav />
            </div> */}
            <div className={`w-full h-full ${overflowMode === 'hidden' ? 'overflow-hidden' : 'overflow-auto'} @container`}>
                {!hideDataSourceConfig && <DataSourceSegment preWorkDone={insightReady} />}
                <div className="px-2 mx-2">
                    <SegmentNav />
                    {
                        segmentKey === ISegmentKey.vis && <VisNav />
                    }
                </div>
                {segmentKey === ISegmentKey.vis && (
                    <Container style={{ marginTop: "0em", borderTop: "none" }} className="@container/main">
                        <VisualSettings rendererHandler={rendererRef} />
                        <div className="@lg/main:grid @lg/main:grid-cols-12 @xl/main:grid-cols-6">
                            <div className="@lg/main:col-span-3 @xl/main:col-span-1 @sm/main:grid @sm/main:grid-cols-3">
                                <div className="col-span-3 @sm/main:col-span-2 @lg/main:col-span-3">
                                    <DatasetFields />
                                </div>
                                <div className="hidden @sm/main:block @sm/main:col-span-1 @lg/main:hidden">
                                    <FilterField />
                                </div>
                            </div>
                            <div className="@lg/main:col-span-2 @xl/main:col-span-1">
                                <div className="block @sm/main:hidden @lg/main:block mt-[2px] @sm/main:mt-0">
                                    <FilterField />
                                </div>
                                <AestheticFields />
                            </div>
                            <div className="@lg/main:col-span-7 @xl/main:col-span-4">
                                <PosFields />
                                <NestContainer
                                    style={{ minHeight: "600px", overflow: "auto" }}
                                    onMouseLeave={() => {
                                        vizEmbededMenu.show && commonStore.closeEmbededMenu();
                                    }}
                                    onClick={() => {
                                        vizEmbededMenu.show && commonStore.closeEmbededMenu();
                                    }}
                                >
                                    {datasets.length > 0 && <ReactiveRenderer ref={rendererRef} themeKey={themeKey} />}
                                    <InsightBoard />
                                    {vizEmbededMenu.show && (
                                        <ClickMenu x={vizEmbededMenu.position[0]} y={vizEmbededMenu.position[1]}>
                                            <div
                                                className="flex items-center whitespace-nowrap py-1 px-4 hover:bg-gray-100"
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
                                    )}
                                </NestContainer>
                            </div>
                        </div>
                    </Container>
                )}
                {segmentKey === ISegmentKey.data && (
                    <Container style={{ marginTop: "0em", borderTop: "none" }}>
                        <DatasetConfig />
                    </Container>
                )}
            </div>
        </div>
    );
});

export default App;
