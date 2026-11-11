import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VizStoreWrapper, useVizStore } from './index';
import type { VizSpecStore } from './visualSpecStore';

function renderStore(props: Omit<React.ComponentProps<typeof VizStoreWrapper>, 'children'>) {
    let store!: VizSpecStore;
    function PanelState() {
        store = useVizStore();
        return <span>{store.showAutoVizPanel ? 'expanded' : 'collapsed'}</span>;
    }

    const markup = renderToStaticMarkup(
        <VizStoreWrapper {...props}>
            <PanelState />
        </VizStoreWrapper>
    );
    return { store, markup };
}

describe('VizStoreWrapper UI defaults', () => {
    test('provides a collapsed panel on the first render without waiting for effects', () => {
        const { markup } = renderStore({ meta: [], defaultUIConfig: { panels: { autoViz: { expanded: false } } } });

        expect(markup).toBe('<span>collapsed</span>');
    });

    test('keeps the panel expanded when UI defaults are omitted', () => {
        const { markup } = renderStore({ meta: [] });

        expect(markup).toBe('<span>expanded</span>');
    });

    test('preserves user state on keepAlive remounts even when default props change', () => {
        const keepAlive = 'default-ui-config-remount';
        const initial = renderStore({ meta: [], keepAlive, defaultUIConfig: { panels: { autoViz: { expanded: false } } } });
        initial.store.setShowAutoVizPanel(true);

        const reopened = renderStore({ meta: [], keepAlive, defaultUIConfig: { panels: { autoViz: { expanded: false } } } });
        expect(reopened.store).toBe(initial.store);
        expect(reopened.markup).toBe('<span>expanded</span>');

        reopened.store.setShowAutoVizPanel(false);
        const changedDefaults = renderStore({ meta: [], keepAlive, defaultUIConfig: { panels: { autoViz: { expanded: true } } } });

        expect(changedDefaults.store).toBe(initial.store);
        expect(changedDefaults.markup).toBe('<span>collapsed</span>');
    });

    test('applies the supplied defaults when the keepAlive key creates a new store', () => {
        const initial = renderStore({ meta: [], keepAlive: 'default-ui-config-before-key-change' });
        const next = renderStore({
            meta: [],
            keepAlive: 'default-ui-config-after-key-change',
            defaultUIConfig: { panels: { autoViz: { expanded: false } } },
        });

        expect(next.store).not.toBe(initial.store);
        expect(next.markup).toBe('<span>collapsed</span>');
    });
});
