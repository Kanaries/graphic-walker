import React, { memo, ReactNode, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { ShadowDomContext } from "..";

export interface CalloutProps {
    target: string;
    children: ReactNode;
}

const Bubble = styled.div`
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
        background-color: #fff;
        border-radius: 1px;
        @media (prefers-color-scheme: dark) {
            background-color: #000;
        }
    }
`;

const Callout = memo<CalloutProps>(function Callout({ target, children }) {
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

    return (
        root &&
        pos &&
        createPortal(
            <Bubble role="dialog" className="fixed bg-white dark:bg-zinc-900  z-50" style={{ left: pos[0], top: pos[1] + 4 }}>
                {children}
            </Bubble>,
            root
        )
    );
});

export default Callout;
