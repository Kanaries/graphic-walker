export type ParaOrNoting<T> = T extends (...args: any) => any ? Parameters<T> : [];
export type ReturnOrID<T> = T extends (...args: any) => any ? ReturnType<T> : T;

export function proxied<T extends Object>(x: T, ex: { [k in keyof T]?: (req: ParaOrNoting<T[k]>, next: T[k]) => ReturnOrID<T[k]> }) {
    return new Proxy(x, {
        get(target, p) {
            if (ex[p]) {
                if (typeof target[p] === 'function') {
                    return (...args) => ex[p](args, (...x) => target[p].call(target, ...x));
                } else {
                    return ex[p]([], target[p]);
                }
            }
            return target[p];
        },
    });
}
