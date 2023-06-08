import { IAggregator } from "../../interfaces";

export interface INestNode {
    key: string;
    value: string;
    uniqueKey: string;
    fieldKey: string;
    children: INestNode[];
    height: number;
    isCollapsed: boolean;
    path: Record<INestNode["fieldKey"], INestNode["value"]>[];
}
