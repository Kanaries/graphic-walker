import type { AgentMethodName, AgentMethodRequest, AgentMethodResult, IGWAgentState } from '@kanaries/graphic-walker';

export type GraphicWalkerSnapshot = {
    state: IGWAgentState;
    capturedAt: string;
};

export type ServerToClientMessage =
    | { type: 'method:dispatch'; requestId: string; payload: AgentMethodRequest }
    | { type: 'state:pull'; requestId: string }
    | { type: 'log'; message: string };

export type ClientToServerMessage =
    | { type: 'hello'; clientName: string; version: string }
    | { type: 'state:update'; state: IGWAgentState; requestId?: string }
    | { type: 'method:result'; requestId: string; result: AgentMethodResult }
    | { type: 'log'; message: string };

export const GW_METHOD_NAMES = [
    'setConfig',
    'removeField',
    'reorderField',
    'moveField',
    'cloneField',
    'createBinlogField',
    'appendFilter',
    'modFilter',
    'writeFilter',
    'setName',
    'applySort',
    'transpose',
    'setLayout',
    'setFieldAggregator',
    'setGeoData',
    'setCoordSystem',
    'createDateDrillField',
    'createDateFeatureField',
    'changeSemanticType',
    'setFilterAggregator',
    'addFoldField',
    'upsertPaintField',
    'addSQLComputedField',
    'removeAllField',
    'editAllField',
    'replaceWithNLPQuery',
] as const satisfies readonly [AgentMethodName, ...AgentMethodName[]];

export type GraphicWalkerMethodName = (typeof GW_METHOD_NAMES)[number];

export const STATE_INSTRUCTIONS = `
This MCP endpoint bridges a live GraphicWalker canvas. Everything you see in the Vite preview is driven by a single handler instance, so agents and humans are always manipulating the same specification.

Resources:
    - \`gw://state\`: Latest \`IGWAgentState\` snapshot captured from the browser client. When a fresh sample is required the server requests one over WebSocket before responding.
    - \`gw://docs\`: Detailed reference for every GraphicWalker agent method, including arguments and behavior.

Tooling:
    - \`dispatch-graphic-walker-method\`: Call any method exposed on \`IGWHandler.dispatchMethod\`. Provide the method name, its positional arguments, and (optionally) \`targetVisId\` to address a different visualization tab.

Each tool invocation is relayed to the browser via WebSocket, executed through \`GWRef.dispatchMethod\`, and then acknowledged back to MCP together with an updated state snapshot.

If the dashboard is offline, method dispatches and state reads will fail with a clear error so the agent can retry after a human restarts the preview.
`;