import React, { type ForwardedRef, forwardRef, useState } from 'react';
import { DOMProvider } from '@kanaries/react-beautiful-dnd';
import { observer } from 'mobx-react-lite';
import { VizAppWithContext } from './App';
import { App } from './FullApp';

import { ShadowDom } from './shadow-dom';
import AppRoot from './components/appRoot';
import type { IGWHandler, IGWHandlerInsider, IGWProps, ITableProps, IVizAppProps } from './interfaces';

import './empty_sheet.css';
import { TableAppWithContext } from './Table';

export const FullGraphicWalker = observer(
    forwardRef<IGWHandler, IGWProps>((props, ref) => {
        const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

        const handleMount = (shadowRoot: ShadowRoot) => {
            setShadowRoot(shadowRoot);
        };
        const handleUnmount = () => {
            setShadowRoot(null);
        };

        return (
            <AppRoot ref={ref as ForwardedRef<IGWHandlerInsider>}>
                <ShadowDom onMount={handleMount} onUnmount={handleUnmount}>
                    <DOMProvider value={{ head: shadowRoot ?? document.head, body: shadowRoot ?? document.body }}>
                        <App {...props} />
                    </DOMProvider>
                </ShadowDom>
            </AppRoot>
        );
    })
);

export const GraphicWalker = observer(
    forwardRef<IGWHandler, IVizAppProps>((props, ref) => {
        const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

        const handleMount = (shadowRoot: ShadowRoot) => {
            setShadowRoot(shadowRoot);
        };
        const handleUnmount = () => {
            setShadowRoot(null);
        };

        return (
            <AppRoot ref={ref as ForwardedRef<IGWHandlerInsider>}>
                <ShadowDom onMount={handleMount} onUnmount={handleUnmount}>
                    <DOMProvider value={{ head: shadowRoot ?? document.head, body: shadowRoot ?? document.body }}>
                        <VizAppWithContext {...props} />
                    </DOMProvider>
                </ShadowDom>
            </AppRoot>
        );
    })
);

export const TableWalker = observer(
    forwardRef<IGWHandler, ITableProps>((props, ref) => {
        const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

        const handleMount = (shadowRoot: ShadowRoot) => {
            setShadowRoot(shadowRoot);
        };
        const handleUnmount = () => {
            setShadowRoot(null);
        };

        return (
            <AppRoot ref={ref as ForwardedRef<IGWHandlerInsider>}>
                <ShadowDom onMount={handleMount} onUnmount={handleUnmount}>
                    <DOMProvider value={{ head: shadowRoot ?? document.head, body: shadowRoot ?? document.body }}>
                        <TableAppWithContext {...props} />
                    </DOMProvider>
                </ShadowDom>
            </AppRoot>
        );
    })
);

export { default as PureRenderer } from './renderer/pureRenderer';
export { embedGraphicWalker } from './vanilla';
export type { IGWProps, ITableProps, IVizAppProps };
export { ISegmentKey, ColorSchemes } from './interfaces';
export { resolveChart, convertChart } from './models/visSpecHistory';
export { getGlobalConfig } from './config';

export { getComputation } from './computation/clientComputation';
export { addFilterForQuery } from './utils/workflow';
export * from './components/filterWalker';
export { chartToWorkflow } from './utils/workflow';
