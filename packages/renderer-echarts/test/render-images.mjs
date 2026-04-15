import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { buildEChartsOption } from '../dist/graphic-walker-renderer-echarts.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactsDir = path.resolve(__dirname, './__artifacts__/images');
const optionArtifactsDir = path.resolve(__dirname, './__artifacts__/options');

const cases = [
    {
        name: 'prop-bar',
        file: path.resolve(__dirname, './prop-bar.json'),
    },
    {
        name: 'prop-scatter',
        file: path.resolve(__dirname, './prop-scatter.json'),
    },
    {
        name: 'prop-scatter-color',
        file: path.resolve(__dirname, './prop-scatter.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            const dimensionByFid = new Map(next.draggableFieldState.dimensions.map((f) => [f.fid, f]));
            // Make the color test easier to inspect: fewer categories + fewer points + larger canvas.
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
            next.draggableFieldState.rows = [
                dimensionByFid.get('gender'),
                measureByFid.get('reading score'),
            ].filter(Boolean);
            next.draggableFieldState.columns = [
                dimensionByFid.get('race/ethnicity'),
                measureByFid.get('math score'),
            ].filter(Boolean);
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
        name: 'prop-bar-arc',
        file: path.resolve(__dirname, './prop-bar.json'),
        mutate(props) {
            const next = JSON.parse(JSON.stringify(props));
            const measureByFid = new Map(next.draggableFieldState.measures.map((f) => [f.fid, f]));
            next.visualConfig.geoms = ['arc'];
            next.draggableFieldState.theta = [measureByFid.get('reading score')].filter(Boolean);
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

async function renderCase(page, echartsPath, item) {
    const raw = await fs.readFile(item.file, 'utf8');
    const parsed = JSON.parse(raw);
    const props = item.mutate ? item.mutate(parsed) : parsed;

    const option = buildEChartsOption(props);
    if (!option) {
        throw new Error(`buildEChartsOption returned null for ${item.name}`);
    }

    const width = Math.max(320, Number(props.chartWidth) || 320);
    const height = Math.max(220, Number(props.chartHeight) || 220);
    const optionForRender = JSON.parse(JSON.stringify(option));

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

    await page.addScriptTag({ path: echartsPath });
    await page.evaluate(async ({ option }) => {
        const chart = window.echarts.init(document.getElementById('chart'));
        chart.setOption(option, true);
        await new Promise((resolve) => setTimeout(resolve, 500));
        chart.resize();
    }, { option: optionForRender });

    const pngPath = path.join(artifactsDir, `${item.name}.png`);
    const optionPath = path.join(optionArtifactsDir, `${item.name}.option.json`);
    await page.screenshot({ path: pngPath });
    await fs.writeFile(optionPath, JSON.stringify(optionForRender, null, 2), 'utf8');

    return { pngPath, optionPath };
}

async function main() {
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.mkdir(optionArtifactsDir, { recursive: true });
    const echartsPath = require.resolve('echarts/dist/echarts.min.js');

    const browser = await chromium.launch({
        headless: process.env.PW_HEADLESS === '0' ? false : true,
    });

    try {
        const page = await browser.newPage();
        for (const item of cases) {
            const result = await renderCase(page, echartsPath, item);
            console.log(`[render] ${item.name}`);
            console.log(`  image: ${result.pngPath}`);
            console.log(`  option: ${result.optionPath}`);
        }
    } finally {
        await browser.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
