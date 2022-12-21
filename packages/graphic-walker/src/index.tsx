import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { StyleSheetManager } from 'styled-components';
import App, { EditorProps } from './App';
import { StoreWrapper } from './store/index';
import { FieldsContextWrapper } from './fields/fieldsContext';
import { DOM } from 'react-beautiful-dnd';

import tailwindStyle from "tailwindcss/tailwind.css?inline";
import style from './index.css?inline';


export const GraphicWalker: React.FC<EditorProps> = props => {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const { current: container } = containerRef;
		if (container) {
			const shadowRoot = container.attachShadow({ mode: 'open' });
            DOM.setBody(shadowRoot);
            DOM.setHead(shadowRoot);
			const tailwindStyleElement = document.createElement('style');
			tailwindStyleElement.innerHTML = tailwindStyle;
            shadowRoot.appendChild(tailwindStyleElement);
			const styleElement = document.createElement('style');
			styleElement.innerHTML = style;
			shadowRoot.appendChild(styleElement);
            const root = document.createElement('div');
            ReactDOM.render((
                <StyleSheetManager target={shadowRoot}>
                    <StoreWrapper keepAlive={props.keepAlive}>
                        <FieldsContextWrapper>
                            <App {...props} />
                        </FieldsContextWrapper>
                    </StoreWrapper>
                </StyleSheetManager>
            ), root);
            shadowRoot.appendChild(root);
            return () => {
                shadowRoot.innerHTML = '';
                DOM.setBody(document.body);
                DOM.setHead(document.head);
            };
		}
	}, [props]);

    return (
        <div ref={containerRef}/>
    );
};
