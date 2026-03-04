export const pages = [
    {
        comp: () => import('./pages/gw'),
        name: 'GraphicWalker',
    },
    {
        comp: () => import('./pages/pureRenderer'),
        name: 'PureRenderer',
    },
    {
        comp: () => import('./pages/inModal'),
        name: 'Graphic Walker In a Modal',
    },
    {
        comp: () => import('./pages/ds'),
        name: 'DataSourceSegment',
    },
    {
        comp: () => import('./pages/renderer'),
        name: 'GraphicRenderer',
    },
    {
        comp: () => import('./pages/cc'),
        name: 'CustomColor',
    },
    {
        comp: () => import('./pages/exportChart'),
        name: 'Export Chart',
    },
    {
        comp: () => import('./pages/table'),
        name: 'TableWalker',
    },
    {
        comp: () => import('./pages/tableSettings'),
        name: 'TableWalker Settings',
    },
    {
        comp: () => import('./pages/filterContext'),
        name: 'Filter Context',
    },
    {
        comp: () => import('./pages/defaultRenderer'),
        name: 'Default Renderer',
    },
    {
        comp: () => import('./pages/themeBuilder'),
        name: 'ThemeBuilder',
    },
    {
        comp: () => import('./pages/hideProfiling'),
        name: 'HideProfiling',
    },
    {
        comp: () => import('./pages/vlSpec'),
        name: 'VlSpec',
    }
].map((Component) => ({
    name: Component.name,
    path: Component.name.replace(/\s/g, '_'),
    lazy: async () => Component.comp().then((mod) => ({ Component: mod.default })),
}));
