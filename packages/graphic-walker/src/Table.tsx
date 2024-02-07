import { observer } from 'mobx-react-lite';
import React, { useEffect, useCallback, useMemo, useState } from 'react';
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
import { VizAppContext } from './store/context';

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

    return (
        <ErrorContext value={{ reportError }}>
            <ErrorBoundary fallback={<div>Something went wrong</div>} onError={props.onError}>
                <VizAppContext
                    ComputationContext={wrappedComputation}
                    themeContext={darkMode}
                    vegaThemeContext={{ themeConfig, themeKey }}
                    portalContainerContext={portal}
                >
                    <div className={`${darkMode === 'dark' ? 'dark' : ''} App font-sans bg-background text-foreground m-0 p-0`}>
                        <div className="bg-background text-foreground">
                            <DatasetTable size={pageSize} metas={metas} computation={wrappedComputation} displayOffset={props.displayOffset} />
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
    const { dark, dataSource, computation, onMetaChange, fieldKeyGuard, keepAlive, storeRef, defaultConfig, ...rest } = props;
    const {
        computation: safeComputation,
        safeMetas,
        onMetaChange: safeOnMetaChange,
    } = useMemo(() => {
        if (props.dataSource) {
            if (props.fieldKeyGuard) {
                const { safeData, safeMetas } = guardDataKeys(props.dataSource, props.rawFields);
                return {
                    safeMetas,
                    computation: getComputation(safeData),
                    onMetaChange: (safeFID, meta) => {
                        const index = safeMetas.findIndex((x) => x.fid === safeFID);
                        if (index >= 0) {
                            props.onMetaChange?.(props.rawFields[index].fid, meta);
                        }
                    },
                };
            }
            return {
                safeMetas: props.rawFields,
                computation: getComputation(props.dataSource),
                onMetaChange: props.onMetaChange,
            };
        }
        return {
            safeMetas: props.rawFields,
            computation: props.computation,
            onMetaChange: props.onMetaChange,
        };
    }, [props.rawFields, props.dataSource ? props.dataSource : props.computation, props.fieldKeyGuard, props.onMetaChange]);

    const darkMode = useCurrentMediaTheme(props.dark);

    return (
        <VizStoreWrapper onMetaChange={safeOnMetaChange} meta={safeMetas} keepAlive={keepAlive} storeRef={storeRef} defaultConfig={defaultConfig}>
            <TableApp darkMode={darkMode} computation={safeComputation} {...rest} />
        </VizStoreWrapper>
    );
}
