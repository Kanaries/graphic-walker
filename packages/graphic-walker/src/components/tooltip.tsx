import React, { memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { ShadowDomContext } from "..";

export interface TooltipProps {
    children: JSX.Element;
    content: string | JSX.Element | JSX.Element[];
    /** @default false */
    disabled?: boolean;
    /** @default 250 */
    showDelay?: number;
    /** @default 250 */
    hideDelay?: number;
    /** @default 3_000 */
    autoHide?: number;
    /** @default "top" */
    at?: 'top' | 'right' | 'bottom' | 'left';
    /** @default 0 */
    distance?: number;
    /** @default "none" */
    overflowMode?: 'none' | 'parent' | 'children';
}

const attrName = "data-tooltip-host-id";
let flag = 0;

const Bubble = styled.div`
    border-radius: 1px;
    filter: drop-shadow(0 1.6px 1.2px rgba(0, 0, 0, 0.15)) drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.12));
    user-select: none;
    ::before {
        content: "";
        display: block;
        position: absolute;
        width: 8px;
        height: 8px;
        background-color: #fff;
        border-radius: 1px;
    }
    &.top {
        transform: translate(-50%, -100%);
        ::before {
            bottom: 0;
            left: 50%;
            transform: translate(-50%, 50%) rotate(45deg);
        }
    }
    &.right {
        transform: translate(0, -50%);
        ::before {
            left: 0;
            top: 50%;
            transform: translate(-50%, -50%) rotate(45deg);
        }
    }
    &.bottom {
        transform: translate(-50%, 100%);
        ::before {
            top: 0;
            left: 50%;
            transform: translate(-50%, -50%) rotate(45deg);
        }
    }
    &.left {
        transform: translate(-100%, -50%);
        ::before {
            right: 0;
            top: 50%;
            transform: translate(50%, -50%) rotate(45deg);
        }
    }
`;

const Tooltip = memo<TooltipProps>(function Tooltip({
    children,
    content,
    disabled = false,
    autoHide = 3_000,
    showDelay = 250,
    hideDelay = 250,
    at = 'top',
    distance = 0,
    overflowMode = 'none',
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
        if (disabled) {
            setShow(false);
            return;
        }
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
                if (overflowMode === 'parent') {
                    if (item.scrollWidth <= item.offsetWidth && item.scrollHeight <= item.offsetHeight) {
                        return;
                    }
                } else if (overflowMode === 'children') {
                    let anyChildOverflowing = false;
                    for (const child of item.children) {
                        if (!(child instanceof HTMLElement)) {
                            continue;
                        }
                        if (child.scrollWidth > child.offsetWidth || child.scrollHeight > child.offsetHeight) {
                            anyChildOverflowing = true;
                            break;
                        }
                    }
                    if (!anyChildOverflowing) {
                        return;
                    }
                }
                showTimer = setTimeout(() => {
                    const rect = item.getBoundingClientRect();
                    switch (at) {
                        case 'top': {
                            setPos([rect.x + rect.width / 2, rect.y]);
                            break;
                        }
                        case 'right': {
                            setPos([rect.x + rect.width, rect.y + rect.height / 2]);
                            break;
                        }
                        case 'bottom': {
                            setPos([rect.x + rect.width / 2, rect.y + rect.height / 2]);
                            break;
                        }
                        case 'left': {
                            setPos([rect.x, rect.y + rect.height / 2]);
                            break;
                        }
                        default: {
                            return;
                        }
                    }
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
    }, [at, root, hostId, disabled, overflowMode]);

    return (
        <>
            {element}
            {(show || hover) &&
                root &&
                createPortal(
                    <Bubble
                        className={`${at} fixed text-xs p-1 px-3 text-gray-500 bg-white z-50`}
                        onMouseOver={() => setHover(true)}
                        onMouseOut={() => setHover(false)}
                        style={{
                            top: { left: pos[0], top: pos[1] - distance },
                            right: { left: pos[0] + distance, top: pos[1] },
                            bottom: { left: pos[0], top: pos[1] + distance },
                            left: { left: pos[0] - distance, top: pos[1] },
                        }[at]}
                    >
                        {content}
                    </Bubble>,
                    root
                )}
        </>
    );
});

export default Tooltip;
