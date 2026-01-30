export type NestSortToken = {
    priority: number;
    value: string | number;
};

export interface INestNode {
    key: string | number;
    value: string | number;
    sort: NestSortToken;
    uniqueKey: string;
    fieldKey: string;
    children: INestNode[];
    height: number;
    isCollapsed: boolean;
    path: Record<INestNode["fieldKey"], INestNode["value"]>[];
}
