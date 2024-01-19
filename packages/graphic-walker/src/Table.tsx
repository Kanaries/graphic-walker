import { observer } from 'mobx-react-lite';
import React, { useEffect, useCallback, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { IAppI18nProps, IErrorHandlerProps, IComputationContextProps, ITableProps, ITableSpecProps, IComputationProps } from './interfaces';
import { mergeLocaleRes, setLocaleLanguage } from './locales/i18n';
import { useVizStore, withErrorReport, withTimeout, ComputationContext, VizStoreWrapper } from './store';
import { parseErrorMessage } from './utils';
import { ErrorContext } from './utils/reportError';
import { guardDataKeys } from './utils/dataPrep';
import { getComputation } from './computation/clientComputation';
import DatasetTable from './components/dataTable';
import { useCurrentMediaTheme } from './utils/media';
import { toJS } from 'mobx';
import Errorpanel from './components/errorpanel';

export type BaseTableProps = IAppI18nProps &
    IErrorHandlerProps &
    IComputationContextProps &
    ITableSpecProps & {
        darkMode?: 'light' | 'dark';
    };

export const TableApp = observer(function VizApp(props: BaseTableProps) {
    const { computation, darkMode = 'light', i18nLang = 'en-US', i18nResources, computationTimeout = 60000, onError, pageSize = 20 } = props;

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
    
    return (
        <ErrorContext value={{ reportError }}>
            <ErrorBoundary fallback={<div>Something went wrong</div>} onError={props.onError}>
                <ComputationContext.Provider value={wrappedComputation}>
                    <div className={`${darkMode === 'dark' ? 'dark' : ''} App font-sans bg-white dark:bg-zinc-900 dark:text-white m-0 p-0`}>
                        <div className="bg-white dark:bg-zinc-900 dark:text-white">
                            <DatasetTable size={pageSize} metas={metas} computation={wrappedComputation} displayOffset={props.displayOffset} />
                        </div>
                    </div>
                    <Errorpanel />
                </ComputationContext.Provider>
            </ErrorBoundary>
        </ErrorContext>
    );
});

export function TableAppWithContext(props: ITableProps & IComputationProps) {
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

    const darkMode = useCurrentMediaTheme(props.dark);

    return (
        <div className={`${darkMode === 'dark' ? 'dark' : ''} App font-sans bg-white dark:bg-zinc-900 dark:text-white m-0 p-0`}>
            <VizStoreWrapper onMetaChange={props.onMetaChange} meta={safeMetas} keepAlive={props.keepAlive} storeRef={props.storeRef}>
                <TableApp
                    darkMode={darkMode}
                    i18nLang={props.i18nLang}
                    i18nResources={props.i18nResources}
                    computation={computation}
                    computationTimeout={props.computationTimeout}
                    onError={props.onError}
                />
            </VizStoreWrapper>
        </div>
    );
}
