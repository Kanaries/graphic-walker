import React, { createContext, useEffect, useRef, useState } from 'react';
import styled, { StyleSheetManager } from 'styled-components';
import root from 'react-shadow';
import { DOM } from '@kanaries/react-beautiful-dnd';
import { observer } from 'mobx-react-lite';
import App, { IGWProps } from './App';
import { StoreWrapper } from './store/index';
import { FieldsContextWrapper } from './fields/fieldsContext';

import './empty_sheet.css';
import tailwindStyle from "tailwindcss/tailwind.css?inline";
import style from './index.css?inline';


const AppRoot = styled(root.div)`
    flex: 1 1 max-content;
    width: 100%;
    height: 100%;
    overflow: hidden;
`;

export const ShadowDomContext = createContext<{ root: ShadowRoot | null }>({ root: null });

export const GraphicWalker: React.FC<IGWProps> = observer(props => {
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

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

    return (
        <AppRoot mode="open" ref={rootRef}>
            <style>{tailwindStyle}</style>
            <style>{style}</style>
            {shadowRoot && (
                <StyleSheetManager target={shadowRoot}>
                    <StoreWrapper keepAlive={props.keepAlive}>
                        <FieldsContextWrapper>
                            <ShadowDomContext.Provider value={{ root: shadowRoot }}>
                                <App {...props} />
                            </ShadowDomContext.Provider>
                        </FieldsContextWrapper>
                    </StoreWrapper>
                </StyleSheetManager>
            )}
        </AppRoot>
    );
});
