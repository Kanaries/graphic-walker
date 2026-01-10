import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';

import type { AgentMethodRequest, AgentMethodResult, AgentVizEvent } from '@kanaries/graphic-walker';
import { WebSocketServer, type RawData, WebSocket } from 'ws';

import type { ClientToServerMessage, GraphicWalkerSnapshot, ServerToClientMessage } from '../shared/state.ts';

const METHOD_TIMEOUT_MS = Number(process.env.GW_METHOD_TIMEOUT_MS ?? 15_000);
const SNAPSHOT_TIMEOUT_MS = Number(process.env.GW_SNAPSHOT_TIMEOUT_MS ?? 6_000);

export type ClientPresenceListener = (details: { clients: number }) => void;

type PendingRequest<T> = {
    resolve: (value: T) => void;
    reject: (reason: Error) => void;
    timer: NodeJS.Timeout;
};

type ActiveClient = {
    socket: WebSocket;
    name: string;
    version: string;
    connectedAt: string;
};

export type GraphicWalkerBridge = {
    dispatchMethod(request: AgentMethodRequest): Promise<AgentMethodResult>;
    fetchSnapshot(options?: { fresh?: boolean }): Promise<GraphicWalkerSnapshot>;
    getSnapshot(): GraphicWalkerSnapshot | null;
    getStatus(): {
        clients: number;
        activeClient?: Omit<ActiveClient, 'socket'>;
        lastSnapshotAt?: string;
    };
    createVisualization(options?: { name?: string }): Promise<AgentVizEvent>;
    onClientPresenceChange(listener: ClientPresenceListener): () => void;
    close(): Promise<void>;
};

