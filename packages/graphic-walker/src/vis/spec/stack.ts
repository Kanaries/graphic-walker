import { IStackMode } from "../../interfaces";

export function channelStack(encoding: { [key: string]: any }, stackMode: IStackMode) {
    if (stackMode === 'stack') return;
    if (encoding.x && encoding.x.type === 'quantitative') {
        encoding.x.stack = stackMode === 'none' ? null : 'normalize';
    }
    if (encoding.y && encoding.y.type === 'quantitative') {
        encoding.y.stack = stackMode === 'none' ? null : 'normalize';
    }
}
