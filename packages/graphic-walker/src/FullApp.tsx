import React from 'react';
import { observer } from 'mobx-react-lite';
import { IChannelScales, IDarkMode, IGeoDataItem, IGeographicData, IThemeKey } from './interfaces';
import DataSourceSegment from './dataSource/index';
import { StoreWrapper, VisContext, useGlobalStore } from './store';
import { useCurrentMediaTheme } from './utils/media';
import type { ToolbarItemProps } from './components/toolbar';
import { VizApp } from './App';
import { CommonStore } from './store/commonStore';
import FieldsContextWrapper from './fields/fieldsContext';

export interface IGWProps {
    hideDataSourceConfig?: boolean;
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
    keepAlive?: boolean | string;
    /** @default "vega" */
    themeKey?: IThemeKey;
    dark?: IDarkMode;
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
    storeRef?: React.MutableRefObject<CommonStore | null>;
    geographicData?: IGeographicData & {
        key: string;
    };
    onError?: (err: Error) => void;
    geoList?: IGeoDataItem[];
    channelScales?: IChannelScales;
}

export const AppContent = observer<Omit<IGWProps, 'storeRef' | 'keepAlive'>>(function App(props) {
    const { i18nLang = 'en-US', i18nResources, themeKey = 'vega', dark = 'media', toolbar, enhanceAPI } = props;
    const commonStore = useGlobalStore();

    const { dataStore } = commonStore;

    const darkMode = useCurrentMediaTheme(dark);

    return (
        <VisContext.Provider value={dataStore.visSpecStore}>
            <FieldsContextWrapper>
                <div className={`${darkMode === 'dark' ? 'dark' : ''} App font-sans bg-white dark:bg-zinc-900 dark:text-white m-0 p-0`}>
                    <VizApp
                        dataSelection={<DataSourceSegment />}
                        computation={dataStore.computation}
                        darkMode={darkMode}
                        enhanceAPI={enhanceAPI}
                        i18nLang={i18nLang}
                        i18nResources={i18nResources}
                        themeKey={themeKey}
                        toolbar={toolbar}
                    />
                </div>
            </FieldsContextWrapper>
        </VisContext.Provider>
    );
});

export const App = observer<IGWProps>(function App(props) {
    return (
        <StoreWrapper storeRef={props.storeRef} keepAlive={props.keepAlive}>
            <AppContent {...props} />
        </StoreWrapper>
    );
});

export default App;
