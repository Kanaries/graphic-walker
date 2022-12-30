import React, { memo, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { ShadowDomContext } from "..";


export interface TooltipProps {
    children: JSX.Element;
    content: string | JSX.Element | JSX.Element[];
}

const attrName = 'data-tooltip-host-id';
let flag = 0;

const Bubble = styled.div`
    transform: translate(-50%, -100%);
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.15)) drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.12));
    ::before {
        content: "";
        display: block;
        position: absolute;
        bottom: 0;
        left: 50%;
        width: 8px;
        height: 8px;
        transform: translate(-50%, 50%) rotate(45deg);
        background-color: #fff;
    }
`;

const Tooltip = memo<TooltipProps>(function Tooltip ({ children, content }) {
    const hostId = useMemo(() => flag++, []);
    const [pos, setPos] = useState<[number, number]>([0, 0]);
    const [show, setShow] = useState(false);
    const [hover, setHover] = useState(false);
    const shadowDomMeta = useContext(ShadowDomContext);
    const { root } = shadowDomMeta;
    const element = typeof children === 'object' ? { ...children as any } : children;
    if ('props' in element) {
        element.props = {
            ...element.props,
            [attrName]: hostId,
        };
    }

    useEffect(() => {
        const item = root?.querySelector(`[${attrName}="${hostId}"]`) as HTMLElement | null;
        if (item) {
            const handleMouseOver = () => {
                const rect = item.getBoundingClientRect();
                setPos([rect.x + rect.width / 2, rect.y]);
                setShow(true);
            };
            const handleMouseOut = () => setShow(false);
            item.addEventListener('mouseover', handleMouseOver);
            item.addEventListener('mouseout', handleMouseOut);
            return () => {
                item.removeEventListener('mouseover', handleMouseOver);
                item.removeEventListener('mouseout', handleMouseOut);
            };
        }
    }, [root, hostId]);

    return (
        <>
            {element}
            {(show || hover) && root && createPortal(
                <Bubble
                    className="fixed text-xs p-1 px-3 text-gray-500 bg-white z-50"
                    onMouseOver={() => setHover(true)}
                    onMouseOut={() => setHover(false)}
                    style={{ left: pos[0], top: pos[1] }}
                >
                    {content}
                </Bubble>,
                root
            )}
        </>
    );
});


export default Tooltip;
