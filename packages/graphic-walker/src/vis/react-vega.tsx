import React, { useEffect, useState, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import embed from 'vega-embed';
import { Subject } from 'rxjs'
import * as op from 'rxjs/operators';
import type { ScenegraphEvent, View } from 'vega';
import styled from 'styled-components';

import type { IViewField, IRow, IStackMode } from '../interfaces';
import type { IVisEncodingChannel, IVisField, IVisSchema } from './protocol/interface';
import type { IVegaConfigSchema } from './protocol/adapter';
import { getVegaTimeFormatRules } from './temporalFormat';
import { getSingleView } from './spec/view';
import { NULL_FIELD } from './spec/field';

const CanvaContainer = styled.div<{rowSize: number; colSize: number;}>`
  display: grid;
  grid-template-columns: repeat(${props => props.colSize}, 1fr);
  grid-template-rows: repeat(${props => props.rowSize}, 1fr);
`

const SELECTION_NAME = 'geom';
export interface IReactVegaHandler {
  getSVGData: () => Promise<string[]>;
  getCanvasData: () => Promise<string[]>;
  downloadSVG: (filename?: string) => Promise<string[]>;
  downloadPNG: (filename?: string) => Promise<string[]>;
}
interface ReactVegaProps {
  spec: IVisSchema<IVegaConfigSchema>;
  data: readonly IRow[];
  fields: readonly IVisField[];
  onGeomClick?: (values: any, e: any) => void
  /** @default "en-US" */
  locale?: string;
}

const click$ = new Subject<ScenegraphEvent>();
const selection$ = new Subject<any>();
const geomClick$ = selection$.pipe(
  op.withLatestFrom(click$),
  op.filter(([values, _]) => {
    if (Object.keys(values).length > 0) {
      return true
    }
    return false
  })
);

const resolveViewField = (
  fields: readonly IVisField[],
  ref: IVisEncodingChannel | undefined,
): IViewField => {
  if (!ref) {
    return NULL_FIELD;
  }
  const fieldKey = typeof ref === 'string' ? ref : ref.field;
  const field = fields.find(m => m.key === fieldKey);
  if (!field) {
    return NULL_FIELD;
  }
  const isMeasure = typeof ref !== 'string' && Boolean(ref.aggregate);
  const f: IViewField = {
    dragId: '',
    fid: field.key,
    name: field.name || fieldKey,
    semanticType: field.type,
    analyticType: isMeasure ? 'measure' : 'dimension',
  };
  if (isMeasure) {
    f.aggName = ref.aggregate;
  } else {
    if (typeof ref !== 'string' && ref.sort) {
      const order = typeof ref.sort === 'string' ? ref.sort : ref.sort.order ?? 'asc';
      f.sort = order === 'desc' ? 'descending' : 'ascending';
    }
  }
  return f;
};


const ReactVega = forwardRef<IReactVegaHandler, ReactVegaProps>(function ReactVega (props, ref) {
  const {
    spec,
    data: dataSource,
    onGeomClick,
    locale = 'en-US',
    fields,
  } = props;
  const { encodings, size: sizeConfig, markType } = spec;
  const [viewPlaceholders, setViewPlaceholders] = useState<React.MutableRefObject<HTMLDivElement>[]>([]);

  const vegaConfig = spec.configs.vegaConfig;
  const { interactiveScale, showActions } = spec.configs;

  useEffect(() => {
    const clickSub = geomClick$.subscribe(([values, e]) => {
      if (onGeomClick) {
        onGeomClick(values, e);
      }
    })
    return () => {
      clickSub.unsubscribe();
    }
  }, [onGeomClick]);

  const nRows = useMemo(() => {
    const fields = Array.isArray(encodings.y) ? encodings.y : [encodings.y];
    return fields.length;
  }, [encodings.y]);
  const nCols = useMemo(() => {
    const fields = Array.isArray(encodings.x) ? encodings.x : [encodings.x];
    return fields.length;
  }, [encodings.x]);

  useEffect(() => {
    setViewPlaceholders(views => {
      const viewNum = Math.max(1, nRows * nCols)
      const nextViews = new Array(viewNum).fill(null).map((v, i) => views[i] || React.createRef())
      return nextViews;
    })
  }, [nRows, nCols])

  const vegaRefs = useRef<View[]>([]);

  const allFieldIds = useMemo(() => {
    const { x, y, column, row, color, opacity, size } = encodings;
    return [x, y, column, row, color, opacity, size].filter(Boolean).flat().reduce<string[]>((acc, field) => {
      const key = typeof field === 'string' ? field : field?.field;
      if (key && !acc.includes(key)) {
        acc.push(key);
      }
      return acc;
    }, []);
  }, [encodings]);

  useEffect(() => {
    vegaRefs.current = [];

    const vegaLiteSpec: any = {
      data: {
        values: dataSource,
      },
      params: [{
        name: SELECTION_NAME,
        select: {
          type: 'point',
          fields: allFieldIds
        }
      }]
    };
    if (interactiveScale) {
      vegaLiteSpec.params.push({
        name: "grid",
        select: "interval",
        bind: "scales"
      })
    }
    const { x, y, color, opacity, shape, size, theta, radius, text, row, column, details } = encodings;
    const stack = [x, y, row, column, theta, radius].filter(Boolean).flat().map<IStackMode>(f => {
      if (typeof f === 'string') {
        return 'none';
      }
      if (f?.stack === 'normalize') {
        return 'normalize';
      } else if (f?.stack && f.stack !== 'none') {
        return 'stack';
      }
      return 'none';
    }).find(m => m !== 'none') || 'none';
    const aggregated = Object.values(encodings).flat().some(f => {
      if (typeof f === 'string') {
        return false;
      }
      return Boolean(f?.aggregate);
    });
    if (nRows <= 1 && nCols <= 1) {
      if (sizeConfig) {
        if (!row && !column) {
          vegaLiteSpec.autosize = 'fit';
        }
        vegaLiteSpec.width = sizeConfig.width;
        vegaLiteSpec.height = sizeConfig.height;
      }
      const singleView = getSingleView({
        x: resolveViewField(fields, Array.isArray(x) ? x[0] : x),
        y: resolveViewField(fields, Array.isArray(y) ? y[0] : y),
        color: resolveViewField(fields, color),
        opacity: resolveViewField(fields, opacity),
        size: resolveViewField(fields, size),
        shape: resolveViewField(fields, shape),
        theta: resolveViewField(fields, theta),
        radius: resolveViewField(fields, radius),
        text: resolveViewField(fields, text),
        row: resolveViewField(fields, row),
        column: resolveViewField(fields, column),
        xOffset: NULL_FIELD,
        yOffset: NULL_FIELD,
        details: details ? (
          Array.isArray(details) ? details : [details]
        ).map(f => resolveViewField(fields, f)) : [],
        defaultAggregated: aggregated,
        stack,
        geomType: markType,
      });

      vegaLiteSpec.mark = singleView.mark;
      if ('encoding' in singleView) {
        vegaLiteSpec.encoding = singleView.encoding;
      }

      if (viewPlaceholders.length > 0 && viewPlaceholders[0].current) {
        embed(viewPlaceholders[0].current, vegaLiteSpec, { mode: 'vega-lite', actions: showActions, timeFormatLocale: getVegaTimeFormatRules(locale), config: vegaConfig }).then(res => {
          vegaRefs.current = [res.view];
          try {
            res.view.addEventListener('click', (e) => {
              click$.next(e);
            })
            res.view.addSignalListener(SELECTION_NAME, (name: any, values: any) => {
              selection$.next(values);
            }); 
          } catch (error) {
            console.warn(error)
          }
        });
      }
    } else {
      if (sizeConfig) {
        vegaLiteSpec.width = Math.floor(Math.max(1, sizeConfig.width) / nCols) - 5;
        vegaLiteSpec.height = Math.floor(Math.max(1, sizeConfig.height) / nRows) - 5;
        vegaLiteSpec.autosize = 'fit';
      }
      let index = 0;
      const rowCount = Math.max(nRows, 1);
      const colCount = Math.max(nCols, 1);
      for (let i = 0; i < rowCount; i++) {
        for (let j = 0; j < colCount; j++, index++) {
          const hasLegend = i === 0 && j === colCount - 1;
          const singleView = getSingleView({
            x: resolveViewField(fields, Array.isArray(x) ? x[j] : x),
            y: resolveViewField(fields, Array.isArray(y) ? y[i] : y),
            color: resolveViewField(fields, color),
            opacity: resolveViewField(fields, opacity),
            size: resolveViewField(fields, size),
            shape: resolveViewField(fields, shape),
            theta: resolveViewField(fields, theta),
            radius: resolveViewField(fields, radius),
            row: resolveViewField(fields, row),
            column: resolveViewField(fields, column),
            text: resolveViewField(fields, text),
            xOffset: NULL_FIELD,
            yOffset: NULL_FIELD,
            details: details ? (
              Array.isArray(details) ? details : [details]
            ).map(f => resolveViewField(fields, f)) : [],
            defaultAggregated: aggregated,
            stack,
            geomType: markType,
            hideLegend: !hasLegend,
          });
          const node = i * colCount + j < viewPlaceholders.length ? viewPlaceholders[i * colCount + j].current : null
          let commonSpec = { ...vegaLiteSpec };

          const ans = { ...commonSpec, ...singleView }
          if ('params' in commonSpec) {
            ans.params = commonSpec.params;
          }
          if (node) {
            embed(node, ans, { mode: 'vega-lite', actions: showActions, timeFormatLocale: getVegaTimeFormatRules(locale), config: vegaConfig }).then(res => {
              vegaRefs.current.push(res.view);
              try {
                res.view.addEventListener('click', (e) => {
                  click$.next(e);
                })
                res.view.addSignalListener(SELECTION_NAME, (name: any, values: any) => {
                  selection$.next(values);
                }); 
              } catch (error) {
                console.warn(error);
              }
            })
          }
        }
      }
    }
  }, [
    dataSource,
    allFieldIds,
    fields,
    encodings,
    markType,
    vegaConfig,
    showActions,
    sizeConfig,
    viewPlaceholders,
    nRows,
    nCols,
    locale,
  ]);

  useImperativeHandle(ref, () => ({
    getSVGData() {
      return Promise.all(vegaRefs.current.map(view => view.toSVG()));
    },
    async getCanvasData() {
      const canvases = await Promise.all(vegaRefs.current.map(view => view.toCanvas()));
      return canvases.map(canvas => canvas.toDataURL('image/png'));
    },
    async downloadSVG(filename = `gw chart ${Date.now() % 1_000_000}`.padStart(6, '0')) {
      const data = await Promise.all(vegaRefs.current.map(view => view.toSVG()));
      const files: string[] = [];
      for (let i = 0; i < data.length; i += 1) {
        const d = data[i];
        const file = new File([d], `${filename}${data.length > 1 ? `_${i + 1}` : ''}.svg`);
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.download = file.name;
        a.href = url;
        a.click();
        requestAnimationFrame(() => {
          URL.revokeObjectURL(url);
        });
      }
      return files;
    },
    async downloadPNG(filename = `gw chart ${Date.now() % 1_000_000}`.padStart(6, '0')) {
      const canvases = await Promise.all(vegaRefs.current.map(view => view.toCanvas(2)));
      const data = canvases.map(canvas => canvas.toDataURL('image/png', 1));
      const files: string[] = [];
      for (let i = 0; i < data.length; i += 1) {
        const d = data[i];
        const a = document.createElement('a');
        a.download = `${filename}${data.length > 1 ? `_${i + 1}` : ''}.png`;
        a.href = d.replace(/^data:image\/[^;]/, 'data:application/octet-stream');
        a.click();
      }
      return files;
    },
  }));

  return <CanvaContainer rowSize={Math.max(nRows, 1)} colSize={Math.max(nCols, 1)}>
    {/* <div ref={container}></div> */}
    {
      viewPlaceholders.map((view, i) => <div key={i} ref={view}></div>)
    }
  </CanvaContainer>
});

export default ReactVega;
