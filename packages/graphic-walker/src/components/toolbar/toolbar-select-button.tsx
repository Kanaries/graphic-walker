import React, { memo, useEffect, useRef } from "react";
import styled from "styled-components";
import produce from "immer";
import { IToolbarItem, IToolbarProps, ToolbarItemContainer } from "./toolbar-item";
import { ToolbarContainer, useHandlers, ToolbarItemContainerElement } from "./components";
import Callout from "../callout";


const OptionGroup = styled(ToolbarContainer)`
    flex-direction: column;
    width: max-content;
    height: max-content;
    --aside: 8px;
    --background-color: #f7f7f7;
    --background-color-hover: #fefefe;
    --color: #777;
    --color-hover: #555;
    --blue: #282958;
    --dark-mode-background-color: #1f1f1f;
        --dark-mode-background-color-hover: #2f2f2f;
        --dark-mode-color: #aaa;
        --dark-mode-color-hover: #ccc;
        --dark-mode-blue: #282958;
    background-color: var(--background-color);
    // dark mode
    @media (prefers-color-scheme: dark) {
        /* --dark-mode-background-color: #1f1f1f;
        --dark-mode-background-color-hover: #2f2f2f;
        --dark-mode-color: #aaa;
        --dark-mode-color-hover: #ccc;
        --dark-mode-blue: #282958; */
        background-color: var(--dark-mode-background-color);
    }
`;

const Option = styled(ToolbarItemContainerElement)`
    width: unset;
    height: var(--height);
    position: relative;
    font-size: 95%;
    padding-left: var(--aside);
    padding-right: 1em;
    align-items: center;
    &[aria-selected="true"] {
        ::before {
            display: block;
            position: absolute;
            content: "";
            left: calc(var(--aside) / 2);
            width: calc(var(--aside) / 2);
            top: calc(var(--height) / 8);
            bottom: calc(var(--height) / 8);
            background-color: var(--blue);
        }
    }
    > label {
        user-select: none;
        pointer-events: none;
    }
    :hover, &[aria-selected="true"] {
        color: var(--color-hover);
    }
`;

const TriggerFlag = styled.span`
    pointer-events: none;
    position: absolute;
    bottom: 0;
    left: 50%;
`;

export interface ToolbarSelectButtonItem<T extends string = string> extends IToolbarItem {
    options: {
        key: T;
        icon: (props: React.SVGProps<SVGSVGElement> & {
            title?: string | undefined;
            titleId?: string | undefined;
        }) => JSX.Element;
        label: string;
        /** @default false */
        disabled?: boolean;
    }[];
    value: T;
    onSelect: (value: T) => void;
}

const ToolbarSelectButton = memo<IToolbarProps<ToolbarSelectButtonItem>>(function ToolbarSelectButton(props) {
    const { item, styles, openedKey, setOpenedKey } = props;
    const { key, icon: Icon, disabled, options, value, onSelect } = item;
    const id = `${key}::button`;
    
    const opened = openedKey === id;
    const handlers = useHandlers(() => {
        setOpenedKey(opened ? null : id);
    }, disabled ?? false);

    const openedRef = useRef(opened);
    openedRef.current = opened;

    useEffect(() => {
        if (opened) {
            const close = (e?: unknown) => {
                if (!openedRef.current) {
                    return;
                }
                if (!e) {
                    setOpenedKey(null);
                } else if (e instanceof KeyboardEvent && e.key === 'Escape') {
                    setOpenedKey(null);
                } else if (e instanceof MouseEvent) {
                    setTimeout(() => {
                        if (openedRef.current) {
                            setOpenedKey(null);
                        }
                    }, 100);
                }
            };

            document.addEventListener('mousedown', close);
            document.addEventListener('keydown', close);

            return () => {
                document.removeEventListener('mousedown', close);
                document.removeEventListener('keydown', close);
            };
        }
    }, [setOpenedKey, opened]);

    const currentOption = options.find(opt => opt.key === value);
    const CurrentIcon = currentOption?.icon;

    const mergedIconStyles = {
        ...styles?.icon,
        ...item.styles?.icon,
    };

    return (
        <>
            <ToolbarItemContainer
                props={produce(props, draft => {
                    if (currentOption) {
                        draft.item.label = `${draft.item.label}: ${currentOption.label}`;
                    }
                })}
                handlers={handlers}
                aria-haspopup="listbox"
            >
                <Icon style={mergedIconStyles} />
                {CurrentIcon && (
                    <CurrentIcon
                        style={{
                            position: 'absolute',
                            left: 'calc(var(--height) - var(--icon-size) * 1.2)',
                            bottom: 'calc((var(--height) - var(--icon-size)) * 0.1)',
                            width: 'calc(var(--icon-size) * 0.6)',
                            height: 'calc(var(--icon-size) * 0.6)',
                            margin: 'calc((var(--height) - var(--icon-size)) * 0.2)',
                            pointerEvents: 'none',
                            ...mergedIconStyles,
                        }}
                    />
                )}
                <TriggerFlag aria-hidden id={id} />
            </ToolbarItemContainer>
            {opened && (
                <Callout target={`#${id}`}>
                    <OptionGroup role="listbox" aria-activedescendant={`${id}::${value}`} aria-describedby={id} aria-disabled={disabled} onMouseDown={e => e.stopPropagation()}>
                        {options.map((option, idx, arr) => {
                            const selected = option.key === value;
                            const OptionIcon = option.icon;
                            const optionId = `${id}::${value}`;
                            const prev = arr[(idx + arr.length - 1) % arr.length];
                            const next = arr[(idx + 1) % arr.length];
                            return (
                                <Option
                                    key={option.key}
                                    id={optionId}
                                    role="option"
                                    aria-disabled={option.disabled ?? false}
                                    aria-selected={selected}
                                    split={false}
                                    tabIndex={0}
                                    onClick={() => {
                                        onSelect(option.key);
                                        setOpenedKey(null);
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'ArrowDown') {
                                            onSelect(next.key);
                                        } else if (e.key === 'ArrowUp') {
                                            onSelect(prev.key);
                                        }
                                    }}
                                    ref={e => {
                                        if (e && selected) {
                                            e.focus();
                                        }
                                    }}
                                >
                                    <OptionIcon style={styles?.icon} />
                                    <label className="text-xs">{option.label}</label>
                                </Option>
                            );
                        })}
                    </OptionGroup>
                </Callout>
            )}
        </>
    );
});


export default ToolbarSelectButton;
