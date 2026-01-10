import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import open from 'open';
import { createServer as createViteServer } from 'vite';
import { GRAPHIC_WALKER_DOCS, mountMcpServer } from './mcpServer.ts';
import { makeGraphicWalkerBridge } from './graphicWalkerBridge.ts';
import { SAMPLE_DATASET } from './sampleData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distDir = resolve(projectRoot, 'dist');

const PORT = Number(process.env.MCP_DASHBOARD_PORT ?? 4399);
const HOST = process.env.MCP_DASHBOARD_HOST ?? '127.0.0.1';
const SHUTDOWN_DELAY_MS = 500;

async function registerFrontend(app: express.Express) {
    if (process.env.NODE_ENV === 'production') {
        app.use(express.static(distDir));
        app.get('*', (req: Request, res: Response, next: NextFunction) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/mcp')) {
                return next();
            }
            res.sendFile(join(distDir, 'index.html'));
        });
        return;
    }

    const vite = await createViteServer({
        root: projectRoot,
        server: {
            middlewareMode: true,
        },
        appType: 'custom',
    });
    app.use(vite.middlewares);

    const indexHtmlPath = join(projectRoot, 'index.html');
    app.use(async (req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/mcp')) {
            return next();
        }
        try {
            const template = await readFile(indexHtmlPath, 'utf-8');
            const html = await vite.transformIndexHtml(req.originalUrl, template);
            res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (error) {
            vite.ssrFixStacktrace(error as Error);
            next(error);
        }
    });
}

async function bootstrap() {
    const app = createMcpExpressApp({ host: HOST });
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));

    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok', updatedAt: new Date().toISOString() });
    });

    app.get('/api/docs', (_req: Request, res: Response) => {
        res.type('text/markdown').send(GRAPHIC_WALKER_DOCS);
    });

    await registerFrontend(app);

    const httpServer = createServer(app);
    const gwBridge = makeGraphicWalkerBridge(httpServer);
    const mcpBinding = await mountMcpServer(app, gwBridge);

    app.get('/api/state', async (_req: Request, res: Response) => {
        try {
            const snapshot = await gwBridge.fetchSnapshot({ fresh: true });
            res.json(snapshot);
        } catch (error) {
            res.status(503).json({ message: (error as Error).message });
        }
    });

    app.get('/api/sample-dataset', (_req: Request, res: Response) => {
        res.json(SAMPLE_DATASET);
    });

    let shutdownTimer: NodeJS.Timeout | null = null;
    let shuttingDown = false;
    let hasSeenClient = false;
    const unsubscribePresence = gwBridge.onClientPresenceChange(({ clients }) => {
        if (clients === 0) {
            if (hasSeenClient) {
                scheduleShutdown('all dashboard tabs closed');
            }
            return;
        }
        hasSeenClient = true;
        if (shutdownTimer) {
            clearTimeout(shutdownTimer);
        }
    });

    const scheduleShutdown = (reason: string) => {
        if (shuttingDown) {
            return;
        }
        if (shutdownTimer) {
            clearTimeout(shutdownTimer);
        }
        shutdownTimer = setTimeout(() => {
            void shutdown(reason);
        }, SHUTDOWN_DELAY_MS);
    };

    const shutdown = async (reason: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[mcp-dashboard] shutting down: ${reason}`);
        shutdownTimer && clearTimeout(shutdownTimer);
        unsubscribePresence();
        await Promise.all([mcpBinding.close(), gwBridge.close()]);
        httpServer.close(() => process.exit(0));
    };

    httpServer.listen(PORT, HOST, () => {
        const url = `http://${HOST}:${PORT}`;
        console.log(`MCP dashboard ready on ${url}`);
        setTimeout(() => {
            void open(url).catch(() => undefined);
        }, 250);
    });

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
    console.error('Failed to start MCP dashboard', error);
    process.exit(1);
});
