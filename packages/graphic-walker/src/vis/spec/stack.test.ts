import { IStackMode } from '../../interfaces';
import { channelStack } from './stack';

describe('channelStack', () => {
    test.each([
        ['stack', undefined],
        ['zero', undefined],
        ['none', null],
        ['normalize', 'normalize'],
        ['center', 'center'],
    ] as Array<[IStackMode, unknown]>)('maps %s to the Vega-Lite stack contract', (mode, expected) => {
        const encoding: Record<string, any> = {
            x: { field: 'value', type: 'quantitative' },
            y: { field: 'category', type: 'nominal' },
        };

        channelStack(encoding, mode);

        expect(encoding.x.stack).toBe(expected);
        expect('stack' in encoding.y).toBe(false);
    });
});
