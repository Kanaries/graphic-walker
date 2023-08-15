import React, { useEffect, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { IComputationFunction, IMutField, ISegmentKey, IThemeKey } from './interfaces';
import type { IReactVegaHandler } from './vis/react-vega';
import VisualSettings from './visualSettings';
import PosFields from './fields/posFields';
import AestheticFields from './fields/aestheticFields';
import DatasetFields from './fields/datasetFields/index';
import ReactiveRenderer from './renderer/index';
import { ComputationContext, VizStoreWrapper, useVizStore } from './store';
import VisNav from './segments/visNav';
import { mergeLocaleRes, setLocaleLanguage } from './locales/i18n';
import FilterField from './fields/filterField';
import SegmentNav from './segments/segmentNav';
import DatasetConfig from './dataSource/datasetConfig';
import CodeExport from './components/codeExport';
import VisualConfig from './components/visualConfig';
import type { ToolbarItemProps } from './components/toolbar';
import AskViz from './components/askViz';
import { VizSpecStore } from './store/visualSpecStore';
import { guardDataKeys } from './utils/dataPrep';
import { getComputation } from './computation/clientComputation';
import FieldsContextWrapper from './fields/fieldsContext';

export interface BaseVizProps {
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    themeKey?: IThemeKey;
    darkMode?: 'light' | 'dark';
    toolbar?: {
        extra?: ToolbarItemProps[];
        exclude?: string[];
    };
    enhanceAPI?: {
        header?: Record<string, string>;
        features?: {
            askviz?: string | boolean;
        };
    };
}

export const VizApp = observer(function VizApp(
    props: BaseVizProps & {
        computation?: IComputationFunction;
    }
) {
    const { computation, darkMode = 'light', i18nLang = 'en-US', enhanceAPI, i18nResources, themeKey = 'vega', toolbar } = props;

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

    const vizStore = useVizStore();

    const rendererRef = useRef<IReactVegaHandler>(null);

    const { segmentKey } = vizStore;

    const c = computation || (async () => []);
    return (
        <ComputationContext.Provider value={c}>
            <div className={`${darkMode === 'dark' ? 'dark' : ''} App font-sans bg-white dark:bg-zinc-900 dark:text-white m-0 p-0`}>
                <div className="bg-white dark:bg-zinc-900 dark:text-white">
                    <div className="px-2 mx-2">
                        <SegmentNav />
                        {segmentKey === ISegmentKey.vis && <VisNav />}
                    </div>
                    {segmentKey === ISegmentKey.vis && (
                        <div style={{ marginTop: '0em', borderTop: 'none' }} className="m-4 p-4 border border-gray-200 dark:border-gray-700">
                            {enhanceAPI?.features?.askviz && (
                                <AskViz api={typeof enhanceAPI.features.askviz === 'string' ? enhanceAPI.features.askviz : ''} headers={enhanceAPI?.header} />
                            )}
                            <VisualSettings rendererHandler={rendererRef} darkModePreference={darkMode} exclude={toolbar?.exclude} extra={toolbar?.extra} />
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
                                    <div className="m-0.5 p-1 border border-gray-200 dark:border-gray-700" style={{ minHeight: '600px', overflow: 'auto' }}>
                                        {computation && (
                                            <ReactiveRenderer ref={rendererRef} themeKey={themeKey} dark={darkMode} computationFunction={computation} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {segmentKey === ISegmentKey.data && (
                        <div className="m-4 p-4 border border-gray-200 dark:border-gray-700" style={{ marginTop: '0em', borderTop: 'none' }}>
                            <DatasetConfig />
                        </div>
                    )}
                </div>
            </div>
        </ComputationContext.Provider>
    );
});

export type VizProps = {
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    themeKey?: IThemeKey;
    darkMode?: 'light' | 'dark';
    toolbar?: {
        extra?: ToolbarItemProps[];
        exclude?: string[];
    };
    enhanceAPI?: {
        header?: Record<string, string>;
        features?: {
            askviz?: string | boolean;
        };
    };
    keepAlive?: boolean | string;
    storeRef?: React.MutableRefObject<VizSpecStore | null>;
    rawFields: IMutField[];
    onMetaChange?: (fid: string, meta: Partial<IMutField>) => void;
} & (
    | {
          /**
           * auto parse field key into a safe string. default is true
           */
          fieldKeyGuard?: boolean;
          dataSource: any[];
      }
    | {
          fieldKeyGuard: undefined;
          dataSource: undefined;
          computation: IComputationFunction;
      }
);

export function VizAppWithContext(props: VizProps) {
    const { computation, safeMetas } = useMemo(() => {
        if (props.dataSource) {
            if (props.fieldKeyGuard) {
                const { safeData, safeMetas } = guardDataKeys(props.dataSource, props.rawFields);
                return {
                    safeMetas,
                    computation: getComputation(safeData),
                };
            }
            return {
                safeMetas: props.rawFields,
                computation: getComputation(props.dataSource),
            };
        }
        return {
            safeMetas: props.rawFields,
            computation: props.computation,
        };
    }, [props.rawFields, props.dataSource ? props.dataSource : props.computation, props.fieldKeyGuard]);

    return (
        <VizStoreWrapper onMetaChange={props.onMetaChange} meta={safeMetas} keepAlive={props.keepAlive} storeRef={props.storeRef}>
            <FieldsContextWrapper>
                <VizApp
                    darkMode={props.darkMode}
                    enhanceAPI={props.enhanceAPI}
                    i18nLang={props.i18nLang}
                    i18nResources={props.i18nResources}
                    themeKey={props.themeKey}
                    toolbar={props.toolbar}
                    computation={computation}
                />
            </FieldsContextWrapper>
        </VizStoreWrapper>
    );
}
