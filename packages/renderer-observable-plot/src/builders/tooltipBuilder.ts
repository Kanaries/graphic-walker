import type { ChannelModel } from '../model/channelModel';

type TooltipItem = { key: string; title: string };

function collectTooltipFields(model: ChannelModel): TooltipItem[] {
    const seen = new Set<string>();
    const result: TooltipItem[] = [];
    const candidates = [model.x, model.y, model.color, model.opacity, model.size, model.shape, ...model.details];
    for (const item of candidates) {
        if (!item.key || !item.title) continue;
        if (seen.has(item.key)) continue;
        seen.add(item.key);
        result.push({ key: item.key, title: item.title });
    }
    return result;
}

export function buildTooltipTitle(model: ChannelModel): ((d: Record<string, unknown>) => string) | undefined {
    const fields = collectTooltipFields(model);
    if (fields.length === 0) return undefined;
    return (d: Record<string, unknown>) => fields.map((f) => `${f.title}: ${d[f.key] ?? ''}`).join(', ');
}
