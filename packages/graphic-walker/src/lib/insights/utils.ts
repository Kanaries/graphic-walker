import { IAggregator, IField } from '../../interfaces';
import { IAggQuery } from '../interfaces';

export function groupByAnalyticTypes(fields: IField[]) {
    const dimensions = fields.filter((f) => f.analyticType === 'dimension');
    const measures = fields.filter((f) => f.analyticType === 'measure');
    return {
        dimensions,
        measures,
    };
}

export function meaList2AggProps(measures: IField[]): IAggQuery['agg'] {
    return Object.fromEntries(measures.map((mea) => [mea.fid, (mea.aggName ?? 'sum') as IAggregator]));
}

export function complementaryFields(props: { selection: IField[]; all: IField[] }): IField[] {
    return props.all
        .filter((f) => f.analyticType === 'dimension')
        .filter((f) => !props.selection.find((vf) => vf.fid === f.fid));
}
