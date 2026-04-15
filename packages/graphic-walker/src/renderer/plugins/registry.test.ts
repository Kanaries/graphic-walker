import { getRendererPlugin, listRendererPlugins, registerRendererPlugin, resolveRendererId, unregisterRendererPlugin } from './registry';
import type { RendererPlugin } from './types';

describe('renderer plugin registry', () => {
    const plugin: RendererPlugin = {
        id: 'plugin:test',
        displayName: 'Test',
        render: () => null,
    };

    afterEach(() => {
        unregisterRendererPlugin(plugin.id);
    });

    test('register and resolve plugin', () => {
        registerRendererPlugin(plugin);
        expect(getRendererPlugin(plugin.id)).toBe(plugin);
        expect(listRendererPlugins().map((p) => p.id)).toContain(plugin.id);
    });

    test('unregister plugin', () => {
        registerRendererPlugin(plugin);
        unregisterRendererPlugin(plugin.id);
        expect(getRendererPlugin(plugin.id)).toBeUndefined();
    });

    test('renderer alias resolution', () => {
        expect(resolveRendererId('vega-lite')).toBe('builtin:vega');
        expect(resolveRendererId('plugin:test')).toBe('plugin:test');
        expect(resolveRendererId('observable-plot')).toBe('observable-plot');
    });
});
