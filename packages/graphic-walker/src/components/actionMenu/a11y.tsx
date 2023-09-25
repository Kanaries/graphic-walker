import { type HTMLAttributes, type MouseEvent, useCallback, useMemo, type KeyboardEvent, type AriaAttributes, type ComponentPropsWithoutRef } from "react";


export type ReactTag = keyof JSX.IntrinsicElements;
export type ElementType<T extends ReactTag> = Parameters<NonNullable<ComponentPropsWithoutRef<T>['onClick']>>[0] extends MouseEvent<infer U, globalThis.MouseEvent> ? U : never;

interface IUseMenuButtonOptions {
    "aria-expanded": NonNullable<AriaAttributes['aria-expanded']>;
    onPress?: () => void;
    disabled?: boolean;
}

export const useMenuButton = <T extends ReactTag>(options: IUseMenuButtonOptions & Omit<ComponentPropsWithoutRef<T>, keyof IUseMenuButtonOptions>): HTMLAttributes<ElementType<T>> => {
    const { ["aria-expanded"]: expanded, onPress, disabled, className = '', ...attrs } = options;

    const onClick = useCallback((e: MouseEvent<any>) => {
        e.preventDefault();
        e.stopPropagation();
        onPress?.();
    }, [onPress]);

    const onKeyDown = useCallback((e: KeyboardEvent<any>) => {
        switch (e.key) {
            case 'Enter':
            case 'Space': {
                onPress?.();
                break;
            }
            default: {
                return;
            }
        }
        e.preventDefault();
        e.stopPropagation();
    }, [onPress]);

    return useMemo(() => ({
        ...attrs,
        className: `${className} text-gray-500 dark:text-gray-400 ${disabled ? 'cursor-default text-opacity-50' : 'cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 hover:bg-indigo-100/20 dark:hover:bg-indigo-800/20 hover:text-indigo-700 dark:hover:text-indigo-200'}`,
        role: 'button',
        "aria-haspopup": 'menu',
        "aria-expanded": expanded,
        "aria-disabled": disabled,
        tabIndex: disabled ? undefined : 0,
        onClick,
        onKeyDown,
    }) as HTMLAttributes<ElementType<T>>, [onClick, onKeyDown, expanded, disabled, className, attrs]);
};
