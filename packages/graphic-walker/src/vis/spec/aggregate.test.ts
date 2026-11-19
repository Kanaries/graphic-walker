import type { IViewField } from '../../interfaces';
import { channelAggregate } from './aggregate';

test('resolves window calculations by encoding channel when fields share a fid', () => {
    const sales: IViewField = { fid: 'sales', name: 'Sales', analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' };
    const encoding = { y: { field: 'sales' }, color: { field: 'sales' } };
    channelAggregate(encoding, {
        y: { ...sales, windowAgg: 'running_total' },
        color: { ...sales, windowAgg: 'moving_average' },
    });
    expect(encoding.y.field).toBe('sales_sum__window_running_total');
    expect(encoding.color.field).toBe('sales_sum__window_moving_average');
});
