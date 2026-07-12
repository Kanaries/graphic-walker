import { syncProviderSpecs } from './syncSpecs';

describe('syncProviderSpecs', () => {
    test('loads and imports the latest serialized specs', async () => {
        const getSpecs = jest.fn().mockResolvedValue('[{"visId":"chart-1"}]');
        const importRaw = jest.fn();

        await syncProviderSpecs({ getSpecs }, 'dataset-1', { current: { importRaw } });

        expect(getSpecs).toHaveBeenCalledWith('dataset-1');
        expect(importRaw).toHaveBeenCalledWith([{ visId: 'chart-1' }]);
    });

    test('reads the store ref after the asynchronous provider call resolves', async () => {
        let resolveSpecs!: (value: string) => void;
        const getSpecs = jest.fn(() => new Promise<string>((resolve) => (resolveSpecs = resolve)));
        const importRaw = jest.fn();
        const storeRef: { current: { importRaw: typeof importRaw } | null } = { current: null };

        const syncing = syncProviderSpecs({ getSpecs }, 'dataset-1', storeRef);
        storeRef.current = { importRaw };
        resolveSpecs('[]');
        await syncing;

        expect(importRaw).toHaveBeenCalledWith([]);
    });
});
