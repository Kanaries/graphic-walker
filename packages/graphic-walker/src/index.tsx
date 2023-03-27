import React, { createContext, useEffect, useRef, useState } from "react";
import styled, { StyleSheetManager } from "styled-components";
import root from "react-shadow";
import { observer } from "mobx-react-lite";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import App, { IGWProps } from "./App";
import { StoreWrapper } from "./store/index";

import "./empty_sheet.css";
import tailwindStyle from "tailwindcss/tailwind.css?inline";
import style from "./index.css?inline";

const AppRoot = styled(root.div)`
    flex: 1 1 max-content;
    width: 100%;
    height: 100%;
    overflow: hidden;
`;

export const ShadowDomContext = createContext<{ root: ShadowRoot | null }>({ root: null });

export const GraphicWalker: React.FC<IGWProps> = observer((props) => {
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const { storeRef } = props;

    useEffect(() => {
        if (rootRef.current) {
            const shadowRoot = rootRef.current.shadowRoot!;
            setShadowRoot(shadowRoot);
        }
    }, []);

    return (
        <StoreWrapper keepAlive={props.keepAlive} storeRef={storeRef}>
            <AppRoot mode="open" ref={rootRef}>
                <style>{tailwindStyle}</style>
                <style>{style}</style>
                {shadowRoot && (
                    <StyleSheetManager target={shadowRoot}>
                        <DndProvider backend={HTML5Backend}>
                            <ShadowDomContext.Provider value={{ root: shadowRoot }}>
                                <App {...props} />
                            </ShadowDomContext.Provider>
                        </DndProvider>
                    </StyleSheetManager>
                )}
            </AppRoot>
        </StoreWrapper>
    );
});
