import { observer } from 'mobx-react-lite';
import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { IAppI18nProps, IErrorHandlerProps, IComputationContextProps, ITableProps, ITableSpecProps, IComputationProps, IMutField } from './interfaces';
import { mergeLocaleRes, setLocaleLanguage } from './locales/i18n';
import { useVizStore, withErrorReport, withTimeout, VizStoreWrapper } from './store';
import { getFieldIdentifier, parseErrorMessage } from './utils';
import { ErrorContext } from './utils/reportError';
import { getComputation } from './computation/clientComputation';
import { useCurrentMediaTheme } from './utils/media';
import { toJS } from 'mobx';
import Errorpanel from './components/errorpanel';
import { VizAppContext } from './store/context';
import { DEFAULT_DATASET } from './constants';
import DataTable from './components/dataTable';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';

export type BaseTableProps = IAppI18nProps &
    IErrorHandlerProps &
    IComputationContextProps &
    ITableSpecProps & {
        darkMode?: 'light' | 'dark';
    };

export const TableApp = observer(function VizApp(props: BaseTableProps) {
    const {
        computation,
        darkMode = 'light',
        i18nLang = 'en-US',
        i18nResources,
        computationTimeout = 60000,
        onError,
        pageSize = 20,
        themeConfig,
        themeKey,
        vizThemeConfig,
    } = props;

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

    const reportError = useCallback(
        (msg: string, code?: number) => {
            const err = new Error(`Error${code ? `(${code})` : ''}: ${msg}`);
            console.error(err);
            onError?.(err);
            if (code) {
                vizStore.updateShowErrorResolutionPanel(code, msg);
            }
        },
        [vizStore, onError]
    );

    const wrappedComputation = useMemo(
        () => (computation ? withErrorReport(withTimeout(computation, computationTimeout), (err) => reportError(parseErrorMessage(err), 501)) : async () => []),
        [reportError, computation, computationTimeout]
    );

    const metas = toJS(vizStore.meta);

    const [portal, setPortal] = useState<HTMLDivElement | null>(null);

    const datasets = Array.from(new Set(metas.map((x) => x.dataset ?? DEFAULT_DATASET)));
    const [dataset, setDataset] = useState(datasets[0] ?? DEFAULT_DATASET);
    const tableMeta = metas.filter((x) => dataset === (x.dataset ?? DEFAULT_DATASET));

    return (
        <ErrorContext value={{ reportError }}>
            <ErrorBoundary fallback={<div>Something went wrong</div>} onError={props.onError}>
                <VizAppContext
                    ComputationContext={wrappedComputation}
                    themeContext={darkMode}
                    vegaThemeContext={{ vizThemeConfig: vizThemeConfig ?? themeConfig ?? themeKey }}
                    portalContainerContext={portal}
                    DatasetNamesContext={props.datasetNames}
                >
                    <div className={`${darkMode === 'dark' ? 'dark' : ''} App font-sans bg-background text-foreground h-full m-0 p-0`}>
                        <div className="bg-background text-foreground h-full">
                            {datasets.length > 1 && (
                                <Tabs value={dataset} onValueChange={setDataset}>
                                    <TabsList>
                                        {datasets.map((ds) => (
                                            <TabsTrigger value={ds}>{props.datasetNames?.[ds] ?? ds}</TabsTrigger>
                                        ))}
                                    </TabsList>
                                </Tabs>
                            )}
                            <DataTable
                                onMetaChange={
                                    vizStore.onMetaChange
                                        ? (fid, fIndex, diffMeta) => {
                                            vizStore.updateCurrentDatasetMetas(getFieldIdentifier(metas[fIndex]), diffMeta);
                                        }
                                        : undefined
                                }
                                size={pageSize}
                                metas={tableMeta}
                                computation={wrappedComputation}
                                displayOffset={props.displayOffset}
                                hidePaginationAtOnepage={props.hidePaginationAtOnepage}
                                hideProfiling={props.hideProfiling}
                            />
                        </div>
                        <div ref={setPortal} />
                    </div>
                    <Errorpanel />
                </VizAppContext>
            </ErrorBoundary>
        </ErrorContext>
    );
});

export function TableAppWithContext(props: ITableProps & IComputationProps) {
    const { dark, dataSource, computation, onMetaChange, keepAlive, storeRef, defaultConfig, ...rest } = props;
    // @TODO remove deprecated props
    const appearance = props.appearance ?? props.dark;
    const data = props.data ?? props.dataSource;
    const fields = props.fields ?? props.rawFields ?? [];

    const {
        computation: safeComputation,
        safeMetas,
        onMetaChange: safeOnMetaChange,
    } = useMemo(() => {
        if (data) {
            return {
                safeMetas: fields,
                computation: getComputation(data),
                onMetaChange,
            };
        }
        return {
            safeMetas: fields,
            computation: props.computation,
            onMetaChange,
        };
    }, [fields, data ? data : props.computation, onMetaChange]);

    const darkMode = useCurrentMediaTheme(appearance);

    return (
        <VizStoreWrapper onMetaChange={safeOnMetaChange} meta={safeMetas} keepAlive={keepAlive} storeRef={storeRef} defaultConfig={defaultConfig}>
            <TableApp darkMode={darkMode} computation={safeComputation} {...rest} />
        </VizStoreWrapper>
    );
}
