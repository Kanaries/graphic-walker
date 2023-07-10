import React, { HTMLAttributes, createContext, useEffect, useRef, useState } from "react";
import { StyleSheetManager } from "styled-components";
import root from "react-shadow";

import tailwindStyle from "tailwindcss/tailwind.css?inline";
import style from "./index.css?inline";

export const ShadowDomContext = createContext<{ root: ShadowRoot | null }>({ root: null });

interface IShadowDomProps extends HTMLAttributes<HTMLDivElement> {
    onMount?: (shadowRoot: ShadowRoot) => void;
    onUnmount?: () => void;
}

export const ShadowDom: React.FC<IShadowDomProps> = function ShadowDom ({ onMount, onUnmount, children, ...attrs }) {
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const onMountRef = useRef(onMount);
    onMountRef.current = onMount;
    const onUnmountRef = useRef(onUnmount);
    onUnmountRef.current = onUnmount;

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
            <style>{tailwindStyle}</style>
            <style>{style}</style>
            {shadowRoot && (
                <StyleSheetManager target={shadowRoot}>
                    <ShadowDomContext.Provider value={{ root: shadowRoot }}>
                        {children}
                    </ShadowDomContext.Provider>
                </StyleSheetManager>
            )}
        </root.div>
    );
};
