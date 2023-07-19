import React, { createContext, forwardRef, useImperativeHandle, type ForwardedRef, useContext, type ComponentType, type RefObject, type ForwardRefExoticComponent, type PropsWithoutRef, type RefAttributes, useRef } from "react";
import type { IChartExportResult, IGWHandler, IGWHandlerInsider, IRenderStatus } from "../interfaces";

const AppRootContext = createContext<ForwardedRef<IGWHandlerInsider>>(null);

export const useAppRootContext = (): RefObject<IGWHandlerInsider> => {
    const context = useContext(AppRootContext);
    if (context && 'current' in context) {
        return context;
    }
    return {
        current: null,
    };
};

const WithNonNullableRef = <P extends {}, T>(Component: ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>> => {
    return forwardRef<T, P>((props, propsRef) => {
        const selfRef = useRef<T>(null);

        // @ts-ignore
        return <Component {...props} ref={propsRef ?? selfRef} />;
    });
};

const AppRoot = WithNonNullableRef(forwardRef<IGWHandlerInsider, { children: any }>(({ children }, ref) => {
    useImperativeHandle(ref, () => {
        let renderStatus: IRenderStatus = 'idle';
        let onRenderStatusChangeHandlers: ((status: IRenderStatus) => void)[] = [];
        const addRenderStatusChangeListener = (cb: typeof onRenderStatusChangeHandlers[number]): (() => void) => {
            onRenderStatusChangeHandlers.push(cb);
            const dispose = () => {
                onRenderStatusChangeHandlers = onRenderStatusChangeHandlers.filter(which => which !== cb);
            };
            return dispose;
        };
        const updateRenderStatus = (status: IRenderStatus) => {
            if (renderStatus === status) {
                return;
            }
            renderStatus = status;
            onRenderStatusChangeHandlers.forEach(cb => cb(renderStatus));
        };
        return {
            get renderStatus() {
                return renderStatus;
            },
            onRenderStatusChange: addRenderStatusChangeListener,
            updateRenderStatus,
            chartCount: 1,
            chartIndex: 0,
            openChart() {},
            exportChart: (async (mode: IChartExportResult['mode'] = 'svg') => {
                return {
                    mode,
                    title: '',
                    nCols: 0,
                    nRows: 0,
                    charts: [],
                    container: () => null,
                };
            }) as IGWHandler['exportChart'],
            exportChartList: (async function * exportChartList (mode: IChartExportResult['mode'] = 'svg') {
                yield {
                    mode,
                    total: 1,
                    completed: 0,
                    index: 0,
                    data: {
                        mode,
                        title: '',
                        nCols: 0,
                        nRows: 0,
                        charts: [],
                        container: () => null,
                    },
                    hasNext: false,
                };
            }) as IGWHandler['exportChartList'],
        };
    }, []);

    return (
        <AppRootContext.Provider value={ref}>
            {children}
        </AppRootContext.Provider>
    );
}));

export const withAppRoot = <P extends object>(Component: ComponentType<any>) => {
    return (props: P) => {
        return (
            <AppRoot>
                <Component {...props} />
            </AppRoot>
        );
    };
};

export default AppRoot;
