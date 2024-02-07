import React, { HTMLAttributes, createContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheetManager } from 'styled-components';
import root from 'react-shadow';

import tailwindStyle from 'tailwindcss/tailwind.css?inline';
import style from './index.css?inline';
import { IColorConfig } from './interfaces';
import { ColorConfigToCSS, zincTheme } from './utils/colors';
import { colorContext } from './store/theme';

export const ShadowDomContext = createContext<{ root: ShadowRoot | null }>({ root: null });

interface IShadowDomProps extends HTMLAttributes<HTMLDivElement> {
    colorConfig?: IColorConfig;
    onMount?: (shadowRoot: ShadowRoot) => void;
    onUnmount?: () => void;
}

export const ShadowDom: React.FC<IShadowDomProps> = function ShadowDom({ onMount, onUnmount, children, colorConfig = zincTheme, ...attrs }) {
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const onMountRef = useRef(onMount);
    onMountRef.current = onMount;
    const onUnmountRef = useRef(onUnmount);
    onUnmountRef.current = onUnmount;

    const colorStyle = useMemo(() => ColorConfigToCSS(colorConfig), [colorConfig]);

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
            <colorContext.Provider value={colorConfig}>
                <style>{tailwindStyle}</style>
                <style>{style}</style>
                <style>{colorStyle}</style>
                {/* Leaflet CSS file */}
                <link
                    rel="stylesheet"
                    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
                    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
                    crossOrigin=""
                />
                {shadowRoot && (
                    <StyleSheetManager target={shadowRoot}>
                        <ShadowDomContext.Provider value={{ root: shadowRoot }}>{children}</ShadowDomContext.Provider>
                    </StyleSheetManager>
                )}
            </colorContext.Provider>
        </root.div>
    );
};
