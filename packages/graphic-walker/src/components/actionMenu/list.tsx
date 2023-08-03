import React, { memo, type ComponentProps, type ReactElement, createContext, useState, useContext, useMemo, useEffect } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";


function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

export interface IActionMenuItem {
    icon?: ReactElement;
    label: string;
    disabled?: boolean;
    children?: IActionMenuItem[];
    onPress?: () => void;
}

const List = styled.div`
    display: grid;
    grid-template-columns: max-content 1fr max-content;
    & > div {
        /* row */
        display: contents;
        > * {
            background: inherit;
            cursor: pointer;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            overflow: hidden;
            padding-block: 0.2rem;
            padding-inline: 0.2rem;
            &:first-child {
                padding-left: 0.4rem;
            }
        }
        &[aria-disabled="true"] > * {
            opacity: 0.5;
            cursor: default;
        }
    }
`;

const FixedTarget = memo(function FixedTarget(props: ComponentProps<"div">) {
    const { children, ...attrs } = props;

    return (
        <div className="absolute top-0 right-0">
            <div
                {...attrs}
                style={{
                    ...attrs.style,
                    position: "fixed",
                }}
            >
                {children}
            </div>
        </div>
    );
});

interface IActionMenuRootContext {
    path: number[];
    setPath: (path: number[]) => void;
    onDismiss: () => void;
}

const Context = createContext<IActionMenuRootContext>(null!);

interface IActionMenuItemProps {
    item: IActionMenuItem;
    path: number[];
}

const ActionMenuItem = memo<IActionMenuItemProps>(function ActionMenuItem({ item, path }) {
    const { icon, label, disabled = false, children = [], onPress } = item;
    const [hover, setHover] = useState(false);
    const [focus, setFocus] = useState(false);
    
    const ctx = useContext(Context);

    const expanded = children.length > 0 && ctx.path.length > 0 && path.length <= ctx.path.length && path.every((v, i) => v === ctx.path[i]);

    const active = !disabled && (hover || focus || expanded);

    const basePath = useMemo(() => {
        let idx = ctx.path.findIndex((v, i) => v !== path[i]);
        if (idx !== -1) {
            return ctx.path.slice(0, idx);
        }
        return ctx.path;
    }, [ctx.path, path]);

    useEffect(() => {
        if (children.length === 0 && (hover || focus)) {
            if (basePath.join(".") !== ctx.path.join(".")) {
                ctx.setPath(basePath);
            }
        }
    }, [children.length, hover, focus, ctx, basePath]);

    return (
        <div
            tabIndex={disabled ? undefined : 0}
            role="button"
            aria-haspopup={children.length ? "menu" : undefined}
            aria-disabled={disabled}
            className={classNames(
                active ? "bg-gray-100/50 text-gray-900 dark:bg-gray-800/50 dark:text-gray-50" : "text-gray-700 dark:text-gray-200",
                disabled ? "" : "cursor-pointer",
                "text-sm",
            )}
            onClick={e => {
                if (disabled || children.length) {
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }
                if (!disabled) {
                    onPress?.();
                    ctx.onDismiss();
                }
            }}
            onFocus={() => {
                if (!disabled) {
                    setFocus(true);
                }
                if (children.length && !expanded) {
                    ctx.setPath(path);
                }
            }}
            onBlur={() => {
                setFocus(false);
            }}
            onMouseEnter={() => {
                setHover(true);
                if (children.length && !expanded && !disabled) {
                    ctx.setPath(path);
                }
            }}
            onMouseLeave={() => {
                setHover(false);
            }}
            onKeyDown={e => {
                if (disabled || children.length) {
                    return;
                }
                if (e.key === 'Enter' || e.key === 'Space') {
                    onPress?.();
                    ctx.onDismiss();
                }
            }}
        >
            <div
                aria-hidden="true"
            >
                {icon}
            </div>
            <div
                onClick={() => {
                    // props.onSelect && !props.disable && props.onSelect(option.value, index);
                }}
            >
                <span className="truncate self-start">
                    {label}
                </span>
            </div>
            <div
                aria-hidden="true"
                className="relative"
            >
                {children.length > 0 && (
                    <>
                        <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
                        {expanded && (
                            <FixedTarget className="z-50 min-w-[8rem] max-w-[16rem] bg-white dark:bg-zinc-900 shadow-lg border border-gray-50 dark:border-gray-800 focus:outline-none">
                                <MenuItemList items={children} path={path} />
                            </FixedTarget>
                        )}
                    </>
                )}
            </div>
        </div>
    );
});

interface IActionMenuItemListProps {
    items: IActionMenuItem[];
    path: number[];
}

const MenuItemList = memo<IActionMenuItemListProps>(function ActionMenuItemList({ items, path }) {

    return (
        <div className="py-1 -mx-px">
            <List>
                {items.map((item, index) => (
                    <ActionMenuItem key={index} item={item} path={[...path, index]} />
                ))}
            </List>
        </div>
    );
});

const ActionMenuItemRoot = memo<{ onDismiss: () => void; children: any }>(function ActionMenuItemRoot({ onDismiss, children }) {
    const [path, setPath] = useState<number[]>([]);

    // useEffect(() => {
    //     console.log('==== path', path);
    // }, [path]);

    return (
        <Context.Provider value={{ path, setPath, onDismiss }}>
            {children}
        </Context.Provider>
    );
});


export default memo<Omit<IActionMenuItemListProps, 'path'> & { onDismiss: () => void }>(function ActionMenuItemList({ onDismiss, items }) {
    return (
        <ActionMenuItemRoot onDismiss={onDismiss}>
            <MenuItemList items={items} path={[]} />
        </ActionMenuItemRoot>
    );
});
