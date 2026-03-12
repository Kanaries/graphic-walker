import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build as esbuild } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactsDir = path.resolve(__dirname, './__artifacts__/images');
const optionArtifactsDir = path.resolve(__dirname, './__artifacts__/options');

const cases = [
    { name: 'prop-bar', file: path.resolve(__dirname, './prop-bar.json') },
    { name: 'prop-scatter', file: path.resolve(__dirname, './prop-scatter.json') },
    {
        name: 'prop-scatter-color',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            const dimensionByFid = new Map(next.draggableFieldState.dimensions.map((f) => [f.fid, f]));
            next.visualConfig.geoms = ['circle'];
            next.draggableFieldState.color = [dimensionByFid.get('gender')].filter(Boolean);
            next.data = next.data.slice(0, 260);
            next.chartWidth = 880;
            next.chartHeight = 520;
            return next;
        },
    },
    {
        name: 'prop-scatter-opacity',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            const measureByFid = new Map(next.draggableFieldState.measures.map((f) => [f.fid, f]));
            next.visualConfig.geoms = ['point'];
            next.draggableFieldState.opacity = [measureByFid.get('writing score')].filter(Boolean);
            return next;
        },
    },
    {
        name: 'prop-scatter-size',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            const measureByFid = new Map(next.draggableFieldState.measures.map((f) => [f.fid, f]));
            next.visualConfig.geoms = ['point'];
            next.draggableFieldState.size = [measureByFid.get('writing score')].filter(Boolean);
            return next;
        },
    },
    {
        name: 'prop-scatter-shape',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            const dimensionByFid = new Map(next.draggableFieldState.dimensions.map((f) => [f.fid, f]));
            next.visualConfig.geoms = ['point'];
            next.draggableFieldState.shape = [dimensionByFid.get('gender')].filter(Boolean);
            return next;
        },
    },
    {
        name: 'prop-scatter-facet',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            const dimensionByFid = new Map(next.draggableFieldState.dimensions.map((f) => [f.fid, f]));
            const measureByFid = new Map(next.draggableFieldState.measures.map((f) => [f.fid, f]));
            next.draggableFieldState.rows = [dimensionByFid.get('gender'), measureByFid.get('reading score')].filter(Boolean);
            next.draggableFieldState.columns = [dimensionByFid.get('race/ethnicity'), measureByFid.get('math score')].filter(Boolean);
            next.draggableFieldState.color = [dimensionByFid.get('lunch')].filter(Boolean);
            next.visualConfig.geoms = ['point'];
            next.chartWidth = 960;
            next.chartHeight = 640;
            return next;
        },
    },
    {
        name: 'prop-scatter-line',
        file: path.resolve(__dirname, './prop-bar.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            next.visualConfig.geoms = ['line'];
            next.visualConfig.defaultAggregated = true;
            const dimensionByFid = new Map(next.draggableFieldState.dimensions.map((f) => [f.fid, f]));
            const measureByFid = new Map(next.draggableFieldState.measures.map((f) => [f.fid, f]));
            next.draggableFieldState.columns = [dimensionByFid.get('race/ethnicity')].filter(Boolean);
            next.draggableFieldState.rows = [measureByFid.get('reading score')].filter(Boolean);
            return next;
        },
    },
    {
        name: 'prop-scatter-area',
        file: path.resolve(__dirname, './prop-bar.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            next.visualConfig.geoms = ['area'];
            next.visualConfig.defaultAggregated = true;
            const dimensionByFid = new Map(next.draggableFieldState.dimensions.map((f) => [f.fid, f]));
            const measureByFid = new Map(next.draggableFieldState.measures.map((f) => [f.fid, f]));
            next.draggableFieldState.columns = [dimensionByFid.get('race/ethnicity')].filter(Boolean);
            next.draggableFieldState.rows = [measureByFid.get('reading score')].filter(Boolean);
            return next;
        },
    },
    {
        name: 'prop-scatter-circle',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            next.visualConfig.geoms = ['circle'];
            return next;
        },
    },
    {
        name: 'prop-scatter-text',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            const dimensionByFid = new Map(next.draggableFieldState.dimensions.map((f) => [f.fid, f]));
            next.visualConfig.geoms = ['text'];
            next.draggableFieldState.text = [dimensionByFid.get('race/ethnicity')].filter(Boolean);
            return next;
        },
    },
    {
        name: 'prop-scatter-tick',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            next.visualConfig.geoms = ['tick'];
            return next;
        },
    },
    {
        name: 'prop-scatter-rect',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            next.visualConfig.geoms = ['rect'];
            return next;
        },
    },
];

