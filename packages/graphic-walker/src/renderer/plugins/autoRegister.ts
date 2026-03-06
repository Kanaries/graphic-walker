import { registerRendererPlugin } from './registry';

declare const require: (id: string) => any;

let observablePluginAutoRegistered = false;

export function autoRegisterRendererPlugins() {
    if (observablePluginAutoRegistered) {
        return;
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('@kanaries/graphic-walker-renderer-observable-plot') as {
            createObservablePlotPlugin?: () => { id: string };
        };
        if (typeof mod.createObservablePlotPlugin === 'function') {
            registerRendererPlugin(mod.createObservablePlotPlugin() as any);
            observablePluginAutoRegistered = true;
            console.warn(
                '[graphic-walker] Auto-registering Observable Plot renderer plugin is deprecated and will be removed in a future major version. Register it explicitly with registerRendererPlugin().'
            );
        }
    } catch (_err) {
        // Plugin package is optional at runtime.
    }
}
