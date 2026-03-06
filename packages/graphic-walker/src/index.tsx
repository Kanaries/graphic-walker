import { autoRegisterRendererPlugins, ensureBuiltinRendererPlugins } from './renderer/plugins';

declare const require: (id: string) => any;

ensureBuiltinRendererPlugins();
autoRegisterRendererPlugins();

export * from './root';
export { default as PureRenderer } from './renderer/pureRenderer';
export type { ILocalPureRendererProps, IRemotePureRendererProps } from './renderer/pureRenderer';
export { embedGraphicWalker, embedGraphicRenderer, embedPureRenderer, embedTableWalker } from './vanilla';
export * from './interfaces';
export * from './store/visualSpecStore';
export { resolveChart, convertChart, parseChart } from './models/visSpecHistory';
export { getGlobalConfig } from './config';
export { DataSourceSegmentComponent } from './dataSource';
export * from './models/visSpecHistory';
export * from './dataSourceProvider';
export { getComputation } from './computation/clientComputation';
export { addFilterForQuery, chartToWorkflow } from './utils/workflow';
export * from './utils/colors';
export * from './components/filterContext';
export type { RendererPlugin, RendererPluginProps } from './renderer/plugins';
export {
    registerRendererPlugin,
    unregisterRendererPlugin,
    getRendererPlugin,
    listRendererPlugins,
    registerRendererAlias,
    resolveRendererId,
} from './renderer/plugins';

export function createObservablePlotPlugin() {
    const mod = require('@kanaries/graphic-walker-renderer-observable-plot');
    return mod.createObservablePlotPlugin();
}

export function createEChartsPlugin() {
    const mod = require('@kanaries/graphic-walker-renderer-echarts');
    return mod.createEChartsPlugin();
}
