import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEMO_DATASET_BASE_URL = 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets';

export const DEMO_DATASETS = [
    'ds-cars-service.json',
    'ds-students-service.json',
    'ds-btcgold-service.json',
    'ds-bikesharing-service.json',
    'ds-carsales-service.json',
    'ds-collage-service.json',
    'ds-titanic-service.json',
    'ds-kelper-service.json',
    'ds-earthquake-service.json',
];

export function getDemoDatasetRemoteUrl(filename) {
    if (!DEMO_DATASETS.includes(filename)) {
        return undefined;
    }

    return `${DEMO_DATASET_BASE_URL}/${filename}`;
}

export async function downloadDemoDataset(filename, outputDir) {
    const remoteUrl = getDemoDatasetRemoteUrl(filename);

    if (!remoteUrl) {
        throw new Error(`Unknown demo dataset: ${filename}`);
    }

    const response = await fetch(remoteUrl);

    if (!response.ok) {
        throw new Error(`Failed to download ${remoteUrl}: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, filename), buffer);

    return buffer;
}

export async function syncDemoDatasets(outputDir, options = {}) {
    const { force = false } = options;
    const results = [];

    await fs.mkdir(outputDir, { recursive: true });

    for (const filename of DEMO_DATASETS) {
        const outputPath = path.join(outputDir, filename);

        if (!force) {
            try {
                await fs.access(outputPath);
                results.push({ filename, status: 'exists' });
                continue;
            } catch {
                // Missing files are downloaded below.
            }
        }

        await downloadDemoDataset(filename, outputDir);
        results.push({ filename, status: 'downloaded' });
    }

    return results;
}

async function runCli() {
    const args = process.argv.slice(2);
    const outputDirArg = args.find((arg) => !arg.startsWith('--'));
    const defaultOutputDir = path.resolve(process.cwd(), 'packages/graphic-walker/public/datasets');
    const outputDir = path.resolve(outputDirArg || defaultOutputDir);
    const force = args.includes('--force');

    const results = await syncDemoDatasets(outputDir, { force });
    const downloadedCount = results.filter((item) => item.status === 'downloaded').length;
    const existingCount = results.filter((item) => item.status === 'exists').length;

    console.log(`Demo datasets ready in ${outputDir}`);
    console.log(`${downloadedCount} downloaded, ${existingCount} already present.`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
    runCli().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
