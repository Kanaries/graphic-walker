import { IAggregator } from "../../interfaces";

export interface INestNode {
    key: string | number;
    value: string | number;
    sort: string | number;
    uniqueKey: string;
    fieldKey: string;
    children: INestNode[];
    height: number;
    isCollapsed: boolean;
    path: Record<INestNode["fieldKey"], INestNode["value"]>[];
}
