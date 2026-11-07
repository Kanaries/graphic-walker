import type { IChart, IViewField } from '../../interfaces';
import { getMeaAggKey } from '../../utils';
import type { PreparedColumn } from './adapter';

/** Existing IChart input, with deterministic results prepared by the fixture's host. */
export function createNestedChartFixture() {
    const dimension = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'dimension', semanticType: 'nominal' });
    const measure = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' });
    const region = dimension('Region');
    const category = dimension('Category');
    const subcategory = dimension('Subcategory');
    const year = dimension('Year');
    const sales = measure('Sales');
    const profit = measure('Profit');
    const chart: IChart = {
        visId: 'native-u1', name: 'Regional sales and profit',
        encodings: {
            dimensions: [region, category, subcategory, year], measures: [sales, profit],
            rows: [region, category, subcategory], columns: [year, sales, profit],
            color: [], opacity: [], size: [], shape: [], theta: [], radius: [], longitude: [], latitude: [], geoId: [], details: [], filters: [], text: [],
        },
        config: { defaultAggregated: true, geoms: ['bar'], coordSystem: 'generic', limit: -1 },
        layout: {
            showTableSummary: false, format: {}, resolve: {}, size: { mode: 'fixed', width: 1200, height: 720 },
            interactiveScale: false, stack: 'none', showActions: false, zeroScale: true,
        },
    };
    const records: Record<string, unknown>[] = [];
    for (const [r, regionName] of ['East', 'West'].entries()) {
        for (const [c, categoryName] of ['Furniture', 'Office', 'Technology'].entries()) {
            for (const [s, subcategoryName] of ['Standard', 'Premium'].entries()) {
                for (const [y, yearName] of ['2025', '2026'].entries()) {
                    records.push({
                        __datumKey: JSON.stringify([regionName, categoryName, subcategoryName, yearName]),
                        Region: regionName, Category: categoryName, Subcategory: subcategoryName, Year: yearName,
                        [getMeaAggKey('Sales', 'sum')]: 100 + r * 40 + c * 20 + s * 10 + y * 5,
                        [getMeaAggKey('Profit', 'sum')]: (c === 1 ? -1 : 1) * (20 + r * 7 + s * 3 + y),
                    });
                }
            }
        }
    }
    const columns: PreparedColumn[] = [
        ...[region, category, subcategory, year].map((field): PreparedColumn => ({ columnKey: field.fid, valueType: 'string' })),
        { columnKey: getMeaAggKey('Sales', 'sum'), valueType: 'number', unitKey: 'USD' },
        { columnKey: getMeaAggKey('Profit', 'sum'), valueType: 'number', unitKey: 'USD' },
    ];
    return { chart, records, columns, getDatumKey: (record: Readonly<Record<string, unknown>>) => String(record.__datumKey) };
}
