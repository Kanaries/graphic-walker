import React, {
    Fragment,
    type HTMLAttributes,
    memo,
    type ReactElement,
    createContext,
    useState,
    useContext,
    useRef,
    useCallback,
    type ComponentPropsWithoutRef,
} from 'react';
import { Menu, Transition } from '@headlessui/react';
import { type ReactTag, type ElementType, useMenuButton } from './a11y';
import ActionMenuItemList, { type IActionMenuItem } from './list';
import { blockContext } from '../../fields/fieldsContext';

interface IActionMenuContext {
    disabled: boolean;
    expanded: boolean;
    moveTo(x: number, y: number): void;
    open(): void;
    close(): void;
    _items: readonly IActionMenuItem[];
}

const Context = createContext<IActionMenuContext | null>(null);

interface IActionMenuProps {
    menu?: IActionMenuItem[];
    disabled?: boolean;
    /** @default false */
    enableContextMenu?: boolean;
    title?: string;
}

const ActionMenu: React.FC<IActionMenuProps & Omit<HTMLAttributes<HTMLDivElement>, keyof IActionMenuProps>> = (props) => {
    const { menu = [], disabled = false, enableContextMenu = false, title, ...attrs } = props;

    const [coord, setCoord] = useState<[x: number, y: number]>([0, 0]);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const isDisabled = disabled || menu.length === 0;

    const block = useContext(blockContext);

    return (
        <Menu as={Fragment}>
            {({ open, close }) => {
                return (
                    <Context.Provider
                        value={{
                            disabled,
                            expanded: open,
                            moveTo(cx, cy) {
                                const blockRect = block.current?.getBoundingClientRect();
                                const { x, y } = blockRect ?? { x: 0, y: 0 };
                                setCoord([cx - x, cy - y]);
                            },
                            open() {
                                if (!open) {
                                    buttonRef.current?.click();
                                }
                            },
                            close,
                            _items: menu,
                        }}
                    >
                        <Menu.Button ref={buttonRef} className="sr-only" aria-hidden />
                        <div
                            onContextMenu={(e) => {
                                if (isDisabled) return;
                                e.preventDefault();
                                e.stopPropagation();
                                const blockRect = block.current?.getBoundingClientRect();
                                const { x, y } = blockRect ?? { x: 0, y: 0 };
                                setCoord([e.clientX - x, e.clientY - y]);
                                if (!open) {
                                    buttonRef.current?.click();
                                }
                            }}
                            {...attrs}
                        >
                            {props.children}
                        </div>
                        {open && <div className="fixed inset-0 z-50 bg-transparent" aria-hidden="true" />}
                        {!isDisabled && <Transition
                            as={Fragment}
                            enter="transition ease-out duration-100"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                        >
                            <Menu.Items
                                className="fixed rounded-md z-50 mt-0.5 min-w-[8rem] max-w-[16rem] origin-top-left bg-popover text-popover-foreground shadow-lg border focus:outline-none"
                                style={{
                                    left: coord[0],
                                    top: coord[1],
                                }}
                            >
                                <ActionMenuItemList title={title} items={menu} onDismiss={close} />
                            </Menu.Items>
                        </Transition>}
                    </Context.Provider>
                );
            }}
        </Menu>
    );
};

type IActionMenuButtonProps<T extends ReactTag> = (
    | {
          /** @default "button" */
          as: T;
      }
    | {
          /** @default "button" */
          as?: ReactTag;
      }
) & {
    onPress?: (ctx: IActionMenuContext | undefined) => void;
    /** @deprecated use `onPress()` instead */
    onClick?: () => void;
};

const ActionMenuButton = function ActionMenuButton<T extends ReactTag>(
    props: IActionMenuButtonProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof IActionMenuProps>
): ReactElement {
    const { as: _as = 'button', onPress, children, ...attrs } = props;
    const Component = _as as T;

    const ctx = useContext(Context);
    const buttonRef = useRef<ElementType<T>>(null);

    const handlePress = useCallback(() => {
        if (ctx?.disabled) {
            return;
        }
        const btn = buttonRef.current;
        if (btn) {
            const rect = (btn as unknown as HTMLElement | SVGElement).getBoundingClientRect();
            ctx?.moveTo(rect.x + rect.width, rect.y);
        }
        if (onPress) {
            return onPress(ctx ?? undefined);
        }
        if (ctx?.expanded) {
            ctx.close();
        } else {
            ctx?.open();
        }
    }, [ctx, onPress]);

    const buttonProps = useMenuButton({
        ...attrs,
        'aria-expanded': ctx?.expanded ?? false,
        onPress: handlePress,
    });

    if (ctx?.disabled || !ctx?._items.length) {
        return <div aria-hidden />;
    }

    return (
        // @ts-expect-error Expression produces a union type that is too complex to represent
        <Component {...buttonProps} ref={buttonRef}>
            {children}
        </Component>
    );
};

export default Object.assign(ActionMenu, {
    Button: memo(ActionMenuButton),
});
