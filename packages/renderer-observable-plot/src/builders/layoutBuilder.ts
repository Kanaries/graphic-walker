import type { ChannelModel } from '../model/channelModel';

export function buildLayoutOptions(model: ChannelModel, hideLegend: boolean): Record<string, unknown> {
    const hasColumnFacet = Boolean(model.column.key);
    const hasRowFacet = Boolean(model.row.key);
    return {
        marginTop: hasColumnFacet ? 30 : 20,
        // Let Plot manage legend footprint; fixed large reserve causes blank area.
        marginRight: hasRowFacet ? 110 : 40,
        marginBottom: 48,
        // Reserve extra space for transposed categorical labels to avoid left clipping.
        marginLeft: 120,
    };
}
