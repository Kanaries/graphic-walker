import {
    AgentEncodingChannel,
    IGWAgentTargetSummary,
    IAgentTargetDescriptor,
    IMutField,
    DraggableFieldState,
    IViewField,
    IFilterField,
} from '../interfaces';

const TARGET_PREFIX = 'gw-target';

const encodePart = (value?: string | number | null) => encodeURIComponent(value ?? '');

export const composeAgentTargetId = (descriptor: IAgentTargetDescriptor) => {
    const parts = [
        TARGET_PREFIX,
        descriptor.instanceId,
        descriptor.kind,
        descriptor.visId ?? '',
        descriptor.channel ?? '',
        descriptor.index ?? '',
        descriptor.fid ?? '',
        descriptor.role ?? '',
        descriptor.actionKey ?? '',
    ];
    return parts.map((part) => encodePart(part as string)).join(':');
};

export const buildDatasetFieldTargetId = (instanceId: string, fid: string, role: IMutField['analyticType']) =>
    composeAgentTargetId({ instanceId, kind: 'dataset-field', fid, role });

export const buildEncodingFieldTargetId = (
    instanceId: string,
    visId: string,
    channel: AgentEncodingChannel,
    index: number,
    fid?: string
) => composeAgentTargetId({ instanceId, kind: 'encoding-field', visId, channel, index, fid });

export const buildEncodingChannelTargetId = (instanceId: string, visId: string, channel: AgentEncodingChannel) =>
    composeAgentTargetId({ instanceId, kind: 'encoding-channel', visId, channel });

export const buildFilterFieldTargetId = (instanceId: string, visId: string, index: number, fid?: string) =>
    composeAgentTargetId({ instanceId, kind: 'filter-field', visId, index, fid });

export const buildFilterChannelTargetId = (instanceId: string, visId: string) => composeAgentTargetId({ instanceId, kind: 'filter-channel', visId });

export const TOOLBAR_ACTION_KEYS = ['transpose', 'sort:asc', 'sort:dec'] as const;
export type ToolbarActionKey = (typeof TOOLBAR_ACTION_KEYS)[number];

export const buildToolbarActionTargetId = (instanceId: string, actionKey: ToolbarActionKey) =>
    composeAgentTargetId({ instanceId, kind: 'toolbar-action', actionKey });

export const collectAgentTargets = (options: {
    instanceId: string;
    visId: string;
    encodings: DraggableFieldState;
    meta: IMutField[];
}): IGWAgentTargetSummary[] => {
    const { instanceId, visId, encodings, meta } = options;
    const targets: IGWAgentTargetSummary[] = [];

    meta.forEach((field) => {
        targets.push({
            id: buildDatasetFieldTargetId(instanceId, field.fid, field.analyticType),
            kind: 'dataset-field',
            label: field.name ?? field.fid,
            fid: field.fid,
            role: field.analyticType,
        });
    });

    (Object.keys(encodings) as (keyof DraggableFieldState)[]).forEach((channelKey) => {
        if (channelKey === 'filters') {
            (encodings.filters as IFilterField[] | undefined)?.forEach((field, index) => {
                targets.push({
                    id: buildFilterFieldTargetId(instanceId, visId, index, field.fid),
                    kind: 'filter-field',
                    label: field.name ?? field.fid,
                    index,
                    fid: field.fid,
                    visId,
                });
            });
            targets.push({
                id: buildFilterChannelTargetId(instanceId, visId),
                kind: 'filter-channel',
                label: 'filters',
                visId,
            });
            return;
        }
        const fields = encodings[channelKey] as IViewField[] | undefined;
        if (!fields || !fields.length) {
            targets.push({
                id: buildEncodingChannelTargetId(instanceId, visId, channelKey as AgentEncodingChannel),
                kind: 'encoding-channel',
                label: channelKey,
                channel: channelKey as AgentEncodingChannel,
                visId,
            });
            return;
        }
        fields.forEach((field, index) => {
            targets.push({
                id: buildEncodingFieldTargetId(instanceId, visId, channelKey as AgentEncodingChannel, index, field.fid),
                kind: 'encoding-field',
                label: field.name ?? field.fid,
                channel: channelKey as AgentEncodingChannel,
                index,
                fid: field.fid,
                visId,
            });
        });
        targets.push({
            id: buildEncodingChannelTargetId(instanceId, visId, channelKey as AgentEncodingChannel),
            kind: 'encoding-channel',
            label: channelKey,
            channel: channelKey as AgentEncodingChannel,
            visId,
        });
    });

    TOOLBAR_ACTION_KEYS.forEach((actionKey) => {
        targets.push({
            id: buildToolbarActionTargetId(instanceId, actionKey),
            kind: 'toolbar-action',
            label: actionKey,
            actionKey,
        });
    });

    return targets;
};

export const getAgentTargetElement = (targetId: string): HTMLElement | null => {
    return document.querySelector(`[data-gw-target="${targetId}"]`);
};
