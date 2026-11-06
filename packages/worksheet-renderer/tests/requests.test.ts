import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestRegistry } from '../src/runtime/requests';
import type { HeaderRequestTarget, RequestStatus } from '../src/runtime/types';
const target: HeaderRequestTarget = {
    axis: 'row',
    key: 'east',
    fieldRef: 'region',
    path: [{ fieldRef: 'region', value: { type: 'string', value: 'East' } }],
};

test('controlled intent is pending until an explicit matching acknowledgement and newer intent supersedes it', () => {
    const events: Array<{ id: string; status: RequestStatus }> = [];
    const requests = createRequestRegistry(1000, (request, status) => events.push({ id: request.requestId, status }));
    try {
        const first = requests.create('p1', target, 'collapse', { expanded: false });
        assert.equal(requests.snapshot().length, 1);
        const second = requests.create('p1', target, 'collapse', { expanded: true });
        assert.deepEqual(
            events.map((event) => event.status),
            ['pending', 'superseded', 'pending'],
        );
        assert.throws(() => requests.validate([{ requestId: first.requestId, status: 'accepted' }], 'p1'), /version-expired/);
        assert.throws(() => requests.validate([{ requestId: second.requestId, status: 'accepted' }], 'p2'), /version-expired/);
        requests.validate([{ requestId: second.requestId, status: 'accepted' }], 'p1');
        requests.commit([{ requestId: second.requestId, status: 'accepted' }], 'p1', 'p2');
        assert.equal(events.at(-1)?.status, 'accepted');
        assert.equal(requests.snapshot().length, 0);
    } finally {
        requests.dispose();
    }
});

test('expired requests reject late acknowledgements and disposal cancels pending timers', async () => {
    const events: RequestStatus[] = [];
    const requests = createRequestRegistry(10, (_request, status) => events.push(status));
    const request = requests.create('p1', target, 'sort', { direction: 'ascending' });
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.deepEqual(events, ['pending', 'expired']);
    assert.throws(() => requests.validate([{ requestId: request.requestId, status: 'accepted' }], 'p1'), /version-expired/);
    requests.create('p1', target, 'sort', { direction: 'descending' });
    requests.dispose();
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.deepEqual(events, ['pending', 'expired', 'pending']);
});

test('request consumers cannot mutate retained intent and source changes supersede pending requests', () => {
    const requests = createRequestRegistry(1000, (request) => {
        request.target.path[0].value = { type: 'string', value: 'tampered' };
    });
    try {
        const request = requests.create('p1', target, 'collapse', { expanded: false });
        assert.deepEqual(requests.snapshot()[0].target.path, target.path);
        request.target.path[0].value = { type: 'null' };
        assert.deepEqual(requests.snapshot()[0].target.path, target.path);
        requests.supersedeAll('Different source');
        assert.deepEqual(requests.snapshot(), []);
    } finally {
        requests.dispose();
    }
});
