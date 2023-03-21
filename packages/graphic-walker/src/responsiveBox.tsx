/**
 * This component is used to check the responsive layout of the box,
 * to ensure that the appearance of GraphicWalker is correct in containers of different sizes or ratios.
 * And it should be imported only in the development environment,
 * from the entry file `main.tsx`.
 * 
 * And please notice that this component is outside the scope of the GraphicWalker component,
 * thus tailwind css will not work here.
 */

import React, { FC, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { GraphicWalker } from ".";

const Container = styled.div`
    display: flex;
    flex-direction: column;
    padding: 30px;
    > *:not(:first-child) {
        margin-top: 20px;
    }
`;

const Box = styled.div<{ active: boolean }>`
    position: relative;
    user-select: ${({ active }) => active ? 'none' : 'unset'};
`;

const ContentBody = styled.div<{ active: boolean }>`
    overflow: hidden;
    border: 1px solid ${({ active }) => active ? '#e5e7eb' : 'transparent'};
    background-color: ${({ active }) => active ? 'rgb(229 231 235)' : 'unset'};
`;

const ResizeHandler = styled.div<{ active: boolean; at: 'right' | 'bottom' }>`
    position: absolute;
    ${({ at }) => at === 'right' ? `
        top: 0px;
        bottom: 0px;
        left: 100%;
        padding-inline: 8px;
        cursor: ew-resize;
        > .bar {
            height: 32px;
            width: 6px;
        }
    ` : `
        left: 0px;
        right: 0px;
        top: 100%;
        padding-block: 8px;
        flex-direction: column;
        cursor: ns-resize;
        > .bar {
            width: 32px;
            height: 6px;
        }
    `}
    display: ${({ active }) => active ? 'flex' : 'none'};
    align-items: center;
    opacity: 0.8;
    :hover {
        opacity: 1;
    }
    > .bar {
        border-radius: 9999px;
        background-color: rgb(148 163 184);
        pointer-events: none;
    }
`;

const MIN_SIZE = 320;

const ResponsiveBox: FC = () => {
    const [hideDS, setHideDS] = useState(false);
    const [doResize, setDoResize] = useState(true);
    const [allowScroll, setAllowScroll] = useState(true);
    const [width, setWidth] = useState(window.innerWidth - 160);
    const [height, setHeight] = useState(window.innerHeight - 160);

    const targetRef = useRef<HTMLDivElement>(null);

    const resizingDirRef = useRef<'horizontal' | 'vertical' | 'none'>('none');
    const beginCoordRef = useRef(0);
    const cursorOffsetRef = useRef(0);

    useEffect(() => {
        const target = targetRef.current;
        if (!target) {
            return;
        }
        const resizeHandler = (e: MouseEvent) => {
            switch (resizingDirRef.current) {
                case 'horizontal': {
                    setWidth(
                        Math.min(
                            window.innerWidth - 160,
                            Math.max(
                                MIN_SIZE,
                                e.clientX - target.getBoundingClientRect().left - cursorOffsetRef.current
                            )
                        )
                    );
                    break;
                }
                case 'vertical': {
                    setHeight(
                        Math.min(
                            window.innerHeight - 160,
                            Math.max(
                                MIN_SIZE,
                                e.clientY - target.getBoundingClientRect().top - cursorOffsetRef.current
                            )
                        )
                    );
                    break;
                }
                case 'none':
                default: {
                    break;
                }
            }
        };
        const resizeEndHandler = () => {
            if (resizingDirRef.current === 'none') {
                return;
            }
            resizingDirRef.current = 'none';
        };
        document.addEventListener('mousemove', resizeHandler);
        document.addEventListener('mouseup', resizeEndHandler);
        document.addEventListener('visibilitychange', resizeEndHandler);
        return () => {
            document.removeEventListener('mousemove', resizeHandler);
            document.removeEventListener('mouseup', resizeEndHandler);
            document.removeEventListener('visibilitychange', resizeEndHandler);
        };
    }, []);

    return (
        <Container>
            <label>
                <input type="checkbox" checked={hideDS} onChange={e => setHideDS(e.target.checked)} />
                Hide Dataset Panel
            </label>
            <label>
                <input type="checkbox" checked={doResize} onChange={e => setDoResize(e.target.checked)} />
                Toggle Resize
            </label>
            <label>
                <input type="checkbox" checked={allowScroll} onChange={e => setAllowScroll(e.target.checked)} />
                Allow Scroll
            </label>
            <Box ref={targetRef} active={doResize} style={{ width, height }}>
                <ContentBody active={doResize} style={{ width, height }}>
                    <GraphicWalker hideDataSourceConfig={hideDS} overflowMode={allowScroll ? 'auto' : 'hidden'} themeKey="g2" />
                </ContentBody>
                <ResizeHandler
                    active={doResize}
                    at="right"
                    onMouseDown={e => {
                        resizingDirRef.current = 'horizontal';
                        beginCoordRef.current = e.clientX;
                        cursorOffsetRef.current = e.clientX - (e.target as HTMLDivElement).getBoundingClientRect().left;
                    }}
                >
                    <div className="bar" />
                </ResizeHandler>
                <ResizeHandler
                    active={doResize}
                    at="bottom"
                    onMouseDown={e => {
                        resizingDirRef.current = 'vertical';
                        beginCoordRef.current = e.clientY;
                        cursorOffsetRef.current = e.clientY - (e.target as HTMLDivElement).getBoundingClientRect().top;
                    }}
                >
                    <div className="bar" />
                </ResizeHandler>
            </Box>
        </Container>
    );
};


export default ResponsiveBox;
