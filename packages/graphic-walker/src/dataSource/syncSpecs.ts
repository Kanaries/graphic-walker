import type { IDataSourceProvider } from '../interfaces';

interface SpecStoreLike {
    importRaw(specs: unknown): void;
}

interface SpecStoreRefLike {
    current: SpecStoreLike | null;
}

export async function syncProviderSpecs(provider: Pick<IDataSourceProvider, 'getSpecs'>, datasetId: string, storeRef: SpecStoreRefLike): Promise<void> {
    const specs = await provider.getSpecs(datasetId);
    storeRef.current?.importRaw(JSON.parse(specs));
}
