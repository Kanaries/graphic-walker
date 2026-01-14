import type { AgentMethodName, AgentMethodRequest, AgentMethodResult, AgentVizEvent, IGWAgentState } from '@kanaries/graphic-walker';

export type GraphicWalkerSnapshot = {
    state: IGWAgentState;
    capturedAt: string;
};

export type ServerToClientMessage =
    | { type: 'method:dispatch'; requestId: string; payload: AgentMethodRequest }
    | { type: 'state:pull'; requestId: string }
    | { type: 'viz:create'; requestId: string; payload?: { name?: string } }
    | { type: 'log'; message: string };

export type ClientToServerMessage =
    | { type: 'hello'; clientName: string; version: string }
    | { type: 'state:update'; state: IGWAgentState; requestId?: string }
    | { type: 'method:result'; requestId: string; result: AgentMethodResult }
    | { type: 'viz:create:result'; requestId: string; success: boolean; event?: AgentVizEvent; message?: string }
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
This MCP endpoint bridges a live GraphicWalker canvas. Everything rendered in the preview tab is powered by the same handler humans interact with, so agents and users are editing a single source of truth.

Resources:
    - \`gw://state\`: Latest \`IGWAgentState\` snapshot (includes \`visLength\`, current \`visId\`, and the active chart spec).
    - \`gw://viz\`: Quick summary of how many charts exist, which chart is selected, and the serialized spec of the active visualization.
    - \`gw://docs\`: Detailed reference for every GraphicWalker agent method, including arguments and behavior.

Tools:
    - \`dispatch-graphic-walker-method\`: Call any method exposed on \`GWHandler.dispatchMethod\`. Provide the method name, positional arguments, and (optionally) \`targetVisId\` to address a specific visualization tab.
    - \`create-graphic-walker-viz\`: Append a blank visualization tab and return its \`visId\`. Use the dispatch tool with \`targetVisId\` to configure the new chart.

Chart Construction Tips:
    1. Use \`cloneField\` to move dimensions (e.g., region, segment) from \`dimensions\` into \`rows\` or \`columns\`.
    2. Clone measures (e.g., sales, profit) from \`measures\` into \`rows\`, \`columns\`, \`color\`, \`size\`, etc.
    3. Control the mark type via \`setConfig("geoms", ["bar" | "line" | "point" | "area" | …])\`.
    Example – Sales by region bar chart:
        - \`cloneField("dimensions", 0, "rows", 0, "region")\`
        - \`cloneField("measures", 0, "columns", 0, "sales")\`

All tool invocations travel over WebSocket, execute inside the browser via \`GWRef.dispatchMethod\`, and are acknowledged alongside a fresh state snapshot. If the preview is offline the bridge responds with clear errors so the agent can retry once the dashboard restarts.
`;