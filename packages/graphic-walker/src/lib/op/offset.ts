export type OffsetDate = Date & { _offset: never };

export function getOffsetDate(date: Date, offset: number): OffsetDate {
    return new Proxy(new Date(date.getTime() - offset * 60000), {
        get(target, p) {
            if (typeof p === 'string') {
                if (p === 'getTime') {
                    return () => target.getTime() + offset * 60000;
                }
                if (p.startsWith('get') && !p.includes('UTC')) {
                    return target[p.replace('get', 'getUTC')].bind(target);
                }
                if (p.startsWith('set') && !p.includes('UTC')) {
                    return (...args) => target[p.replace('set', 'setUTC')].call(target, ...args) + offset * 60000;
                }
            }
            return target[p].bind(target);
        },
    }) as OffsetDate;
}

export function newOffsetDate(offset = new Date().getTimezoneOffset()) {
    function creator(): OffsetDate;
    function creator(value: number | string | Date): OffsetDate;
    function creator(year: number, monthIndex: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): OffsetDate;
    function creator(...args): OffsetDate {
        if (args.length > 1) {
            const timestamp =
                offset * 60000 +
                Date.UTC(...(args as [number, number, number | undefined, number | undefined, number | undefined, number | undefined, number | undefined]));
            return getOffsetDate(new Date(timestamp), offset);
        }
        if (args.length > 0) {
            if (args[0] instanceof Date) {
                return getOffsetDate(args[0], offset);
            }
            return getOffsetDate(new Date(args[0]), offset);
        }
        return getOffsetDate(new Date(), offset);
    }
    return creator;
}
