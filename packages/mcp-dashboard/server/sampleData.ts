import type { IMutField } from '@kanaries/graphic-walker';

export type SampleDatasetResponse = {
    name: string;
    description: string;
    data: Record<string, string | number>[];
    fields: IMutField[];
};

const data: SampleDatasetResponse['data'] = [
    { region: 'North America', segment: 'Enterprise', product: 'Analytics Pro', sales: 128_400, profit: 0.23, orders: 312, satisfaction: 4.4 },
    { region: 'Europe', segment: 'Enterprise', product: 'Analytics Pro', sales: 98_120, profit: 0.19, orders: 276, satisfaction: 4.2 },
    { region: 'Asia Pacific', segment: 'Enterprise', product: 'Analytics Pro', sales: 142_980, profit: 0.27, orders: 358, satisfaction: 4.6 },
    { region: 'North America', segment: 'Commercial', product: 'Insight Starter', sales: 64_210, profit: 0.11, orders: 198, satisfaction: 4.0 },
    { region: 'Europe', segment: 'Commercial', product: 'Insight Starter', sales: 58_420, profit: 0.09, orders: 184, satisfaction: 3.9 },
    { region: 'Asia Pacific', segment: 'Commercial', product: 'Insight Starter', sales: 71_330, profit: 0.13, orders: 215, satisfaction: 4.1 },
    { region: 'North America', segment: 'SMB', product: 'Signal Lite', sales: 31_560, profit: 0.08, orders: 142, satisfaction: 3.8 },
    { region: 'Europe', segment: 'SMB', product: 'Signal Lite', sales: 28_910, profit: 0.07, orders: 137, satisfaction: 3.7 },
    { region: 'Asia Pacific', segment: 'SMB', product: 'Signal Lite', sales: 36_480, profit: 0.1, orders: 166, satisfaction: 3.9 },
];

const fields: IMutField[] = [
    { fid: 'region', name: 'Region', analyticType: 'dimension', semanticType: 'nominal' },
    { fid: 'segment', name: 'Segment', analyticType: 'dimension', semanticType: 'nominal' },
    { fid: 'product', name: 'Product', analyticType: 'dimension', semanticType: 'nominal' },
    { fid: 'sales', name: 'Sales', analyticType: 'measure', semanticType: 'quantitative' },
    { fid: 'profit', name: 'Profit Ratio', analyticType: 'measure', semanticType: 'quantitative' },
    { fid: 'orders', name: 'Orders', analyticType: 'measure', semanticType: 'quantitative' },
    { fid: 'satisfaction', name: 'CSAT', analyticType: 'measure', semanticType: 'quantitative' },
];

export const SAMPLE_DATASET: SampleDatasetResponse = {
    name: 'SignalOps Revenue Quality Sample',
    description: 'Fabricated SaaS KPI slice for demonstrating cross-filtering in GraphicWalker.',
    data,
    fields,
};