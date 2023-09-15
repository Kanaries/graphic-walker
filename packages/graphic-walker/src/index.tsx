import React, { type ForwardedRef, forwardRef, useState } from 'react';
import { DOMProvider } from '@kanaries/react-beautiful-dnd';
import { observer } from 'mobx-react-lite';
import { VizAppWithContext, VizProps } from './App';
import { App, IGWProps } from './FullApp';

import { StoreWrapper } from './store/index';
import { ShadowDom } from './shadow-dom';
import AppRoot from './components/appRoot';
import type { IGWHandler, IGWHandlerInsider } from './interfaces';

import './empty_sheet.css';

export const GraphicWalker = observer(
    forwardRef<IGWHandler, IGWProps>((props, ref) => {
        const { storeRef } = props;
        const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

        const handleMount = (shadowRoot: ShadowRoot) => {
            setShadowRoot(shadowRoot);
        };
        const handleUnmount = () => {
            setShadowRoot(null);
        };

        return (
            <StoreWrapper keepAlive={props.keepAlive} storeRef={storeRef}>
                <AppRoot ref={ref as ForwardedRef<IGWHandlerInsider>}>
                    <ShadowDom onMount={handleMount} onUnmount={handleUnmount}>
                        <DOMProvider value={{ head: shadowRoot ?? document.head, body: shadowRoot ?? document.body }}>
                            <App {...props} />
                        </DOMProvider>
                    </ShadowDom>
                </AppRoot>
            </StoreWrapper>
        );
    })
);

export const SimpleGraphicWalker = observer(
    forwardRef<IGWHandler, VizProps>((props, ref) => {
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

export { default as PureRenderer } from './renderer/pureRenderer';
export { embedGraphicWalker } from './vanilla';
export type { IGWProps };
export { ISegmentKey, ColorSchemes } from './interfaces';
export { resolveChart, convertChart } from './models/visSpecHistory';
export { resolveVisSpec } from './utils/save';
export { getGlobalConfig } from './config';

export { getComputation } from './computation/clientComputation'
