import React, { memo, ReactNode, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import type { IDarkMode } from "../interfaces";
import { ShadowDomContext } from "../shadow-dom";
import { useCurrentMediaTheme } from "../utils/media";

export interface CalloutProps {
    target: string;
    children: ReactNode;
    darkModePreference?: IDarkMode;
}

const Bubble = styled.div<{ dark: boolean }>`
    border-radius: 1px;
    transform: translate(-50%, 0);
    filter: drop-shadow(0 1.6px 1px rgba(0, 0, 0, 0.24)) drop-shadow(0 -1px 0.8px rgba(0, 0, 0, 0.19));
    user-select: none;
    display: block;
    width: max-content;
    height: max-content;
    ::before {
        content: "";
        display: block;
        position: absolute;
        top: 0;
        left: 50%;
        width: 8px;
        height: 8px;
        transform: translate(-50%, -50%) rotate(45deg);
        background-color: ${({ dark }) => dark ? "#000" : "#fff"};
        border-radius: 1px;
    }
`;

const Callout = memo<CalloutProps>(function Callout({ target, children, darkModePreference = 'media' }) {
    const shadowDomMeta = useContext(ShadowDomContext);
    const { root } = shadowDomMeta;
    const [pos, setPos] = useState<[number, number] | null>(null);

    useEffect(() => {
        const el = (
            target.startsWith("#") ? root?.getElementById(target.slice(1)) : root?.querySelector(target)
        ) as HTMLElement | null;
        if (el) {
            const rect = el.getBoundingClientRect();
            setPos([rect.x + rect.width / 2, rect.y + rect.height]);
        }
    }, [target, root]);

    const darkMode = useCurrentMediaTheme(darkModePreference);

    return (
        root &&
        pos &&
        createPortal(
            <Bubble role="dialog" dark={darkMode === 'dark'} className="fixed bg-white dark:bg-zinc-900  z-50" style={{ left: pos[0], top: pos[1] + 4 }}>
                {children}
            </Bubble>,
            root
        )
    );
});

export default Callout;
