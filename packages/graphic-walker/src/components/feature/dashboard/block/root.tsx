import React, { useCallback, useEffect, useRef, MouseEventHandler, PropsWithChildren } from 'react';
import styled from 'styled-components';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useDashboardContext } from '../../../../store/dashboard';
import type { DashboardBlock } from '../../../../store/dashboard/interfaces';


const Root = styled.div<{ isSelected: boolean }>`
    flex-grow: 1;
    flex-shrink: 1;
    flex-basis: 0%;
    background-color: var(--card-background);
    outline: none;
    border: 2px dashed;
    border-color: ${({ isSelected }) => isSelected ? 'var(--outline)' : 'transparent'};
    overflow: hidden;
    > * {
        width: 100%;
        height: 100%;
    }
`;

const BlockRoot = observer<PropsWithChildren<{ data: DashboardBlock }>>(function BlockRoot ({ data, children }) {
    const ctx = useDashboardContext();
    const { selections, dashboard } = ctx;

    const isRoot = dashboard?.items === data;
    const isSelected = selections.some(b => b === data);

    const handleSelect = useCallback<MouseEventHandler<HTMLDivElement>>(ev => {
        ev.stopPropagation();
        if (isRoot) {
            ctx.clearSelections();
        } else {
            ctx.toggleSelect(data, ev.metaKey);
        }
    }, [data, isRoot, ctx]);

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const d = data as { __ref__?: HTMLDivElement | null };
        runInAction(() => {
            d.__ref__ = ref.current;
        });
        return () => {
            runInAction(() => {
                delete d['__ref__'];
            });
        };
    }, [data]);

    return (
        <Root
            onClick={handleSelect}
            isSelected={isSelected}
            ref={ref}
        >
            {children}
        </Root>
    );
});


export default BlockRoot;
