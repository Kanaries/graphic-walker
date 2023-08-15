import React, { type ForwardedRef, forwardRef } from 'react';
import { DOM } from '@kanaries/react-beautiful-dnd';
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

        const handleMount = (shadowRoot: ShadowRoot) => {
            DOM.setBody(shadowRoot);
            DOM.setHead(shadowRoot);
        };
        const handleUnmount = () => {
            DOM.setBody(document.body);
            DOM.setHead(document.head);
        };

        return (
            <StoreWrapper keepAlive={props.keepAlive} storeRef={storeRef}>
                <AppRoot ref={ref as ForwardedRef<IGWHandlerInsider>}>
                    <ShadowDom onMount={handleMount} onUnmount={handleUnmount}>
                            <App {...props} />
                    </ShadowDom>
                </AppRoot>
            </StoreWrapper>
        );
    })
);

export const SimpleGraphicWalker = observer(
    forwardRef<IGWHandler, VizProps>((props, ref) => {
        const handleMount = (shadowRoot: ShadowRoot) => {
            DOM.setBody(shadowRoot);
            DOM.setHead(shadowRoot);
        };
        const handleUnmount = () => {
            DOM.setBody(document.body);
            DOM.setHead(document.head);
        };

        return (
            <AppRoot ref={ref as ForwardedRef<IGWHandlerInsider>}>
                <ShadowDom onMount={handleMount} onUnmount={handleUnmount}>
                        <VizAppWithContext {...props} />
                </ShadowDom>
            </AppRoot>
        );
    })
);

export { default as PureRenderer } from './renderer/pureRenderer';
export { embedGraphicWalker } from './vanilla';
export type { IGWProps };
export { ISegmentKey } from './interfaces';
