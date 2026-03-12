import type { ChannelModel } from './channelModel';

export function resolveAutoMark(channels: ChannelModel): string {
    const xType = channels.x.type;
    const yType = channels.y.type;
    if (xType === 'quantitative' && yType === 'quantitative') {
        return 'point';
    }
    if ((xType === 'temporal' && yType === 'quantitative') || (yType === 'temporal' && xType === 'quantitative')) {
        return 'line';
    }
    return 'bar';
}

export function normalizeGeom(mark: unknown, channels: ChannelModel): string {
    const raw = typeof mark === 'string' ? mark : (mark as { type?: string })?.type;
    const markType = raw ?? 'bar';
    if (markType === 'auto') return resolveAutoMark(channels);
    if (markType === 'dot') return 'circle';
    if (markType === 'trail') return 'line';
    return markType;
}

export function isScatterLikeGeom(geom: string): boolean {
    return geom === 'point' || geom === 'circle';
}
