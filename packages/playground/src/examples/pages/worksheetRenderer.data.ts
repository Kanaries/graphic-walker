import { concat, field, nest, type FieldInstance, type Row, type WorksheetSpec } from '@kanaries/worksheet-renderer';

export const instances: Record<string, FieldInstance> = Object.fromEntries([
    ...['Country', 'Region', 'Category', 'Subcategory', 'Year', 'Month', 'Segment'].map(name => ({ id: name, field: name, label: name, display: 'discrete' as const })),
    { id: 'sales', field: 'Sales', label: 'SUM(Sales)', display: 'continuous' as const, aggregate: 'sum' as const },
    { id: 'profit', field: 'Profit', label: 'AVG(Profit)', display: 'continuous' as const, aggregate: 'mean' as const },
    { id: 'orders', field: 'OrderId', label: 'COUNTD(Order)', display: 'continuous' as const, aggregate: 'distinctCount' as const },
].map(f => [f.id, f]));

export const dimensions = Object.values(instances).filter(f => f.display === 'discrete').map(f => f.id);
export const measures = ['sales', 'profit', 'orders'];
export const regions = ['Central', 'East', 'South', 'West'];
export interface Shelves { rows: string[]; columns: string[]; rowMeasures: string[]; columnMeasures: string[]; mark: WorksheetSpec['mark']; color?: string; text?: string }
export const presets: Record<string, Shelves & { label: string }> = {
    nested: { label: 'Nested bars', rows: ['Region', 'Category', 'Subcategory'], columns: ['Year'], rowMeasures: [], columnMeasures: ['sales', 'profit'], mark: 'bar', color: 'Segment' },
    line: { label: 'Monthly lines', rows: ['Region'], columns: ['Year', 'Month'], rowMeasures: ['sales'], columnMeasures: [], mark: 'line', color: 'Segment' },
    scatter: { label: 'Faceted scatter', rows: ['Region', 'Category'], columns: ['Year'], rowMeasures: ['profit'], columnMeasures: ['sales'], mark: 'point', color: 'Segment' },
    deep: { label: 'Five-level hierarchy', rows: ['Country', 'Region', 'Category', 'Subcategory', 'Segment'], columns: ['Year'], rowMeasures: [], columnMeasures: ['sales', 'profit', 'orders'], mark: 'bar', color: 'Segment' },
    // The three Tableau reference views the layout is checked against.
    ref1: { label: 'Ref 1 · Year / Category / Sub-Category', rows: [], columns: ['Year', 'Category', 'Subcategory'], rowMeasures: ['sales'], columnMeasures: [], mark: 'bar' },
    ref2: { label: 'Ref 2 · Category / Sub-Category × Region', rows: ['Category', 'Subcategory'], columns: ['Region'], rowMeasures: [], columnMeasures: ['sales'], mark: 'bar', color: 'profit' },
    ref3: { label: 'Ref 3 · Category / Segment × Year', rows: ['Category', 'Segment'], columns: ['Year'], rowMeasures: [], columnMeasures: ['sales'], mark: 'bar', color: 'Segment' },
    heat: { label: 'Heat map', rows: ['Category', 'Subcategory'], columns: ['Year', 'Month'], rowMeasures: [], columnMeasures: [], mark: 'rect', color: 'profit' },
    crosstab: { label: 'Crosstab', rows: ['Category', 'Subcategory'], columns: ['Region'], rowMeasures: [], columnMeasures: [], mark: 'text', text: 'sales' },
};
export function axis(dims: string[], metrics: string[]) {
    const items = dims.map(field);
    if (metrics.length) items.push(metrics.length === 1 ? field(metrics[0]) : concat(...metrics.map(field)));
    return items.length ? nest(...items) : { kind: 'empty' as const };
}

// Deterministic order-level fixture. Groups have 4, 9 and 4 members, so a layout that
// divides a fixed pane by its member count shows up as uneven bars. It also has negative
// profit, repeated order IDs, one member missing from one region and one empty combination.
export const orders: Row[] = [];
const products = {
    Furniture: ['Bookcases', 'Chairs', 'Furnishings', 'Tables'],
    'Office Supplies': ['Appliances', 'Art', 'Binders', 'Envelopes', 'Fasteners', 'Labels', 'Paper', 'Storage', 'Supplies'],
    Technology: ['Accessories', 'Copiers', 'Machines', 'Phones'],
};
let seed = 12345;
function random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
for (const Country of ['Canada', 'US']) for (const Region of regions)
    for (const [Category, subs] of Object.entries(products)) for (const Subcategory of subs)
        for (const Year of [2024, 2025]) for (let Month = 1; Month <= 12; Month++) for (const Segment of ['Consumer', 'Corporate']) {
            if (Country === 'Canada' && Region === 'West' && Category === 'Technology' && Year === 2024) continue;
            if (Subcategory === 'Fasteners' && Region === 'South') continue;
            const count = 1 + Math.floor(random() * 3);
            for (let i = 0; i < count; i++) {
                const Sales = Math.round((30 + random() * 400) * (Category === 'Technology' ? 2.2 : 1) * (Year === 2025 ? 1.3 : 1) * (1 + Month / 24) * (Subcategory === 'Fasteners' ? .15 : 1));
                const Profit = Math.round(Sales * (random() * .45 - .12));
                orders.push({ Country, Region, Category, Subcategory, Year, Month, Segment, Sales, Profit, OrderId: `order-${Math.floor(orders.length / 2)}` });
            }
        }
