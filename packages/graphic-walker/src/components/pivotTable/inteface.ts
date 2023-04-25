import { IAggregator } from "../../interfaces";

export interface INestNode {
    key: string;
    value: string;
    fieldKey: string;
    children: INestNode[];
}

export interface IGroupByQuery {
    groupBy: string[];
    measures: { field: string; agg: IAggregator }[];
}
