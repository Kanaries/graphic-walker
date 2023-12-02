import { ToolbarItemProps } from '../components/toolbar';
import { omitRedundantSeparator } from './utils';

describe('omitRedundantSeparator', () => {
    const testItem = { key: 'test' } as ToolbarItemProps;
    test('heading consecutive separator', () => {
        const items: ToolbarItemProps[] = ['-', '-', testItem];
        expect(omitRedundantSeparator(items)).toEqual([testItem]);
    });
    test('trailing consecutive separator', () => {
        const items: ToolbarItemProps[] = [testItem, '-', '-'];
        expect(omitRedundantSeparator(items)).toEqual([testItem]);
    });
    test('middle consecutive separators', () => {
        const items: ToolbarItemProps[] = [testItem, '-', '-', testItem, '-', testItem];
        expect(omitRedundantSeparator(items)).toEqual([testItem, '-', testItem, '-', testItem]);
    });
});
