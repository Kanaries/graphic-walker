import type { ChannelModel } from '../model/channelModel';

export function buildLayoutOptions(model: ChannelModel, hideLegend: boolean): Record<string, unknown> {
    return {
        marginTop: 20,
        // Let Plot manage legend footprint; fixed large reserve causes blank area.
        marginRight: 40,
        marginBottom: 48,
        // Reserve extra space for transposed categorical labels to avoid left clipping.
        marginLeft: 120,
    };
}
