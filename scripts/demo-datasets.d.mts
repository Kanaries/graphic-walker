export const DEMO_DATASET_BASE_URL: string;

export const DEMO_DATASETS: string[];

export function getDemoDatasetRemoteUrl(filename: string): string | undefined;

export function downloadDemoDataset(filename: string, outputDir: string): Promise<Buffer>;

export function syncDemoDatasets(
    outputDir: string,
    options?: {
        force?: boolean;
    }
): Promise<
    Array<{
        filename: string;
        status: 'exists' | 'downloaded';
    }>
>;
