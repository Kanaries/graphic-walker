import React from 'react';
import { observer } from 'mobx-react-lite';
import { IGWProps } from './interfaces';
import DataSourceSegment from './dataSource/index';
import { StoreWrapper, VisContext, useGlobalStore } from './store';
import { useCurrentMediaTheme } from './utils/media';
import { VizApp } from './App';
import FieldsContextWrapper from './fields/fieldsContext';

export const AppContent = observer<Omit<IGWProps, 'storeRef' | 'keepAlive'>>(function App(props) {
    const { i18nLang = 'en-US', i18nResources, themeKey = 'vega', dark = 'media', themeConfig, toolbar, enhanceAPI, geographicData, onError, geoList, channelScales } = props;
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
                        themeConfig={themeConfig}
                        toolbar={toolbar}
                        geographicData={geographicData}
                        geoList={geoList}
                        onError={onError}
                        channelScales={channelScales}
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
