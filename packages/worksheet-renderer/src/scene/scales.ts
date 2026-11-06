import type { DisplayDomain, ScaleOptions } from '../core/types';
import { toTypedValue, typedValueKey } from '../core/keys';

/** Resolve display overrides identically for complete and external windowed sources. */
export function resolveDomainValues(domain: DisplayDomain, options: ScaleOptions = {}): readonly unknown[] {
    const supplied = options.domain ?? domain.values;
    if (domain.type === 'band') {
        const seen = new Set<string>();
        for (const value of supplied) {
            let key: string;
            try {
                key = typedValueKey(toTypedValue(value));
            } catch {
                throw new Error('invalid-domain: band values must be prepared primitives');
            }
            if (seen.has(key)) throw new Error('invalid-domain: duplicate band value');
            seen.add(key);
        }
        return supplied;
    }
    if (supplied.length !== 2 || supplied.some((v) => typeof v !== 'number' || !Number.isFinite(v)))
        throw new Error('invalid-domain: finite endpoints required');
    let lo = options.domainMin ?? Number(supplied[0]),
        hi = options.domainMax ?? Number(supplied[1]);
    if (![lo, hi].every(Number.isFinite) || lo > hi) throw new Error('invalid-domain: endpoints must be finite and ordered');
    if (domain.type === 'time' && [lo, hi].some((value) => Math.abs(value) > 8_640_000_000_000_000))
        throw new Error('invalid-domain: time endpoints exceed Date range');
    const fixedLo = options.domain !== undefined || options.domainMin !== undefined;
    const fixedHi = options.domain !== undefined || options.domainMax !== undefined;
    if (options.zero && domain.type === 'linear') {
        if (!fixedLo) lo = Math.min(0, lo);
        if (!fixedHi) hi = Math.max(0, hi);
    }
    if (lo === hi) {
        if (fixedLo && fixedHi) throw new Error('invalid-domain: fixed endpoints must have positive span');
        const padding = Math.max(1, Math.abs(lo) * 0.01);
        const bound = domain.type === 'time' ? 8_640_000_000_000_000 : Number.MAX_VALUE;
        if (!fixedLo) lo = Math.max(-bound, lo - padding);
        if (!fixedHi) hi = Math.min(bound, hi + padding);
    }
    if (!Number.isFinite(hi - lo) || lo >= hi) throw new Error('invalid-domain: range cannot be represented safely');
    return [lo, hi];
}
