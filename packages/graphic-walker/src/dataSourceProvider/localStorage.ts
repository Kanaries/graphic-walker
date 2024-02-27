import { createMemoryProvider } from './memory';

const key = 'KANARIES_GRAPHIC_WALKER_DATA';

export function createLocalStorageProvider() {
    const provider = createMemoryProvider(localStorage.getItem(key));
    provider.registerCallback(() => {
        localStorage.setItem(key, provider.exportData());
    });
    return provider;
}
