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
        comp: () => import('./pages/table'),
        name: 'TableWalker',
    },
    {
        comp: () => import('./pages/themeBuilder'),
        name: 'ThemeBuilder',
    },
].map((Component) => ({
    name: Component.name,
    path: Component.name.replace(/\s/g, '_'),
    lazy: async () => Component.comp().then((mod) => ({ Component: mod.default })),
}));
