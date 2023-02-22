const throttle = (
    fn: () => void,
    time: number,
    options?: Partial<{ leading: boolean; trailing: boolean }>
): (() => void) => {
    const { leading = true, trailing = false } = options ?? {};

    let dirty = false;
    let hasTrailing = false;

    const throttled = (): void => {
        if (dirty) {
            hasTrailing = true;
            return;
        }
        dirty = true;
        if (leading) {
            fn();
        }
        setTimeout(() => {
            if (hasTrailing && trailing) {
                fn();
            }
            dirty = false;
            hasTrailing = false;
        }, time);
    };

    return throttled;
};

export default throttle;
