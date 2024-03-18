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

export const unexceptedUTCParsedPattern = [
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, // YYYY-MM-DD
    /^\d{4}-(0[1-9]|1[0-2])$/, // YYYY-MM
    /^\d{4}$/, // YYYY
];

export const unexceptedUTCParsedPatternFormats = ['%Y', '%Y-%m', '%Y-%m-%d'];

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
            const v = args[0];
            if (v instanceof Date) {
                return getOffsetDate(v, offset);
            }
            if (typeof v === 'string') {
                if (unexceptedUTCParsedPattern.find((regex) => regex.test(v))) {
                    const utcDate = new Date(v).getTime();
                    return getOffsetDate(new Date(utcDate + offset * 60000), offset);
                }
                if (/(Z|[\+\-][0-2][0-9])$/.test(v)) {
                    // the timezone information is included in string
                    return getOffsetDate(new Date(v), offset);
                }
                const currentDate = new Date(v);
                const utcDate = currentDate.getTime() - currentDate.getTimezoneOffset() * 60000;
                return getOffsetDate(new Date(utcDate + offset * 60000), offset);
            }
            return getOffsetDate(new Date(v), offset);
        }
        return getOffsetDate(new Date(), offset);
    }
    return creator;
}

export function parsedOffsetDate(displayOffset: number | null | undefined, parseOffset: number | null | undefined) {
    const toOffset = newOffsetDate(displayOffset ?? new Date().getTimezoneOffset());
    const parse = newOffsetDate(parseOffset ?? new Date().getTimezoneOffset());
    function creator(): OffsetDate;
    function creator(value: number | string | Date): OffsetDate;
    function creator(year: number, monthIndex: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): OffsetDate;
    function creator(...args: []): OffsetDate {
        return toOffset(parse(...args));
    }
    return creator;
}
