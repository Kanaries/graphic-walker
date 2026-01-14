import {
    AgentEncodingChannel,
    IGWAgentTargetSummary,
    IAgentTargetDescriptor,
    AgentTargetKind,
    IMutField,
    DraggableFieldState,
    IViewField,
    IFilterField,
} from '../interfaces';

const TARGET_PREFIX = 'gw-target';

const encodePart = (value?: string | number | null) => encodeURIComponent(value ?? '');
const decodePart = (value: string | undefined) => decodeURIComponent(value ?? '');

export type ParsedAgentTargetId = {
    instanceId?: string;
    kind?: AgentTargetKind;
    visId?: string;
    channel?: AgentEncodingChannel;
    index?: number;
    fid?: string;
    role?: IMutField['analyticType'];
    actionKey?: string;
};

export const composeAgentTargetId = (descriptor: IAgentTargetDescriptor) => {
    const parts = [
        TARGET_PREFIX,
        descriptor.visId ?? '',
        descriptor.kind,
        descriptor.channel ?? '',
        descriptor.index ?? '',
        descriptor.fid ?? '',
        descriptor.role ?? '',
        descriptor.actionKey ?? '',
    ];
    return parts.map((part) => encodePart(part as string)).join(':');
};

export const buildDatasetFieldTargetId = (instanceId: string, visId: string, fid: string, role: IMutField['analyticType']) =>
    composeAgentTargetId({ instanceId, visId, kind: 'dataset-field', fid, role });

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

const TOOLBAR_ACTION_KEYS = new Set<string>(['transpose', 'sort:asc', 'sort:dec']);
export type ToolbarActionKey = string;

export const registerToolbarActionKey = (actionKey: string | string[]) => {
    const keys = Array.isArray(actionKey) ? actionKey : [actionKey];
    keys.forEach((key) => {
        if (key) {
            TOOLBAR_ACTION_KEYS.add(key);
        }
    });
};

const getToolbarActionKeys = () => Array.from(TOOLBAR_ACTION_KEYS);

export const buildToolbarActionTargetId = (instanceId: string, visId: string, actionKey: ToolbarActionKey) =>
    composeAgentTargetId({ instanceId, visId, kind: 'toolbar-action', actionKey });

export const parseAgentTargetId = (targetId: string): ParsedAgentTargetId | null => {
    if (!targetId) {
        return null;
    }
    const parts = targetId.split(':');
    if (!parts.length) {
        return null;
    }
    const [prefix, visId, kind, channel, index, fid, role, actionKey] = parts.map((part) => decodePart(part));
    if (prefix !== TARGET_PREFIX) {
        return null;
    }
    return {
        kind: (kind as AgentTargetKind) || undefined,
        visId: visId || undefined,
        channel: (channel as AgentEncodingChannel) || undefined,
        index: index ? Number(index) : undefined,
        fid: fid || undefined,
        role: (role as IMutField['analyticType']) || undefined,
        actionKey: actionKey || undefined,
    };
};

export const collectAgentTargets = (options: {
    instanceId: string;
    visId: string;
    encodings: DraggableFieldState;
    meta: IMutField[];
}): IGWAgentTargetSummary[] => {
    const { instanceId, visId, encodings, meta } = options;
    const targets: IGWAgentTargetSummary[] = [];

    const datasetFieldMap = new Map<string, IMutField>();
    meta.forEach((field) => {
        datasetFieldMap.set(field.fid, field);
    });
    [...(encodings.dimensions ?? []), ...(encodings.measures ?? [])].forEach((field) => {
        if (!field || datasetFieldMap.has(field.fid)) {
            return;
        }
        datasetFieldMap.set(field.fid, field as IMutField);
    });

    datasetFieldMap.forEach((field) => {
        targets.push({
            id: buildDatasetFieldTargetId(instanceId, visId, field.fid, field.analyticType),
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

    getToolbarActionKeys().forEach((actionKey) => {
        targets.push({
            id: buildToolbarActionTargetId(instanceId, visId, actionKey),
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
