import React, { type HTMLAttributes, createContext, useEffect, useRef, useState, useMemo } from "react";
import { StyleSheetManager } from "styled-components";
import root from "react-shadow";
import { DOM } from "@kanaries/react-beautiful-dnd";
import { observer } from "mobx-react-lite";
import App, { IGWProps } from "./App";
import { StoreWrapper } from "./store/index";
import type { IKeepAliveMode } from "./interfaces";
import { FieldsContextWrapper } from "./fields/fieldsContext";

import "./empty_sheet.css";
import tailwindStyle from "tailwindcss/tailwind.css?inline";
import style from "./index.css?inline";

export const ShadowDomContext = createContext<{ root: ShadowRoot | null }>({ root: null });

export const GraphicWalker = observer<IGWProps & Omit<HTMLAttributes<HTMLDivElement>, keyof IGWProps>>((props) => {
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const { storeRef, keepAlive: ka = 'single-instance', id, className, style: divStyle } = props;
    const attrs = { className, style: divStyle };

    useEffect(() => {
        if (rootRef.current) {
            const shadowRoot = rootRef.current.shadowRoot!;
            setShadowRoot(shadowRoot);
            DOM.setBody(shadowRoot);
            DOM.setHead(shadowRoot);
            return () => {
                DOM.setBody(document.body);
                DOM.setHead(document.head);
            };
        }
    }, []);

    const keepAlive = useMemo<IKeepAliveMode>(() => {
        if (ka === 'true' || ka === true) {
            return 'single-instance';
        } else if (ka === 'false' || ka === false) {
            return 'never';
        }
        if (ka === 'always' && !id) {
            if (process.env.NODE_ENV === 'development') {
                console.error(new Error('id must be provided when keepAlive is "always"'));
            }
            return 'single-instance';
        }
        return ka;
    }, [ka, id]);

    return (
        <StoreWrapper keepAlive={keepAlive} storeRef={storeRef}>
            <root.div mode="open" ref={rootRef} {...attrs}>
                <style>{tailwindStyle}</style>
                <style>{style}</style>
                {shadowRoot && (
                    <StyleSheetManager target={shadowRoot}>
                        <FieldsContextWrapper>
                            <ShadowDomContext.Provider value={{ root: shadowRoot }}>
                                <App {...props} />
                            </ShadowDomContext.Provider>
                        </FieldsContextWrapper>
                    </StyleSheetManager>
                )}
            </root.div>
        </StoreWrapper>
    );
});

export { clearStoreCache } from "./store";
