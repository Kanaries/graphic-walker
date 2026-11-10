// The registry is one per module instance, so each test loads its own.
function load() {
    let registry!: typeof import('./nativeRegistry');
    jest.isolateModules(() => {
        registry = require('./nativeRegistry');
    });
    return registry;
}
// What a component reading the registry would see. React is not needed for that: the hook reads this snapshot.
jest.mock('react', () => ({ useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() }));
const renderer = { component: () => null, check: () => undefined };
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('native renderer registry', () => {
    test('there is no renderer and none on its way until a host says so', () => {
        const { useNativeRegistry, useNativeRenderer } = load();
        expect(useNativeRegistry()).toEqual({ loading: false });
        expect(useNativeRenderer()).toBeUndefined();
    });
    test('an announced renderer is loading until it registers', async () => {
        const { expectNativeRenderer, registerNativeRenderer, useNativeRegistry } = load();
        let arrive!: () => void;
        expectNativeRenderer(new Promise<void>((resolve) => (arrive = resolve)));
        expect(useNativeRegistry()).toEqual({ renderer: undefined, loading: true });
        registerNativeRenderer(renderer);
        expect(useNativeRegistry()).toEqual({ renderer, loading: false });
        arrive();
        await settle();
        expect(useNativeRegistry()).toEqual({ renderer, loading: false });
    });
    test('an announced renderer that fails to load, or loads without registering, is not waited for any longer', async () => {
        for (const arrival of [Promise.reject(new Error('network')), Promise.resolve()]) {
            const { expectNativeRenderer, useNativeRegistry } = load();
            expectNativeRenderer(arrival);
            expect(useNativeRegistry().loading).toBe(true);
            await settle();
            expect(useNativeRegistry()).toEqual({ renderer: undefined, loading: false });
        }
    });
});
