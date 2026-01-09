import React, { createContext, forwardRef, useImperativeHandle, type ForwardedRef, useContext, type ComponentType, type RefObject } from "react";
import type { AgentEvent, AgentMethodResult, IChartExportResult, IGWHandler, IGWHandlerInsider, IRenderStatus } from "../interfaces";

const AppRootContext = createContext<ForwardedRef<IGWHandlerInsider>>(null);

export const useAppRootContext = (): RefObject<IGWHandlerInsider | null> => {
    const context = useContext(AppRootContext);
    if (context && 'current' in context) {
        return context;
    }
    return {
        current: null,
    };
};

const AppRoot = forwardRef<IGWHandlerInsider, { children: any }>(({ children }, ref) => {
    useImperativeHandle(ref, () => {
        let renderStatus: IRenderStatus = 'idle';
        let onRenderStatusChangeHandlers: ((status: IRenderStatus) => void)[] = [];
        let agentEventHandlers: ((event: AgentEvent) => void)[] = [];
        const addRenderStatusChangeListener = (cb: typeof onRenderStatusChangeHandlers[number]): (() => void) => {
            onRenderStatusChangeHandlers.push(cb);
            const dispose = () => {
                onRenderStatusChangeHandlers = onRenderStatusChangeHandlers.filter(which => which !== cb);
            };
            return dispose;
        };
        const addAgentEventListener = (cb: typeof agentEventHandlers[number]): (() => void) => {
            agentEventHandlers.push(cb);
            const dispose = () => {
                agentEventHandlers = agentEventHandlers.filter(which => which !== cb);
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
        const emitAgentEvent = (event: AgentEvent) => {
            agentEventHandlers.forEach((cb) => cb(event));
        };
        const notReadyResult: AgentMethodResult = {
            success: false,
            error: {
                code: 'ERR_AGENT_NOT_READY',
                message: 'Agent bridge not ready',
            },
        };
        const dispatchMethod: IGWHandler['dispatchMethod'] = async () => notReadyResult;

        return {
            get renderStatus() {
                return renderStatus;
            },
            onRenderStatusChange: addRenderStatusChangeListener,
            onAgentEvent: addAgentEventListener,
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
            getAgentState: () => {
                throw new Error('Agent bridge not ready');
            },
            dispatchMethod,
            updatePresence: () => {},
            clearPresence: () => {},
            emitAgentEvent,
        };
    }, []);

    return (
        <AppRootContext.Provider value={ref}>
            {children}
        </AppRootContext.Provider>
    );
});

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
