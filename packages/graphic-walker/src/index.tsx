import React, { forwardRef } from "react";
import { DOM } from "@kanaries/react-beautiful-dnd";
import { observer } from "mobx-react-lite";
import App, { IGWProps } from "./App";
import { StoreWrapper } from "./store/index";
import { FieldsContextWrapper } from "./fields/fieldsContext";
import { ShadowDom } from "./shadow-dom";
import AppRoot from "./components/appRoot";
import type { IGWHandler } from "./interfaces";

import "./empty_sheet.css";

export const GraphicWalker = observer(forwardRef<IGWHandler, IGWProps>((props, ref) => {
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
            <AppRoot ref={ref}>
                <ShadowDom onMount={handleMount} onUnmount={handleUnmount}>
                    <FieldsContextWrapper>
                        <App {...props} />
                    </FieldsContextWrapper>
                </ShadowDom>
            </AppRoot>
        </StoreWrapper>
    );
}));

export { default as PureRenderer } from './renderer/pureRenderer';
export { embedGraphicWalker } from './vanilla';
export type { IGWProps };
