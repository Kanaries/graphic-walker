import { createMemoryProvider } from './memory';

const key = 'KANARIES_GRAPHIC_WALKER_DATA';

export function createLocalStorageProvider() {
    const provider = createMemoryProvider(localStorage.getItem(key));
    provider.registerCallback(() => {
        try {
            localStorage.setItem(key, provider.exportData());
        } catch (error) {
            // Handle quota exceeded or other localStorage errors
            console.error('Failed to save data to localStorage:', error);
        }
    });
    return provider;
}
