import React, { CSSProperties } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { GLOBAL_CONFIG } from '../config';

export const FieldListContainer: React.FC<{
    name: string;
    style?: Omit<CSSProperties, 'translate'>;
    children?: React.ReactNode | Iterable<React.ReactNode>;
}> = (props) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.draggable_key' });

    return (
        <FieldListSegment className="sm:ml-0.5 my-0.5 border relative" style={props.style}>
            <div className="fl-header border-r cursor-default select-none">
                <h4 className="font-normal">{t(props.name)}</h4>
            </div>
            <div className="fl-container overflow-hidden">{props.children}</div>
        </FieldListSegment>
    );
};

export const AestheticFieldContainer: React.FC<{ name: string; style?: CSSProperties; children?: React.ReactNode | Iterable<React.ReactNode> }> = (props) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.draggable_key' });

    return (
        <div className="my-0.5 sm:mx-0.5 text-xs border" style={props.style}>
            <div className="border-b p-2 cursor-default select-none">
                <h4 className="font-normal">{t(props.name)}</h4>
            </div>
            <div>{props.children}</div>
        </div>
    );
};

export const FilterFieldContainer: React.FC<{ children?: React.ReactNode | Iterable<React.ReactNode> }> = (props) => {
    const { t } = useTranslation('translation', { keyPrefix: 'constant.draggable_key' });

    return (
        <div className="my-0.5 sm:mx-0.5 text-xs border">
            <div className="border-b p-2 cursor-default select-none">
                <h4 className="font-normal">{t('filters')}</h4>
            </div>
            <div>{props.children}</div>
        </div>
    );
};

export const FieldsContainer = styled.div`
    display: flex;
    padding: 0.2em;
    min-height: 2.4em;
    flex-wrap: wrap;
    > div {
        margin: 1px;
    }
    touch-action: none;
`;

export const FilterFieldsContainer = styled.div({
    display: 'flex',
    flexDirection: 'column',
    paddingBlock: '0.5em 0.8em',
    paddingInline: '0.2em',
    minHeight: '4em',
    '> div': {
        marginBlock: '0.3em',
        marginInline: '1px',
    },
});

export const FieldListSegment = styled.div`
    display: flex;
    font-size: 12px;
    div.fl-header {
        /* flex-basis: 100px; */
        width: 100px;
        flex-shrink: 0;
        h4 {
            margin: 0.6em;
            font-weight: 400;
        }
    }
    div.fl-container {
        flex-grow: 10;
        position: relative;
    }
`;

export const FilterFieldSegment = styled.div`
    border: 1px solid #e5e7eb;
    @media (prefers-color-scheme: dark) {
        border: 1px solid #2d3748;
    }
    font-size: 12px;
    margin: 0.2em;

    .flt-header {
        border-bottom: 1px solid #e5e7eb;
        @media (prefers-color-scheme: dark) {
            border-bottom: 1px solid #2d3748;
        }
        padding: 0.6em;

        > h4 {
            font-weight: 400;
        }
    }

    .flt-container {
    }
`;

export const Pill = styled.div<{ colType: 'discrete' | 'continuous' }>`
    background-color: ${(props) => (props.colType === 'continuous' ? 'hsl(var(--background))' : 'hsl(var(--primary))')};
    border-color: ${(props) => (props.colType === 'continuous' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--background))')};
    color: ${(props) => (props.colType === 'continuous' ? 'hsl(var(--foreground))' : 'hsl(var(--primary-foreground))')};
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-align-items: center;
    -webkit-user-select: none;
    align-items: center;
    border-radius: calc(var(--radius) - 2px);
    border-style: solid;
    border-width: 1px;
    box-sizing: border-box;
    cursor: default;
    display: -webkit-flex;
    display: flex;
    font-size: 12px;
    height: 20px;
    min-width: 150px;
    max-width: 300px;
    /* overflow-y: hidden; */
    padding: 0 10px;
    user-select: none;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* --tw-ring-offset-shadow: 0 0 #0000;
    --tw-ring-shadow: 0 0 #0000;
    --tw-shadow-color: rgb(6 182 212/0.5);
    --tw-shadow: var(--tw-shadow-colored);
    --tw-shadow-colored: 0 10px 15px -3px var(--tw-shadow-color),0 4px 6px -4px var(--tw-shadow-color);
    box-shadow: var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow); */
`;
