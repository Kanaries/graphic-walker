import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import type { AgentMethodRequest } from '@kanaries/graphic-walker';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { GW_METHOD_NAMES, STATE_INSTRUCTIONS } from '../shared/state.ts';
import type { GraphicWalkerBridge } from './graphicWalkerBridge.ts';
import { GRAPHIC_WALKER_METHOD_REFERENCE } from './methodDocs.ts';

export type McpServerBinding = {
    close: () => Promise<void>;
    transport: StreamableHTTPServerTransport;
};

const METHOD_NAME_SET: ReadonlySet<string> = new Set<string>(GW_METHOD_NAMES as readonly string[]);

const DISPATCH_SCHEMA = z.object({
    method: z
        .string()
        .trim()
        .min(1, 'Method name required')
        .refine((value) => METHOD_NAME_SET.has(value), {
            message: 'Unknown GraphicWalker method',
        }),
    args: z.array(z.unknown()).default([]),
    targetVisId: z.string().trim().min(1).optional(),
});

const CREATE_VIZ_SCHEMA = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Visualization name cannot be empty')
        .max(120, 'Visualization name is too long')
        .optional(),
});

// MCP SDK's generic inference over large schemas can trigger "type instantiation is
// excessively deep" errors, so keep the runtime schema fully typed for local use
// while handing a reduced type to registerTool.
const MCP_DISPATCH_SCHEMA: z.ZodTypeAny = DISPATCH_SCHEMA;
const MCP_CREATE_VIZ_SCHEMA: z.ZodTypeAny = CREATE_VIZ_SCHEMA;

type DispatchInput = z.infer<typeof DISPATCH_SCHEMA>;
type CreateVizInput = z.infer<typeof CREATE_VIZ_SCHEMA>;

export const GRAPHIC_WALKER_DOCS = `${STATE_INSTRUCTIONS.trim()}\n\n---\n\n${GRAPHIC_WALKER_METHOD_REFERENCE}`;

export async function mountMcpServer(app: Express, bridge: GraphicWalkerBridge): Promise<McpServerBinding> {
    const mcpServer = new McpServer(
        {
            name: 'graphic-walker-mcp-dashboard',
            version: '0.1.0',
        },
        {
            instructions: STATE_INSTRUCTIONS.trim(),
        }
    );

    mcpServer.registerResource(
        'graphic-walker-state',
        'gw://state',
        {
            description: 'Live IGWAgentState snapshot captured from the active GraphicWalker canvas.',
            mimeType: 'application/json',
        },
        async () => {
            try {
                const snapshot = await bridge.fetchSnapshot({ fresh: true });
                const summary = {
                    capturedAt: snapshot.capturedAt,
                    totalVisualizations: snapshot.state.visLength,
                    activeVisIndex: snapshot.state.visIndex,
                    activeVisId: snapshot.state.visId,
                    activeChartName: snapshot.state.spec.name ?? null,
                };
                return {
                    contents: [
                        {
                            uri: 'gw://state',
                            text: JSON.stringify({ ...snapshot, summary }, null, 2),
                            mimeType: 'application/json',
                        },
                    ],
                };
            } catch (error) {
                return {
                    contents: [
                        {
                            uri: 'gw://state#error',
                            text: `Unable to capture GraphicWalker state: ${(error as Error).message}`,
                            mimeType: 'text/plain',
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    mcpServer.registerResource(
        'graphic-walker-viz-summary',
        'gw://viz',
        {
            description: 'Digest of how many visualizations exist and what the active chart contains.',
            mimeType: 'application/json',
        },
        async () => {
            try {
                const snapshot = await bridge.fetchSnapshot();
                const payload = {
                    capturedAt: snapshot.capturedAt,
                    totalVisualizations: snapshot.state.visLength,
                    activeVisualization: {
                        index: snapshot.state.visIndex,
                        visId: snapshot.state.visId,
                        name: snapshot.state.spec.name ?? null,
                        spec: snapshot.state.spec,
                    },
                };
                return {
                    contents: [
                        {
                            uri: 'gw://viz',
                            text: JSON.stringify(payload, null, 2),
                            mimeType: 'application/json',
                        },
                    ],
                };
            } catch (error) {
                return {
                    contents: [
                        {
                            uri: 'gw://viz#error',
                            text: `Unable to summarize GraphicWalker visualizations: ${(error as Error).message}`,
                            mimeType: 'text/plain',
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    mcpServer.registerResource(
        'graphic-walker-docs',
        'gw://docs',
        {
            description: 'GraphicWalker dispatch instructions plus per-method reference.',
            mimeType: 'text/markdown',
        },
        async () => ({
            contents: [
                {
                    uri: 'gw://docs',
                    text: GRAPHIC_WALKER_DOCS,
                    mimeType: 'text/markdown',
                },
            ],
        })
    );

    // @ts-ignore
    mcpServer.registerTool(
        'dispatch-graphic-walker-method',
        {
            title: 'Dispatch GraphicWalker method',
            description: 'Invoke any method exposed by `GWHandler.dispatchMethod` inside the preview tab.',
            inputSchema: MCP_DISPATCH_SCHEMA,
        },
        async (args) => {
            const parsed = DISPATCH_SCHEMA.safeParse(args ?? {});
            if (!parsed.success) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Invalid payload: ${parsed.error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
            const { method, args: methodArgs, targetVisId } = parsed.data as DispatchInput;
            const request: AgentMethodRequest = {
                method: method as AgentMethodRequest['method'],
                args: methodArgs as AgentMethodRequest['args'],
                targetVisId,
            };
            try {
                const result = await bridge.dispatchMethod(request);
                const snapshot = await bridge.fetchSnapshot();
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Dispatched ${request.method} on GraphicWalker (${methodArgs.length} argument(s)).`,
                        },
                        {
                            type: 'text',
                            text: JSON.stringify({ result, snapshot }, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: (error as Error).message,
                        },
                    ],
                };
            }
        }
    );

    // @ts-ignore
    mcpServer.registerTool(
        'create-graphic-walker-viz',
        {
            title: 'Create GraphicWalker visualization',
            description: 'Adds a blank visualization tab and returns its identifier for downstream method calls.',
            inputSchema: MCP_CREATE_VIZ_SCHEMA,
        },
        async (args) => {
            const parsed = CREATE_VIZ_SCHEMA.safeParse(args ?? {});
            if (!parsed.success) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Invalid payload: ${parsed.error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
            const { name } = parsed.data as CreateVizInput;
            try {
                const event = await bridge.createVisualization({ name });
                const snapshot = await bridge.fetchSnapshot();
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Created visualization ${event.visId}${event.name ? ` (${event.name})` : ''}.`,
                        },
                        {
                            type: 'text',
                            text: JSON.stringify({ event, snapshot }, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [
                        {
                            type: 'text',
                            text: (error as Error).message,
                        },
                    ],
                };
            }
        }
    );

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        retryInterval: 1500,
    });

    await mcpServer.connect(transport);

    const handler = async (req: Request, res: Response) => {
        try {
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error('[MCP] transport error', error);
            if (!res.headersSent) {
                res.status(500).json({ message: 'MCP server error' });
            }
        }
    };

    app.all('/mcp', handler);

    return {
        transport,
        close: () => mcpServer.close(),
    };
}
