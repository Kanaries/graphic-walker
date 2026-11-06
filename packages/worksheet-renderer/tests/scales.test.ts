import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDomainValues } from '../src/scene/scales';
import type { DisplayDomain } from '../src/core/types';
const domain: DisplayDomain = {
    fieldRef: 'value',
    domainId: 'value',
    type: 'linear',
    values: [10, 20],
    complete: true,
    empty: false,
    extentKind: 'value',
    source: 'prepared',
};
test('windowed original extents respect fixed endpoint overrides and zero precedence', () => {
    assert.deepEqual(resolveDomainValues(domain, { zero: true }), [0, 20]);
    assert.deepEqual(resolveDomainValues(domain, { domain: [5, 25], zero: true }), [5, 25]);
    assert.deepEqual(resolveDomainValues(domain, { domainMin: 8, domainMax: 30, zero: true }), [8, 30]);
    assert.deepEqual(resolveDomainValues(domain, { domainMax: 30, zero: true }), [0, 30]);
    assert.throws(() => resolveDomainValues(domain, { domainMin: 25 }), /invalid-domain/);
});
test('single-value expansion preserves explicit endpoints and bounded time values', () => {
    const single = { ...domain, values: [5, 5] };
    assert.deepEqual(resolveDomainValues(single), [4, 6]);
    assert.deepEqual(resolveDomainValues(single, { domainMin: 5 }), [5, 6]);
    assert.deepEqual(resolveDomainValues(single, { domainMax: 5 }), [4, 5]);
    assert.throws(() => resolveDomainValues(single, { domain: [5, 5] }), /invalid-domain/);
    const dateLimit = 8_640_000_000_000_000;
    const result = resolveDomainValues({ ...single, type: 'time', values: [dateLimit, dateLimit] });
    assert.equal(result[1], dateLimit);
    assert.ok(Number(result[0]) < dateLimit);
    assert.throws(() => resolveDomainValues({ ...domain, type: 'time' }, { domain: [0, dateLimit + 1] }), /invalid-domain/);
});
test('fixed band domains preserve typed identities and reject duplicate or invalid members', () => {
    const band: DisplayDomain = { ...domain, type: 'band', values: ['old'] };
    const values = [null, 'null', 1, '1', true];
    assert.deepEqual(resolveDomainValues(band, { domain: values }), values);
    for (const invalid of [['a', 'a'], [0, -0], [{}], [undefined], [NaN]]) {
        assert.throws(() => resolveDomainValues(band, { domain: invalid }), /invalid-domain/);
    }
});