async function renderCase(page, item, assets) {
    const raw = await fs.readFile(item.file, 'utf8');
    const parsed = JSON.parse(raw);
    const props = item.mutate ? item.mutate(parsed) : parsed;

    const width = Math.max(320, Number(props.chartWidth) || 320);
    const height = Math.max(220, Number(props.chartHeight) || 220);

    await page.setViewportSize({ width, height });
    await page.setContent(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; }
      #chart { width: ${width}px; height: ${height}px; }
    </style>
  </head>
  <body>
    <div id="chart"></div>
  </body>
</html>`);
    const optionPreview = await page.evaluate(async ({ moduleUrl, props }) => {
        const mod = await import(moduleUrl);

        const guardedRows = props.draggableFieldState.rows.filter((x) => props.visualConfig.defaultAggregated || x.aggName !== 'expr');
        const guardedCols = props.draggableFieldState.columns.filter((x) => props.visualConfig.defaultAggregated || x.aggName !== 'expr');
        const rowDims = guardedRows.filter((f) => f.analyticType === 'dimension');
        const colDims = guardedCols.filter((f) => f.analyticType === 'dimension');
        const rowMeas = guardedRows.filter((f) => f.analyticType === 'measure');
        const colMeas = guardedCols.filter((f) => f.analyticType === 'measure');
        const rowRepeatFields = rowMeas.length === 0 ? rowDims.slice(-1) : rowMeas;
        const colRepeatFields = colMeas.length === 0 ? colDims.slice(-1) : colMeas;

        const specs = mod.toObservablePlotSpec({
            rows: guardedRows,
            columns: guardedCols,
            dataSource: props.data,
            defaultAggregated: props.visualConfig.defaultAggregated,
            geomType: props.visualConfig.geoms[0],
            stack: props.layout.stack,
            interactiveScale: props.layout.interactiveScale,
            layoutMode: props.layout.size.mode,
            width: props.chartWidth,
            height: props.chartHeight,
            scales: props.scales,
            color: props.draggableFieldState.color[0],
            details: props.draggableFieldState.details,
            opacity: props.draggableFieldState.opacity[0],
            radius: props.draggableFieldState.radius[0],
            shape: props.draggableFieldState.shape[0],
            size: props.draggableFieldState.size[0],
            text: props.draggableFieldState.text[0],
            theta: props.draggableFieldState.theta[0],
            vegaConfig: props.vegaConfig,
            mediaTheme: 'light',
            displayOffset: props.visualConfig.timezoneDisplayOffset,
        });

        const rowCount = Math.max(1, rowRepeatFields.length);
        const colCount = Math.max(1, colRepeatFields.length);
        const subWidth = Math.max(120, Math.floor(props.chartWidth / colCount));
        const subHeight = Math.max(100, Math.floor(props.chartHeight / rowCount));

        const root = document.getElementById('chart');
        root.style.display = 'grid';
        root.style.gridTemplateColumns = `repeat(${colCount}, minmax(0, 1fr))`;
        root.style.gridTemplateRows = `repeat(${rowCount}, minmax(0, 1fr))`;
        root.style.overflow = props.layout.size.mode === 'auto' ? 'auto' : 'hidden';
        specs.forEach((plotSpec) => {
            const wrapper = document.createElement('div');
            wrapper.style.overflow = 'hidden';
            const plot = mod.renderObservablePlot(
                plotSpec,
                props.layout.size.mode === 'auto' ? undefined : subWidth,
                props.layout.size.mode === 'auto' ? undefined : subHeight,
                typeof props.vegaConfig?.background === 'string' ? props.vegaConfig.background : undefined
            );
            wrapper.appendChild(plot);
            root.appendChild(wrapper);
        });

        await new Promise((resolve) => setTimeout(resolve, 300));

        return specs.map((spec) => {
            const { marks, ...rest } = spec;
            return {
                ...rest,
                markCount: Array.isArray(marks) ? marks.length : 0,
            };
        });
    }, { moduleUrl: assets.moduleUrl, props });

    const pngPath = path.join(artifactsDir, `${item.name}.png`);
    const optionPath = path.join(optionArtifactsDir, `${item.name}.option.json`);
    await page.screenshot({ path: pngPath });
    await fs.writeFile(optionPath, JSON.stringify(optionPreview, null, 2), 'utf8');

    return { pngPath, optionPath };
}

async function startAssetServer(rendererPath) {
    const server = createServer(async (req, res) => {
        try {
            const pathname = (req.url ?? '/').split('?')[0];
            let filePath;
            let contentType = 'text/plain; charset=utf-8';

            if (pathname === '/renderer.js') {
                filePath = rendererPath;
                contentType = 'text/javascript; charset=utf-8';
            } else {
                res.writeHead(404, { 'access-control-allow-origin': '*' });
                res.end('Not Found');
                return;
            }

            const content = await fs.readFile(filePath);
            res.writeHead(200, {
                'content-type': contentType,
                'cache-control': 'no-store',
                'access-control-allow-origin': '*',
            });
            res.end(content);
        } catch (error) {
            res.writeHead(500, { 'access-control-allow-origin': '*' });
            res.end(String(error));
        }
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to resolve asset server address.');
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    return {
        server,
        moduleUrl: `${baseUrl}/renderer.js`,
    };
}

async function buildRendererBundle() {
    const runtimeDir = path.resolve(__dirname, './__artifacts__/runtime');
    const bundlePath = path.resolve(runtimeDir, './observablePlot.bundle.mjs');
    await fs.mkdir(runtimeDir, { recursive: true });
    await esbuild({
        entryPoints: [path.resolve(__dirname, '../src/observablePlot.ts')],
        bundle: true,
        format: 'esm',
        platform: 'browser',
        outfile: bundlePath,
        sourcemap: false,
    });
    return bundlePath;
}

async function main() {
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.mkdir(optionArtifactsDir, { recursive: true });

    const browser = await chromium.launch({
        headless: process.env.PW_HEADLESS === '0' ? false : true,
    });

    const rendererModulePath = await buildRendererBundle();
    const assets = await startAssetServer(rendererModulePath);

    try {
        const page = await browser.newPage();

        for (const item of cases) {
            const result = await renderCase(page, item, assets);
            console.log(`[render] ${item.name}`);
            console.log(`  image: ${result.pngPath}`);
            console.log(`  option: ${result.optionPath}`);
        }
    } finally {
        assets.server.close();
        await browser.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
