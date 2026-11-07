import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScrollMapper } from '../src/runtime/scroll';
test('compressed scroll reaches endpoints and round-trips logical positions', () => {
    const mapper = new ScrollMapper(100_000_000, 900);
    assert.equal(mapper.compressed, true);
    for (const position of [0, 1, 413.5, 98_000_000, mapper.logicalMax]) {
        assert.ok(Math.abs(mapper.toLogical(mapper.toPhysical(position)) - position) < 1e-7);
    }
    assert.equal(mapper.toLogical(mapper.physicalMax), mapper.logicalMax);
});
test('ordinary scrolling is one-to-one and shrinking extents clamps safely', () => {
    const small = new ScrollMapper(5000, 900);
    assert.equal(small.toPhysical(123), 123);
    assert.equal(small.clamp(50_000), 4100);
    assert.equal(new ScrollMapper(300, 900).toLogical(30), 0);
    assert.throws(() => new ScrollMapper(Number.MAX_VALUE, 900), RangeError);
});
