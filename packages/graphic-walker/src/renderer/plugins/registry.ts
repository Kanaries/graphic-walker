import type { RendererPlugin } from './types';

const plugins = new Map<string, RendererPlugin>();

const rendererAliases = new Map<string, string>([
    ['vega-lite', 'builtin:vega'],
]);

export function resolveRendererId(rendererId?: string): string {
    if (!rendererId) {
        return 'builtin:vega';
    }
    return rendererAliases.get(rendererId) ?? rendererId;
}

export function registerRendererPlugin(plugin: RendererPlugin): void {
    plugins.set(plugin.id, plugin);
}

export function unregisterRendererPlugin(id: string): void {
    plugins.delete(id);
}

export function getRendererPlugin(id: string): RendererPlugin | undefined {
    return plugins.get(id);
}

export function listRendererPlugins(): RendererPlugin[] {
    return Array.from(plugins.values()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function registerRendererAlias(alias: string, rendererId: string): void {
    rendererAliases.set(alias, rendererId);
}

export function listRendererAliases(): ReadonlyArray<[string, string]> {
    return Array.from(rendererAliases.entries());
}
