/**
 * Spec compatibility contract tests.
 *
 * Every fixture pair under tests/fixtures/spec-compat/ is a persistence-compatibility
 * contract: the *.input.json files replay spec shapes as persisted by current and past
 * releases, and the *.expected.json files are explicitly committed, hand-verified
 * canonical outputs. If a change to the spec pipeline breaks any of these assertions,
 * it breaks previously persisted user charts — fix the change, not the fixture,
 * unless a migration path is added deliberately.
 */
jest.mock('nanoid', () => ({ nanoid: () => 'mock-id' }));

import fs from 'fs';
import path from 'path';
import { normalize } from '../src/models/normalize';
import { chartToWorkflow } from '../src/utils/workflow';
import { resolveChart } from '../src/models/visSpecHistory';
import { DataStore } from '../src/store/dataStore';

const DIR = path.join(__dirname, 'fixtures', 'spec-compat');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));

const CHART_FIXTURES = ['visspec-old-full', 'visspec-old-sparse', 'chart-current-complex', 'chart-geographic', 'partial-minimal', 'special-chars'];

describe.each(CHART_FIXTURES)('chart fixture: %s', (name) => {
    const input = read(`${name}.input.json`);
    const expected = read(`${name}.expected.json`);

    test('normalize matches the committed expected output', () => {
        expect(normalize(input)).toEqual(expected);
    });

    test('normalize is idempotent on the expected output', () => {
        expect(normalize(expected)).toEqual(expected);
    });

    test('normalized output feeds toWorkflow without throwing', () => {
        const payload = chartToWorkflow(normalize(input));
        expect(Array.isArray(payload.workflow)).toBe(true);
    });
});

describe('app-level store import compatibility', () => {
    test('legacy IStoInfoOld import produces the committed store state', () => {
        const store = new DataStore();
        store.importData(read('stoinfo-old.input.json'));
        const expected = read('stoinfo-old.expected.json');
        expect(store.metaDict).toEqual(expected.metaDict);
        expect(store.dataSources).toEqual(expected.dataSources);
        expect(store.visDict).toEqual(expected.visDict);
        expect(store.exportData()).toEqual(expected.exportData);
    });

    test('every chart stored by the legacy import resolves and feeds toWorkflow', () => {
        const expected = read('stoinfo-old.expected.json');
        for (const specs of Object.values(expected.visDict) as string[][]) {
            for (const raw of specs) {
                const chart = resolveChart(raw);
                const payload = chartToWorkflow(chart);
                expect(Array.isArray(payload.workflow)).toBe(true);
            }
        }
    });

    test('IStoInfoV2 import/export round trip is identity', () => {
        const input = read('stoinfo-v2.input.json');
        const store = new DataStore();
        store.importData(input);
        expect(store.exportData()).toEqual(input);
    });
});
