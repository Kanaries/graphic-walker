export interface PageItem {
    name: string;
    path: string;
    lazy: () => Promise<{ Component: React.ComponentType }>;
}

export interface PageGroup {
    label: string;
    pages: PageItem[];
}

const raw: { group: string; name: string; comp: () => Promise<{ default: React.ComponentType }> }[] = [
    // ── Teasers ──────────────────────────────────
    { group: 'Teasers', comp: () => import('./pages/teaserScatter'), name: 'Scatter: Horsepower vs Price' },
    { group: 'Teasers', comp: () => import('./pages/teaserTimeSeries'), name: 'Time Series: Bike Sharing' },
    { group: 'Teasers', comp: () => import('./pages/teaserStackedBar'), name: 'Stacked Bar: Titanic' },
    { group: 'Teasers', comp: () => import('./pages/teaserCollege'), name: 'Scatter: College Cost vs Earnings' },
    { group: 'Teasers', comp: () => import('./pages/teaserPie'), name: 'Pie: Car Sales' },

    // ── Core ─────────────────────────────────────
    { group: 'Core', comp: () => import('./pages/gw'), name: 'GraphicWalker' },
    { group: 'Core', comp: () => import('./pages/pureRenderer'), name: 'PureRenderer' },
    { group: 'Core', comp: () => import('./pages/renderer'), name: 'GraphicRenderer' },
    { group: 'Core', comp: () => import('./pages/defaultRenderer'), name: 'Default Renderer' },

    // ── Features ─────────────────────────────────
    { group: 'Features', comp: () => import('./pages/ds'), name: 'DataSourceSegment' },
    { group: 'Features', comp: () => import('./pages/inModal'), name: 'In a Modal' },
    { group: 'Features', comp: () => import('./pages/exportChart'), name: 'Export Chart' },
    { group: 'Features', comp: () => import('./pages/filterContext'), name: 'Filter Context' },
    { group: 'Features', comp: () => import('./pages/hideProfiling'), name: 'HideProfiling' },

    // ── Configuration ────────────────────────────
    { group: 'Configuration', comp: () => import('./pages/cc'), name: 'CustomColor' },
    { group: 'Configuration', comp: () => import('./pages/table'), name: 'TableWalker' },
    { group: 'Configuration', comp: () => import('./pages/tableSettings'), name: 'TableWalker Settings' },
    { group: 'Configuration', comp: () => import('./pages/themeBuilder'), name: 'ThemeBuilder' },

    // ── Spec / Grammar ───────────────────────────
    { group: 'Spec / Grammar', comp: () => import('./pages/vlSpec'), name: 'VlSpec' },
    { group: 'Spec / Grammar', comp: () => import('./pages/terseSpec'), name: 'TerseSpec' },
];

function toPage(item: (typeof raw)[number]): PageItem {
    return {
        name: item.name,
        path: item.name.replace(/\s/g, '_'),
        lazy: async () => item.comp().then((mod) => ({ Component: mod.default })),
    };
}

/** Flat page list for React Router */
export const pages: PageItem[] = raw.map(toPage);

/** Grouped page list for sidebar navigation */
export const pageGroups: PageGroup[] = (() => {
    const groups: PageGroup[] = [];
    const groupMap = new Map<string, PageGroup>();
    for (const item of raw) {
        let group = groupMap.get(item.group);
        if (!group) {
            group = { label: item.group, pages: [] };
            groupMap.set(item.group, group);
            groups.push(group);
        }
        group.pages.push(toPage(item));
    }
    return groups;
})();
