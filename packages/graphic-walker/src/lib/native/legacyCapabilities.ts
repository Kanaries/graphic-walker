import type { IChart, ICoordMode, IRendererType, IViewField, IWorksheetLayout } from '../../interfaces';

export type LegacyRenderer = Exclude<IRendererType, 'native'>;
export interface LegacyCapabilityInput {
    readonly rows: readonly IViewField[];
    readonly columns: readonly IViewField[];
    readonly geomType?: string;
    readonly coordSystem?: ICoordMode;
    readonly worksheet?: IWorksheetLayout;
}
export interface LegacyRendererDiagnostic {
    readonly code: 'unsupported-renderer';
    readonly severity: 'error';
    readonly recoverable: true;
    readonly renderer: LegacyRenderer;
    readonly configRef: string;
    readonly message: string;
}

/** Check rendering capacity without editing canonical fields or choosing a renderer. */
export function getLegacyRendererDiagnostics(input: IChart | LegacyCapabilityInput, renderer: LegacyRenderer = 'vega-lite'): readonly LegacyRendererDiagnostic[] {
    const view: LegacyCapabilityInput = 'encodings' in input
        ? { rows: input.encodings.rows, columns: input.encodings.columns, geomType: input.config.geoms[0], coordSystem: input.config.coordSystem, worksheet: input.layout.worksheet }
        : input;
    // These routes are PivotTable and Leaflet, not the ordinary chart compilers.
    if (view.geomType === 'table' || view.coordSystem === 'geographic' || view.geomType === 'poi' || view.geomType === 'choropleth') return [];
    const diagnostics: LegacyRendererDiagnostic[] = [];
    const reject = (configRef: string, message: string) => diagnostics.push({ code: 'unsupported-renderer', severity: 'error', recoverable: true, renderer, configRef, message });
    for (const axis of ['rows', 'columns'] as const) {
        const fields = view[axis], dimensions = fields.filter(field => field.analyticType === 'dimension').length;
        const facetCount = Math.max(0, dimensions - (fields.some(field => field.analyticType === 'measure') ? 0 : 1));
        if (facetCount > 1) reject(`encodings.${axis}`, `${renderer} supports one enclosing facet per axis; ${axis} contains ${facetCount}. Use Native Worksheet to preserve every level.`);
    }
    for (const axis of ['x', 'y'] as const) if (view.worksheet?.scaleScopes?.[axis] !== undefined)
        reject(`layout.worksheet.scaleScopes.${axis}`, `${renderer} does not apply worksheet domain scopes. Use Native Worksheet for this display setting.`);
    if (view.worksheet?.barLayout !== undefined)
        reject('layout.worksheet.barLayout', `${renderer} does not apply worksheet grouped-bar layout. Use Native Worksheet for this display setting.`);
    return diagnostics;
}

export class LegacyRendererCapabilityError extends Error {
    readonly code = 'unsupported-renderer';
    constructor(readonly diagnostics: readonly LegacyRendererDiagnostic[]) {
        super(diagnostics.map(diagnostic => `${diagnostic.configRef}: ${diagnostic.message}`).join('\n'));
        this.name = 'LegacyRendererCapabilityError';
    }
}
export function assertLegacyRendererCapabilities(input: IChart | LegacyCapabilityInput, renderer: LegacyRenderer = 'vega-lite'): void {
    const diagnostics = getLegacyRendererDiagnostics(input, renderer);
    if (diagnostics.length) throw new LegacyRendererCapabilityError(diagnostics);
}
