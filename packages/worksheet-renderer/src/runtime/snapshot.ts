export type ReadonlySnapshot<T> = T extends (...args: any[]) => unknown
    ? T
    : T extends object
      ? { readonly [K in keyof T]: ReadonlySnapshot<T[K]> }
      : T;

/** Copy public snapshots so even nested record values cannot mutate the controller. */
export function immutableSnapshot<T>(value: T): ReadonlySnapshot<T> {
    const seen = new WeakMap<object, unknown>();
    const copy = (item: unknown): any => {
        if (!item || typeof item !== 'object') return item;
        if (seen.has(item)) return seen.get(item);
        if (item instanceof Date) return Object.freeze(new Date(item.getTime()));
        const result: Record<string, unknown> | unknown[] = Array.isArray(item) ? [] : {};
        seen.set(item, result);
        for (const key of Object.keys(item)) (result as Record<string, unknown>)[key] = copy((item as Record<string, unknown>)[key]);
        return Object.freeze(result);
    };
    return copy(value);
}