export function makeGraphicWalkerBridge(httpServer: HttpServer): GraphicWalkerBridge {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
    const sockets = new Set<WebSocket>();
    const presenceListeners = new Set<ClientPresenceListener>();
    const pendingSnapshots = new Map<string, PendingRequest<GraphicWalkerSnapshot>>();
    const pendingMethods = new Map<string, PendingRequest<AgentMethodResult>>();
    const pendingVizCreations = new Map<string, PendingRequest<AgentVizEvent>>();
    let latestSnapshot: GraphicWalkerSnapshot | null = null;
    let activeClient: ActiveClient | null = null;
    let isClosed = false;

    const notifyPresence = () => {
        const payload = { clients: sockets.size };
        for (const listener of presenceListeners) {
            listener(payload);
        }
    };

    const dispose = <T>(collection: Map<string, PendingRequest<T>>, reason: string) => {
        for (const [id, pending] of collection) {
            clearTimeout(pending.timer);
            pending.reject(new Error(reason));
            collection.delete(id);
        }
    };

    const ensureActiveSocket = () => {
        if (!activeClient || activeClient.socket.readyState !== WebSocket.OPEN) {
            throw new Error('GraphicWalker preview is offline. Open the dashboard to continue.');
        }
        return activeClient.socket;
    };

    const send = (message: ServerToClientMessage) => {
        const socket = ensureActiveSocket();
        socket.send(JSON.stringify(message));
    };

    const registerPending = <T>(
        collection: Map<string, PendingRequest<T>>,
        id: string,
        resolve: (value: T) => void,
        reject: (reason: Error) => void,
        timeoutMs: number,
        timeoutMessage: string
    ) => {
        const timer = setTimeout(() => {
            collection.delete(id);
            reject(new Error(timeoutMessage));
        }, timeoutMs);
        collection.set(id, { resolve, reject, timer });
    };

    const fulfill = <T>(collection: Map<string, PendingRequest<T>>, id: string, value: T) => {
        const pending = collection.get(id);
        if (!pending) return;
        clearTimeout(pending.timer);
        collection.delete(id);
        pending.resolve(value);
    };

    const handleHello = (socket: WebSocket, message: Extract<ClientToServerMessage, { type: 'hello' }>) => {
        activeClient = {
            socket,
            name: message.clientName,
            version: message.version,
            connectedAt: new Date().toISOString(),
        };
        dispose(pendingSnapshots, 'GraphicWalker client restarted. State request cancelled.');
        dispose(pendingMethods, 'GraphicWalker client restarted. Method dispatch cancelled.');
        dispose(pendingVizCreations, 'GraphicWalker client restarted. Visualization request cancelled.');
        console.log(`[gw-bridge] client ready: ${message.clientName} (${message.version})`);
    };

    const handleStateUpdate = (socket: WebSocket, message: Extract<ClientToServerMessage, { type: 'state:update' }>) => {
        if (!activeClient || socket !== activeClient.socket) {
            return;
        }
        latestSnapshot = {
            state: message.state,
            capturedAt: new Date().toISOString(),
        };
        if (message.requestId) {
            fulfill(pendingSnapshots, message.requestId, latestSnapshot);
        }
    };

    const handleMethodResult = (socket: WebSocket, message: Extract<ClientToServerMessage, { type: 'method:result' }>) => {
        if (!activeClient || socket !== activeClient.socket) {
            return;
        }
        fulfill(pendingMethods, message.requestId, message.result);
    };

    const handleVizCreateResult = (socket: WebSocket, message: Extract<ClientToServerMessage, { type: 'viz:create:result' }>) => {
        if (!activeClient || socket !== activeClient.socket) {
            return;
        }
        const pending = pendingVizCreations.get(message.requestId);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timer);
        pendingVizCreations.delete(message.requestId);
        if (!message.success || !message.event) {
            pending.reject(new Error(message.message ?? 'Failed to create visualization.'));
            return;
        }
        pending.resolve(message.event);
    };

    const handleLog = (_socket: WebSocket, message: Extract<ClientToServerMessage, { type: 'log' }>) => {
        console.log(`[gw-client] ${message.message}`);
    };

    const handleMessage = (socket: WebSocket, raw: RawData) => {
        let message: ClientToServerMessage;
        try {
            message = JSON.parse(raw.toString()) as ClientToServerMessage;
        } catch (error) {
            console.warn('[gw-bridge] failed to parse client payload', error);
            return;
        }
        if (message.type === 'hello') {
            handleHello(socket, message);
            return;
        }
        if (message.type === 'state:update') {
            handleStateUpdate(socket, message);
            return;
        }
        if (message.type === 'method:result') {
            handleMethodResult(socket, message);
            return;
        }
        if (message.type === 'viz:create:result') {
            handleVizCreateResult(socket, message);
            return;
        }
        if (message.type === 'log') {
            handleLog(socket, message);
            return;
        }
        console.warn('[gw-bridge] unknown client message', message);
    };

    const handleDisconnect = (socket: WebSocket) => {
        sockets.delete(socket);
        if (activeClient?.socket === socket) {
            activeClient = null;
            dispose(pendingSnapshots, 'GraphicWalker client disconnected.');
            dispose(pendingMethods, 'GraphicWalker client disconnected.');
        }
        notifyPresence();
    };

    wss.on('connection', (socket) => {
        sockets.add(socket);
        notifyPresence();
        socket.send(
            JSON.stringify({
                type: 'log',
                message: 'Connected to MCP GraphicWalker bridge. Send a hello frame to take control.',
            } satisfies ServerToClientMessage)
        );
        socket.on('message', (payload) => handleMessage(socket, payload));
        socket.on('close', () => handleDisconnect(socket));
        socket.on('error', (error) => console.warn('[gw-bridge] socket error', error));
    });

    wss.on('error', (error) => {
        console.error('[gw-bridge] WebSocket server error', error);
    });

    const fetchSnapshot: GraphicWalkerBridge['fetchSnapshot'] = async ({ fresh = false } = {}) => {
        if (!fresh && latestSnapshot) {
            return latestSnapshot;
        }
        const requestId = randomUUID();
        return await new Promise<GraphicWalkerSnapshot>((resolve, reject) => {
            try {
                registerPending(pendingSnapshots, requestId, resolve, reject, SNAPSHOT_TIMEOUT_MS, 'Timed out waiting for browser state.');
                send({ type: 'state:pull', requestId });
            } catch (error) {
                pendingSnapshots.delete(requestId);
                reject(error as Error);
            }
        });
    };

    const dispatchMethod: GraphicWalkerBridge['dispatchMethod'] = async (request) => {
        const requestId = randomUUID();
        return await new Promise<AgentMethodResult>((resolve, reject) => {
            try {
                registerPending(pendingMethods, requestId, resolve, reject, METHOD_TIMEOUT_MS, 'Method dispatch timed out waiting for browser.');
                send({ type: 'method:dispatch', requestId, payload: request });
            } catch (error) {
                pendingMethods.delete(requestId);
                reject(error as Error);
            }
        });
    };

    const createVisualization: GraphicWalkerBridge['createVisualization'] = async (options = {}) => {
        const requestId = randomUUID();
        return await new Promise<AgentVizEvent>((resolve, reject) => {
            try {
                registerPending(
                    pendingVizCreations,
                    requestId,
                    resolve,
                    reject,
                    METHOD_TIMEOUT_MS,
                    'Visualization creation timed out waiting for browser.'
                );
                send({ type: 'viz:create', requestId, payload: { name: options.name?.trim() ? options.name : undefined } });
            } catch (error) {
                pendingVizCreations.delete(requestId);
                reject(error as Error);
            }
        });
    };

    const close = async () => {
        if (isClosed) return;
        isClosed = true;
        dispose(pendingSnapshots, 'GraphicWalker bridge closed.');
        dispose(pendingMethods, 'GraphicWalker bridge closed.');
        dispose(pendingVizCreations, 'GraphicWalker bridge closed.');
        for (const socket of sockets) {
            try {
                socket.close(1001, 'Server shutting down');
            } catch (error) {
                console.warn('[gw-bridge] failed to close socket', error);
            }
        }
        await new Promise<void>((resolve) => wss.close(() => resolve()));
    };

    return {
        dispatchMethod,
        createVisualization,
        fetchSnapshot,
        getSnapshot: () => latestSnapshot,
        getStatus: () => ({
            clients: sockets.size,
            activeClient: activeClient ? { name: activeClient.name, version: activeClient.version, connectedAt: activeClient.connectedAt } : undefined,
            lastSnapshotAt: latestSnapshot?.capturedAt,
        }),
        onClientPresenceChange: (listener) => {
            presenceListeners.add(listener);
            listener({ clients: sockets.size });
            return () => {
                presenceListeners.delete(listener);
            };
        },
        close,
    };
}
