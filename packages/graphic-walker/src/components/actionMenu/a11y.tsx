import { HTMLAttributes, type ComponentProps, type MouseEvent, useCallback, useMemo, type KeyboardEvent, type AriaAttributes } from "react";


export type ReactTag = keyof JSX.IntrinsicElements;
export type ElementType<T extends ReactTag> = Parameters<NonNullable<ComponentProps<T>['onClick']>>[0] extends MouseEvent<infer U, globalThis.MouseEvent> ? U : never;

interface IUseButtonOptions<T extends ReactTag> {
    as: T;
    "aria-expanded": NonNullable<AriaAttributes['aria-expanded']>;
    onPress?: () => void;
    disabled?: boolean;
}

export const useButton = <T extends ReactTag>(options: IUseButtonOptions<T> & Omit<ComponentProps<T>, keyof IUseButtonOptions<T>>): HTMLAttributes<ElementType<T>> => {
    const { ["aria-expanded"]: expanded, onPress, disabled, ...attrs } = options;

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
        role: 'button',
        "aria-haspopup": 'menu',
        "aria-expanded": expanded,
        "aria-disabled": disabled,
        tabIndex: disabled ? undefined : 0,
        onClick,
        onKeyDown,
    }) as HTMLAttributes<ElementType<T>>, [onClick, onKeyDown, expanded, disabled, attrs]);
};
