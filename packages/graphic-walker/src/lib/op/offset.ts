export function getOffsetDate(date: Date, offset: number) {
    return new Proxy(new Date(date.getTime() - offset * 60000), {
        get(target, p) {
            if (typeof p === 'string') {
                if (p.startsWith('get') && !p.startsWith('getTime') && !p.includes('UTC')) {
                    return target[p.replace('get', 'getUTC')];
                }
                if (p.startsWith('set') && !p.includes('UTC')) {
                    return target[p.replace('set', 'setUTC')];
                }
            }
            return target[p];
        },
    });
}
