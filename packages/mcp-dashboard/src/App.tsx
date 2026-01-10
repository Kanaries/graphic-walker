import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentMethodRequest, AgentMethodResult, AgentVizEvent, IGWAgentState, IGWHandler, IMutField, IChart } from "@kanaries/graphic-walker";
import { GraphicWalker, createChartFromFields } from "@kanaries/graphic-walker";
import type { ClientToServerMessage, ServerToClientMessage } from "../shared/state.ts";
import "./index.css";

const websocketUrl = (() => {
    if (typeof window === "undefined") return "ws://localhost:4399/ws";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
})();

type SampleDatasetResponse = {
    name: string;
    description: string;
    data: Record<string, string | number>[];
    fields: IMutField[];
};

type WebSocketState = "idle" | "connecting" | "open" | "closed";

export default function App() {
    const [dataSource, setDataSource] = useState<SampleDatasetResponse | null>(null);
    const [datasetError, setDatasetError] = useState<string | null>(null);
    const [isFetchingDataset, setIsFetchingDataset] = useState(true);
    const [wsStatus, setWsStatus] = useState<WebSocketState>("idle");
    const [activity, setActivity] = useState("Waiting for GraphicWalker to load...");
    const socketRef = useRef<WebSocket | null>(null);
    const gwRef = useRef<IGWHandler | null>(null);
    const lastSnapshotRef = useRef<IGWAgentState | null>(null);
    const snapshotRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [handlerReadyTick, setHandlerReadyTick] = useState(0);
    const handshakeSentRef = useRef(false);

    useEffect(() => {
        const abortController = new AbortController();
        setIsFetchingDataset(true);
        fetch("/api/sample-dataset", { signal: abortController.signal })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to load dataset: ${res.status}`);
                }
                return res.json();
            })
            .then((payload: SampleDatasetResponse) => {
                setDataSource(payload);
                setDatasetError(null);
                setActivity(`Loaded dataset: ${payload.name}`);
            })
            .catch(error => {
                if (abortController.signal.aborted) return;
                setDatasetError((error as Error).message);
                setActivity("Dataset request failed.");
            })
            .finally(() => {
                if (!abortController.signal.aborted) {
                    setIsFetchingDataset(false);
                }
            });

        return () => {
            abortController.abort();
        };
    }, []);
    const sendMessage = useCallback((payload: ClientToServerMessage) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        socket.send(JSON.stringify(payload));
    }, []);

    const publishSnapshot = useCallback(
        function publishSnapshot(requestId?: string) {
            const handler = gwRef.current;
            if (!handler) {
                return;
            }
            if (snapshotRetryRef.current) {
                clearTimeout(snapshotRetryRef.current);
                snapshotRetryRef.current = null;
            }
            try {
                const state = handler.getAgentState();
                lastSnapshotRef.current = state;
                sendMessage({
                    type: "state:update",
                    state,
                    requestId,
                });
                setActivity(`Published state captured at ${new Date(state.timestamp).toLocaleTimeString()}`);
            } catch (error) {
                const message = (error as Error).message ?? "Unknown state capture error";
                const isBridgeNotReady = message.toLowerCase().includes("agent bridge not ready");
                if (requestId) {
                    if (lastSnapshotRef.current) {
                        sendMessage({
                            type: "state:update",
                            state: lastSnapshotRef.current,
                            requestId,
                        });
                    } else {
                        sendMessage({
                            type: "log",
                            message: `State request ${requestId} failed: ${message}`,
                        });
                    }
                } else if (!snapshotRetryRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
                    snapshotRetryRef.current = setTimeout(() => {
                        publishSnapshot();
                    }, 300);
                }
                setActivity(isBridgeNotReady ? "Waiting for GraphicWalker agent bridge…" : `State capture failed: ${message}`);
            }
        },
        [sendMessage]
    );

    useEffect(() => {
        return () => {
            if (snapshotRetryRef.current) {
                clearTimeout(snapshotRetryRef.current);
            }
        };
    }, []);

    const dispatchRemoteMethod = useCallback(
        async (requestId: string, request: AgentMethodRequest) => {
            const handler = gwRef.current;
            let result: AgentMethodResult;
            if (!handler) {
                result = {
                    success: false,
                    error: {
                        code: "ERR_AGENT_NOT_READY",
                        message: "GraphicWalker handler is not ready yet.",
                    },
                };
            } else {
                try {
                    result = await handler.dispatchMethod(request);
                } catch (error) {
                    result = {
                        success: false,
                        error: {
                            code: "ERR_EXECUTION_FAILED",
                            message: (error as Error).message,
                        },
                    };
                }
            }
            sendMessage({ type: "method:result", requestId, result });
            if (result.success) {
                setActivity(`Executed remote method: ${request.method}`);
                publishSnapshot();
            }
        },
        [publishSnapshot, sendMessage]
    );

    const createVisualization = useCallback(
        (requestId: string, payload?: { name?: string }) => {
            const handler = gwRef.current;
            if (!handler || typeof handler.applyVizEvent !== "function" || !dataSource?.fields?.length) {
                sendMessage({
                    type: "viz:create:result",
                    requestId,
                    success: false,
                    message: "GraphicWalker handler is not ready to create a visualization.",
                });
                setActivity("Visualization request failed – handler not ready.");
                return;
            }
            try {
                const nextIndex = Math.max(handler.chartCount, 0);
                const chartName = payload?.name?.trim()?.length ? payload.name : `Chart ${nextIndex + 1}`;
                const chart = createChartFromFields(dataSource.fields, { name: chartName });
                const eventPayload: AgentVizEvent = {
                    type: "viz",
                    action: "add",
                    visId: chart.visId,
                    index: nextIndex,
                    name: chart.name,
                    chart,
                    source: "api",
                };
                handler.applyVizEvent(eventPayload);
                sendMessage({ type: "viz:create:result", requestId, success: true, event: eventPayload });
                publishSnapshot();
                setActivity(`Created visualization ${chart.name ?? chart.visId}.`);
            } catch (error) {
                sendMessage({
                    type: "viz:create:result",
                    requestId,
                    success: false,
                    message: (error as Error).message ?? "Failed to create visualization",
                });
                setActivity("Visualization request failed – see logs for details.");
            }
        },
        [dataSource?.fields, publishSnapshot, sendMessage]
    );

    const handleServerMessage = useCallback(
        (event: MessageEvent<string>) => {
            let payload: ServerToClientMessage;
            try {
                payload = JSON.parse(event.data) as ServerToClientMessage;
            } catch (error) {
                console.warn("Failed to parse server payload", error);
                return;
            }
            if (payload.type === "log") {
                setActivity(payload.message);
                return;
            }
            if (payload.type === "state:pull") {
                publishSnapshot(payload.requestId);
                return;
            }
            if (payload.type === "method:dispatch") {
                void dispatchRemoteMethod(payload.requestId, payload.payload);
                return;
            }
            if (payload.type === "viz:create") {
                createVisualization(payload.requestId, payload.payload);
                return;
            }
        },
        [createVisualization, dispatchRemoteMethod, publishSnapshot]
    );

    useEffect(() => {
        if (!dataSource) {
            return;
        }
        const socket = new WebSocket(websocketUrl);
        socketRef.current = socket;
        handshakeSentRef.current = false;
        setWsStatus("connecting");

        const handleOpen = () => {
            setWsStatus("open");
            setActivity("Connected to MCP bridge. Waiting for handler...");
        };
        const handleClose = () => {
            setWsStatus("closed");
            handshakeSentRef.current = false;
            setActivity("WebSocket connection closed.");
        };
        const handleError = (error: Event) => {
            console.warn("WebSocket error", error);
            setActivity("WebSocket error. Check server logs.");
        };

        socket.addEventListener("open", handleOpen);
        socket.addEventListener("close", handleClose);
        socket.addEventListener("error", handleError);
        socket.addEventListener("message", handleServerMessage);

        return () => {
            socket.removeEventListener("open", handleOpen);
            socket.removeEventListener("close", handleClose);
            socket.removeEventListener("error", handleError);
            socket.removeEventListener("message", handleServerMessage);
            socket.close();
            if (socketRef.current === socket) {
                socketRef.current = null;
            }
            setWsStatus("idle");
        };
    }, [dataSource, handleServerMessage]);

    useEffect(() => {
        if (!dataSource) return;
        if (wsStatus !== "open") return;
        if (!gwRef.current) return;
        if (handshakeSentRef.current) return;

        sendMessage({
            type: "hello",
            clientName: `${dataSource.name} Preview`,
            version: `1.0`,
        });
        handshakeSentRef.current = true;
        publishSnapshot();
        setActivity("Handshake complete. Sharing GraphicWalker state.");
    }, [dataSource, wsStatus, handlerReadyTick, publishSnapshot, sendMessage]);

    useEffect(() => {
        const handler = gwRef.current;
        if (!handler) return;
        return handler.onAgentEvent(event => {
            if (event.type === "method" && event.status === "success") {
                publishSnapshot();
                setActivity(`User ran ${event.method}`);
                return;
            }
            if (event.type === "viz") {
                publishSnapshot();
                setActivity(`Visualization ${event.action}`);
            }
        });
    }, [handlerReadyTick, publishSnapshot]);

    useEffect(() => {
        let raf: number | null = null;
        let cancelled = false;

        const checkHandler = () => {
            if (cancelled) return;
            const handler = gwRef.current;
            if (!handler) {
                raf = requestAnimationFrame(checkHandler);
                return;
            }
            setHandlerReadyTick(tick => tick + 1);
            setActivity("GraphicWalker mounted.");
            raf = null;
        };

        checkHandler();

        return () => {
            cancelled = true;
            if (raf !== null) {
                cancelAnimationFrame(raf);
            }
        };
    }, []);

    const initialCharts = useMemo<IChart[] | undefined>(() => {
        if (!dataSource?.fields?.length) return undefined;
        return [createChartFromFields(dataSource.fields, { name: "Agent Preview" })];
    }, [dataSource?.fields]);

    const statusLabel = useMemo(() => {
        if (datasetError) return "Dataset error";
        if (isFetchingDataset) return "Loading dataset...";
        if (wsStatus === "connecting") return "Connecting to MCP bridge...";
        if (wsStatus === "open") return "Live sync ready";
        if (wsStatus === "closed") return "Connection lost";
        return "Idle";
    }, [datasetError, isFetchingDataset, wsStatus]);

    return (
        <div className="gw-shell">
            <header className="gw-header">
                <div>
                    <p className="gw-kicker">GraphicWalker Preview</p>
                    <h1>MCP Dashboard Bridge</h1>
                    <p className="gw-subtitle">
                        The Vite client now renders a single GraphicWalker canvas. Every edit is streamed to Express/WebSocket so MCP tools mirror the live
                        state.
                    </p>
                </div>
                <div className={`gw-status gw-status-${wsStatus}`}>
                    <span className="gw-status-dot" />
                    <span>{statusLabel}</span>
                </div>
            </header>

            <main className="gw-stage">
                <section className="gw-panel">
                    <div className="gw-panel-head">
                        <div>
                            <h2>{dataSource?.name ?? "Loading dataset..."}</h2>
                            <p>{dataSource?.description ?? "Fetching sample dataset and booting GraphicWalker."}</p>
                        </div>
                        <div className="gw-meta">
                            <span>{`Dashboard 1.0`}</span>
                            <span>{wsStatus === "open" ? "WS linked" : "WS pending"}</span>
                        </div>
                    </div>
                    <div className="gw-canvas">
                        {datasetError && <div className="gw-error">{datasetError}</div>}
                        {!datasetError && !dataSource && <div className="gw-loading">Loading dataset…</div>}
                        {dataSource && (
                            <GraphicWalker
                                ref={gwRef}
                                vizThemeConfig="g2"
                                data={dataSource.data}
                                fields={dataSource.fields}
                                chart={initialCharts}
                            />
                        )}
                    </div>
                </section>

                <aside className="gw-sidebar">
                    <div className="gw-activity">
                        <h3>Activity</h3>
                        <p>{activity}</p>
                    </div>
                    <div className="gw-help">
                        <h3>How it works</h3>
                        <ol>
                            <li>Load the bundled sample dataset.</li>
                            <li>Mount a single GraphicWalker component.</li>
                            <li>Handshake with the MCP bridge via WebSocket.</li>
                            <li>Publish snapshots + dispatch results for every change.</li>
                        </ol>
                    </div>
                </aside>
            </main>
        </div>
    );
}
