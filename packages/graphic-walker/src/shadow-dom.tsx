import React, { HTMLAttributes, createContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheetManager } from 'styled-components';
import root from 'react-shadow';

import tailwindStyle from 'tailwindcss/tailwind.css?inline';
import style from './index.css?inline';
import leafletStyle from './leaflet.css?inline';
import { IUIThemeConfig } from './interfaces';
import { ColorConfigToCSS, zincTheme } from './utils/colors';
import { uiThemeContext } from './store/theme';

export const ShadowDomContext = createContext<{ root: ShadowRoot | null }>({ root: null });

interface IShadowDomProps extends HTMLAttributes<HTMLDivElement> {
    uiTheme?: IUIThemeConfig;
    onMount?: (shadowRoot: ShadowRoot) => void;
    onUnmount?: () => void;
}

export const ShadowDom: React.FC<IShadowDomProps> = function ShadowDom({ onMount, onUnmount, children, uiTheme = zincTheme, ...attrs }) {
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const onMountRef = useRef(onMount);
    onMountRef.current = onMount;
    const onUnmountRef = useRef(onUnmount);
    onUnmountRef.current = onUnmount;

    const colorStyle = useMemo(() => ColorConfigToCSS(uiTheme), [uiTheme]);

    useEffect(() => {
        if (rootRef.current) {
            const shadowRoot = rootRef.current.shadowRoot!;
            setShadowRoot(shadowRoot);
            onMountRef.current?.(shadowRoot);
            return () => {
                onUnmountRef.current?.();
            };
        }
    }, []);

    return (
        <root.div {...attrs} mode="open" ref={rootRef}>
            <uiThemeContext.Provider value={uiTheme}>
                <style>{tailwindStyle}</style>
                <style>{style}</style>
                <style>{colorStyle}</style>
                {/* Leaflet CSS file */}
                <style>{leafletStyle}</style>
                {shadowRoot && (
                    <StyleSheetManager target={shadowRoot}>
                        <ShadowDomContext.Provider value={{ root: shadowRoot }}>{children}</ShadowDomContext.Provider>
                    </StyleSheetManager>
                )}
            </uiThemeContext.Provider>
        </root.div>
    );
};
