import React, { memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import type { IDarkMode } from "../interfaces";
import { ShadowDomContext } from "../shadow-dom";
import { useCurrentMediaTheme } from "../utils/media";

export interface TooltipProps {
    children: JSX.Element;
    content: string | JSX.Element | JSX.Element[];
    /** @default 250 */
    showDelay?: number;
    /** @default 250 */
    hideDelay?: number;
    /** @default 3_000 */
    autoHide?: number;
    darkModePreference: IDarkMode;
}

const attrName = "data-tooltip-host-id";
let flag = 0;

const Bubble = styled.div<{ dark: boolean }>`
    border-radius: 1px;
    transform: translate(-50%, -100%);
    filter: drop-shadow(0 1.6px 1.2px rgba(0, 0, 0, 0.15)) drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.12));
    user-select: none;
    ::before {
        content: "";
        display: block;
        position: absolute;
        bottom: 0;
        left: 50%;
        width: 8px;
        height: 8px;
        transform: translate(-50%, 50%) rotate(45deg);
        background-color: ${({ dark }) => dark ? '#000' : '#fff'};
        border-radius: 1px;
    }
`;

const Tooltip = memo<TooltipProps>(function Tooltip({
    children,
    content,
    autoHide = 3_000,
    showDelay = 250,
    hideDelay = 250,
    darkModePreference = 'media',
}) {
    const hostId = useMemo(() => flag++, []);
    const [pos, setPos] = useState<[number, number]>([0, 0]);
    const [show, setShow] = useState(false);
    const [hover, setHover] = useState(false);
    const shadowDomMeta = useContext(ShadowDomContext);
    const { root } = shadowDomMeta;
    const element = typeof children === "object" ? { ...(children as any) } : children;
    if ("props" in element) {
        element.props = {
            ...element.props,
            [attrName]: hostId,
        };
    }

    const autoHideRef = useRef(autoHide);
    autoHideRef.current = autoHide;
    const showDelayRef = useRef(showDelay);
    showDelayRef.current = showDelay;
    const hideDelayRef = useRef(hideDelay);
    hideDelayRef.current = hideDelay;

    useEffect(() => {
        const item = root?.querySelector(`[${attrName}="${hostId}"]`) as HTMLElement | null;
        if (item) {
            let showTimer: NodeJS.Timeout | null = null;
            let hideTimer: NodeJS.Timeout | null = null;
            let autoHideTimer: NodeJS.Timeout | null = null;
            const resetTimers = () => {
                for (const timer of [showTimer, hideTimer, autoHideTimer]) {
                    if (timer) {
                        clearTimeout(timer);
                    }
                }
            };
            const handleMouseOver = () => {
                resetTimers();
                showTimer = setTimeout(() => {
                    const rect = item.getBoundingClientRect();
                    setPos([rect.x + rect.width / 2, rect.y]);
                    setShow(true);
                    autoHideTimer = setTimeout(() => {
                        handleMouseOut();
                    }, autoHideRef.current);
                }, showDelayRef.current);
            };
            const handleMouseMove = () => {
                for (const timer of [hideTimer, autoHideTimer]) {
                    if (timer) {
                        clearTimeout(timer);
                    }
                }
                autoHideTimer = setTimeout(() => {
                    handleMouseOut();
                }, autoHideRef.current);
            };
            const handleMouseOut = () => {
                resetTimers();
                hideTimer = setTimeout(() => {
                    setShow(false);
                }, hideDelayRef.current);
            };
            item.addEventListener("mouseover", handleMouseOver);
            item.addEventListener("mousemove", handleMouseMove);
            item.addEventListener("mouseout", handleMouseOut);
            return () => {
                item.removeEventListener("mouseover", handleMouseOver);
                item.removeEventListener("mousemove", handleMouseMove);
                item.removeEventListener("mouseout", handleMouseOut);
                if (autoHideTimer) {
                    clearTimeout(autoHideTimer);
                }
            };
        }
    }, [root, hostId]);

    const darkMode = useCurrentMediaTheme(darkModePreference);
    
    return (
        <>
            {element}
            {(show || hover) &&
                root &&
                createPortal(
                    <Bubble
                        className={`${darkMode === 'dark' ? 'dark bg-zinc-900' : 'bg-white'} fixed text-xs p-1 px-3 text-gray-500 z-50`}
                        dark={darkMode === 'dark'}
                        onMouseOver={() => setHover(true)}
                        onMouseOut={() => setHover(false)}
                        style={{ left: pos[0], top: pos[1] - 4 }}
                    >
                        {content}
                    </Bubble>,
                    root
                )}
        </>
    );
});

export default Tooltip;
