import React from "react";
import { DOM } from "@kanaries/react-beautiful-dnd";
import { observer } from "mobx-react-lite";
import App, { IGWProps } from "./App";
import { StoreWrapper } from "./store/index";
import { FieldsContextWrapper } from "./fields/fieldsContext";
import { ShadowDom } from "./shadow-dom";

import "./empty_sheet.css";

export const GraphicWalker: React.FC<IGWProps> = observer((props) => {
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
            <ShadowDom onMount={handleMount} onUnmount={handleUnmount}>
                <FieldsContextWrapper>
                    <App {...props} />
                </FieldsContextWrapper>
            </ShadowDom>
        </StoreWrapper>
    );
});

export { default as PureRenderer } from './renderer/pureRenderer';
