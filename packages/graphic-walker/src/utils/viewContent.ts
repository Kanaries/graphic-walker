import { COUNT_FIELD_ID } from "../constants";
import type { IMutField, IStackMode, ViewContentEntry } from "../interfaces";
import type { VizSpecStore } from "../store/visualSpecStore";


export const fromViewData = (
  rawFields: IMutField[],
  binnedFields: Map<string, string>,
  schema: VizSpecStore['draggableFieldState'],
  aggregationEnabled: boolean,
  stackMode: IStackMode,
): ViewContentEntry => {
  const fields = rawFields.filter(f => f.fid !== COUNT_FIELD_ID);

  return {
    fields: fields.map(f => ({
      fid: f.fid,
      name: f.name ?? '',
      semanticType: f.semanticType,
      analyticType: f.analyticType,
    })),
    filters: schema.filters.map<undefined | ViewContentEntry['filters'][number]>(filter => {
      const rule = filter.rule;
      if (!rule) {
        return undefined;
      }
      const isBinned = binnedFields.has(filter.fid);
      const fid = isBinned ? binnedFields.get(filter.fid) : filter.fid;
      const f = fields.find(which => which.fid === fid);

      return fid && f ? rule.type === 'one of' ? {
        fid,
        type: 'set',
        values: [...rule.value],
      } : {
        fid,
        type: 'range',
        range: [rule.value[0], rule.value[1]],
      } : undefined;
    }).filter(Boolean) as ViewContentEntry['filters'],
    encodes: (
      ['columns', 'rows', 'color', 'opacity', 'size', 'shape'] as const
    ).map(key => schema[key].map(item => {
      const isBinned = binnedFields.has(item.fid);
      const fid = isBinned ? binnedFields.get(item.fid) : item.fid;
      const f = fields.find(which => which.fid === fid);

      return f ? {
        field: f.fid,
        title: item.name,
        type: item.semanticType,
        aggregate: aggregationEnabled ? item.aggName : undefined,
        bin: isBinned,
        /**
         * only applicable for x, y, theta, and radius channels with continuous domains.
         * @default
         * /** zero for plots with all of the following conditions are true:
         * (1) the mark is bar, area, or arc;
         * (2) the stacked measure channel (x or y) has a linear scale;
         * (3) At least one of non-position channels mapped to an unaggregated field that is different from x and y.
         * Otherwise, null by default. *\/
         * @see https://vega.github.io/vega-lite/docs/stack.html#encoding
         */
        stack: ['columns', 'rows', 'theta', 'radius'].includes(key) ? stackMode : undefined,
      } : fid === COUNT_FIELD_ID ? {
        title: item.name,
        type: item.semanticType,
        aggregate: 'count',
        bin: isBinned,
        stack: ['columns', 'rows', 'theta', 'radius'].includes(key) ? stackMode : undefined,
      } : undefined;
    }).filter(Boolean) as ViewContentEntry['encodes']).flat(),
  };
};
