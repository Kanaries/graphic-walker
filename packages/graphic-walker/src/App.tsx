import React, { useState, useEffect, CSSProperties, useRef } from "react";
import { Specification } from "visual-insights";
import { observer } from "mobx-react-lite";
import { toJS } from "mobx";
import { useTranslation } from "react-i18next";
import { IMutField, IRow } from "./interfaces";
import { Container } from "./components/container";
import DataSourceSegment from "./dataSource/index";
import { useGlobalStore } from "./store";
import { preAnalysis, destroyWorker } from "./services";
import { mergeLocaleRes, setLocaleLanguage } from "./locales/i18n";
import { PrimarySideBar } from "./components/primarySideBar";
import { Main } from "./components/main";
import { useWorkspaceContextProvider } from "./store/dashboard/workspace";
import { useDashboardContextProvider } from "./store/dashboard";

export interface EditorProps {
    dataSource?: IRow[];
    rawFields?: IMutField[];
    spec?: Specification;
    hideDataSourceConfig?: boolean;
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    keepAlive?: boolean;
    styles?: {
        shadowRoot?: CSSProperties;
        app?: CSSProperties;
        root?: CSSProperties;
        container?: CSSProperties;
    };
}

const App: React.FC<EditorProps> = (props) => {
    const { dataSource = [], rawFields = [], spec, i18nLang = "en-US", i18nResources, hideDataSourceConfig, styles } = props;
    const { commonStore, vizStore } = useGlobalStore();
    const [insightReady, setInsightReady] = useState<boolean>(true);
    const DashboardCtxProvider = useDashboardContextProvider();
    const DashboardWspProvider = useWorkspaceContextProvider();
    const [[w, h], setSize] = useState<[number, number]>([0, 0]);

    const { currentDataset } = commonStore;

    const { i18n } = useTranslation();
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

    // use as an embeding module, use outside datasource from props.
    useEffect(() => {
        if (dataSource.length > 0) {
            commonStore.addAndUseDS({
                name: "context dataset",
                dataSource: dataSource,
                rawFields,
            });
        }
    }, [dataSource, rawFields]);

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

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const { current: container } = containerRef;
        if (container) {
            const cb = (): void => {
                const { width, height } = container.getBoundingClientRect();
                setSize([width, height]);
            };
            const ro = new ResizeObserver(cb);
            ro.observe(container);
            return () => ro.disconnect();
        }
    }, []);

    return (
        <DashboardWspProvider>
            <DashboardCtxProvider>
                <div className="App GW_app w-full h-full flex flex-col overflow-hidden" style={styles?.app}>
                    {!hideDataSourceConfig && <DataSourceSegment preWorkDone={insightReady} style={styles?.container} />}
                    <Container className="GW_container p-0 GW__root flex-1 flex flex-row overflow-hidden" style={{ ...styles?.container, ...styles?.root }} ref={containerRef}>
                        <PrimarySideBar direction={w < h ? 'portrait' : 'landscape'} />
                        <Main direction={w < h ? 'portrait' : 'landscape'} />
                    </Container>
                </div>
            </DashboardCtxProvider>
        </DashboardWspProvider>
    );
};

export default observer(App);
