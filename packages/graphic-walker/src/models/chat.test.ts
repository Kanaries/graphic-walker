jest.mock('nanoid', () => ({ nanoid: () => 'mock-id' }));

import { toVegaSimplifiedWithAggergation } from './chat';
import type { DraggableFieldState, IChart, IViewField, IVisualLayout } from '@/interfaces';

const createTestChart = (defaultAggregated = true): IChart => {
	const dimensionField: IViewField = {
		fid: 'gender',
		name: 'gender',
		basename: 'gender',
		semanticType: 'nominal',
		analyticType: 'dimension',
	};

	const measureField: IViewField = {
		fid: 'reading score',
		name: 'reading score',
		basename: 'reading score',
		semanticType: 'quantitative',
		analyticType: 'measure',
		aggName: 'mean',
	};

	const encodings: DraggableFieldState = {
		dimensions: [dimensionField],
		measures: [
			{
				...measureField,
				aggName: 'sum',
			},
		],
		rows: [measureField],
		columns: [dimensionField],
		color: [],
		opacity: [],
		size: [],
		shape: [],
		theta: [],
		radius: [],
		longitude: [],
		latitude: [],
		geoId: [],
		details: [],
		filters: [],
		text: [],
	};

	const layout: IVisualLayout = {
		showTableSummary: false,
		format: {},
		resolve: {},
		size: {
			mode: 'auto',
			width: 320,
			height: 200,
		},
		interactiveScale: false,
		stack: 'stack',
		showActions: false,
		zeroScale: true,
		renderer: 'vega-lite',
	};

	return {
		visId: 'gw__test',
		name: 'Chart 1',
		config: {
			defaultAggregated,
			geoms: ['auto'],
			coordSystem: 'generic',
			limit: -1,
		},
		encodings,
		layout,
	};
};

describe('toVegaSimplifiedWithAggergation', () => {
	it('restores base field names and adds aggregate metadata when defaultAggregated is true', () => {
		const spec = toVegaSimplifiedWithAggergation(createTestChart(true));

		expect(spec.encoding?.y).toEqual(
			expect.objectContaining({
				field: 'reading score',
				aggregate: 'mean',
				title: 'mean(reading score)',
			})
		);

		expect(spec.encoding?.x).toEqual(
			expect.objectContaining({
				field: 'gender',
				type: 'nominal',
			})
		);
	});

	it('omits aggregate metadata when defaultAggregated is false', () => {
		const spec = toVegaSimplifiedWithAggergation(createTestChart(false));

		expect(spec.encoding?.y?.aggregate).toBeUndefined();
		expect(spec.encoding?.y).toEqual(
			expect.objectContaining({
				field: 'reading score',
				type: 'quantitative',
			})
		);
	});
});
