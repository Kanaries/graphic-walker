import React, { useEffect, useState, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import embed from 'vega-embed';
import { Subject, Subscription } from 'rxjs'
import * as op from 'rxjs/operators';
import type { ScenegraphEvent, View } from 'vega';
import { ISemanticType } from 'visual-insights';
import styled from 'styled-components';
import { autoMark } from '../utils/autoMark';
import { COUNT_FIELD_ID } from '../constants';

import { IViewField, IRow, IStackMode } from '../interfaces';
import { useTranslation } from 'react-i18next';
import { getVegaTimeFormatRules } from './temporalFormat';

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
  rows: Readonly<IViewField[]>;
  columns: Readonly<IViewField[]>;
  dataSource: IRow[];
  defaultAggregate?: boolean;
  stack: IStackMode;
  interactiveScale: boolean;
  geomType: string;
  color?: IViewField;
  opacity?: IViewField;
  size?: IViewField;
  shape?: IViewField;
  theta?: IViewField;
  radius?: IViewField;
  showActions: boolean;
  layoutMode: string;
  width: number;
  height: number;
  onGeomClick?: (values: any, e: any) => void
  selectEncoding: SingleViewProps['selectEncoding'];
  brushEncoding: SingleViewProps['brushEncoding'];
}
const NULL_FIELD: IViewField = {
  dragId: '',
  fid: '',
  name: '',
  semanticType: 'quantitative',
  analyticType: 'measure',
  aggName: 'sum'
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
function getFieldType(field: IViewField): 'quantitative' | 'nominal' | 'ordinal' | 'temporal' {
  return field.semanticType
}

const BRUSH_SIGNAL_NAME = "__gw_brush__";
const POINT_SIGNAL_NAME = "__gw_point__";

interface ParamStoreEntry {
  signal: typeof BRUSH_SIGNAL_NAME | typeof POINT_SIGNAL_NAME;
  /** 这个标记用于防止循环 */
  source: number;
  data: any;
}

interface SingleViewProps {
  x: IViewField;
  y: IViewField;
  color: IViewField;
  opacity: IViewField;
  size: IViewField;
  shape: IViewField,
  xOffset: IViewField;
  yOffset: IViewField;
  row: IViewField;
  column: IViewField;
  theta: IViewField;
  radius: IViewField;
  defaultAggregated: boolean;
  stack: IStackMode;
  geomType: string;
  enableCrossFilter: boolean;
  asCrossFilterTrigger: boolean;
  selectEncoding: 'default' | 'none';
  brushEncoding: 'x' | 'y' | 'default' | 'none';
}

function availableChannels (geomType: string): Set<string> {
  if (geomType === 'arc') {
    return new Set(['opacity', 'color', 'size', 'theta', 'radius'])
  }
  return new Set(['column', 'opacity', 'color', 'row', 'size', 'x', 'y', 'xOffset', 'yOffset', 'shape'])
}
interface EncodeProps extends Pick<SingleViewProps, 'column' | 'opacity' | 'color' | 'row' | 'size' | 'x' | 'y' | 'xOffset' | 'yOffset' | 'shape' | 'theta' | 'radius'> {
  geomType: string;
}
function channelEncode(props: EncodeProps) {
  const avcs = availableChannels(props.geomType)
  const encoding: {[key: string]: any} = {}
  Object.keys(props).filter(c => avcs.has(c)).forEach(c => {
    if (props[c] !== NULL_FIELD) {
      encoding[c] = {
        field: props[c].fid,
        title: props[c].name,
        type: props[c].semanticType
      }
    }
  })
  // FIXME: temporal fix, only for x and y relative order
  if (encoding.x && encoding.y) {
    if ((props.x.sort && props.x.sort) || (props.y && props.y.sort)) {
      if (props.x.sort !== 'none' && (props.y.sort === 'none' || !Boolean(props.y.sort)))  {
        encoding.x.sort = {
          encoding: 'y',
          order: props.x.sort
        }
      } else if (props.y.sort && props.y.sort !== 'none' && (props.x.sort === 'none' || !Boolean(props.x.sort)))  {
        encoding.y.sort = {
          encoding: 'x',
          order: props.y.sort
        }
      }
    }
  }
  return encoding
}
function channelAggregate(encoding: {[key: string]: any}, fields: {[key: string]: IViewField}) {
  Object.entries(encoding).forEach(([key, c]) => {
    const targetField = fields[key];
    if (targetField && targetField.fid === COUNT_FIELD_ID) {
      c.field = undefined;
      c.aggregate = 'count';
      c.title = 'Count'
    } else if (targetField && targetField.analyticType === 'measure') {
      c.title = `${targetField.aggName}(${targetField.name})`;
      c.aggregate = targetField.aggName;
    }
  })
}
function channelStack(encoding: {[key: string]: any}, stackMode: IStackMode) {
  if (stackMode === 'stack') return;
  if (encoding.x && encoding.x.type === 'quantitative') {
    encoding.x.stack = stackMode === 'none' ? null : 'normalize'
  }
  if (encoding.y && encoding.y.type === 'quantitative') {
    encoding.y.stack = stackMode === 'none' ? null : 'normalize'
  }
}
// TODO: xOffset等通道的特性不太稳定，建议后续vega相关特性稳定后，再使用。
// 1. 场景太细，仅仅对对应的坐标轴是nominal(可能由ordinal)时，才可用
// 2. 部分geom type会出现bug，如line，会出现组间的错误连接
// "vega": "^5.22.0",
// "vega-embed": "^6.20.8",
// "vega-lite": "^5.2.0",
function getSingleView(props: SingleViewProps) {
  const {
    x,
    y,
    color,
    opacity,
    size,
    shape,
    theta,
    radius,
    row,
    column,
    xOffset,
    yOffset,
    defaultAggregated,
    stack,
    geomType,
    selectEncoding,
    brushEncoding,
    enableCrossFilter,
    asCrossFilterTrigger,
  } = props
  const fields = { x, y, color, opacity, size, shape, row, column, xOffset, yOffset, theta, radius };
  let markType = geomType;
  if (geomType === 'auto') {
    const types: ISemanticType[] = [];
    if (x !== NULL_FIELD) types.push(x.semanticType)//types.push(getFieldType(x));
    if (y !== NULL_FIELD) types.push(y.semanticType)//types.push(getFieldType(yField));
    markType = autoMark(types);
  }

  let encoding = channelEncode({ geomType: markType, x, y, color, opacity, size, shape, row, column, xOffset, yOffset, theta, radius })
  if (defaultAggregated) {
    channelAggregate(encoding, fields);
  }
  channelStack(encoding, stack);
  if (!enableCrossFilter || brushEncoding === 'none' && selectEncoding === 'none') {
    return {
      mark: {
        type: markType,
        opacity: 0.96,
        tooltip: true
      },
      encoding
    };
  }
  const mark = {
    type: markType,
    opacity: 0.96,
    tooltip: true
  };

  // TODO:
  // 鉴于 Vega 中使用 layer 会导致一些难以覆盖的预期外行为，
  // 破坏掉引入交互后视图的正确性，
  // 目前不使用 layer 来实现交互（注掉以下代码）。
  // 考虑 layer 的目的是 layer + condition 可以用于同时展现“全集”（context）和“选中”两层结构，尤其对于聚合数据有分析帮助；
  // 同时，不需要关心作为筛选器的是哪一张图。
  // 现在采用临时方案，区别产生筛选的来源，并对其他图仅借助 transform 展现筛选后的数据。
  // #[BEGIN bad-layer-interaction]
  // const shouldUseMultipleLayers = brushEncoding !== 'none' && Object.values(encoding).some(channel => {
  //   return typeof channel.aggregate === 'string' && /* 这种 case 对应行数 */ typeof channel.field === 'string';
  // });
  // if (shouldUseMultipleLayers) {
  //   if (['column', 'row'].some(key => key in encoding && encoding[key].length > 0)) {
  //     // 这种情况 Vega 不能处理，是因为 Vega 不支持在 layer 中使用 column / row channel，
  //     // 会导致渲染出来的视图无法与不使用交互时的结果不变。
  //     return {
  //       params: [
  //         {
  //           name: BRUSH_SIGNAL_NAME,
  //           select: { type: 'interval', encodings: brushEncoding === 'default' ? undefined : [brushEncoding] },
  //         },
  //       ],
  //       mark,
  //       encoding: {
  //         ...encoding,
  //         color: {
  //           condition: {
  //             ...encoding.color,
  //             param: BRUSH_SIGNAL_NAME,
  //           },
  //           value: '#888',
  //         },
  //       },
  //     };
  //   }
  //   return {
  //     layer: [
  //       {
  //         params: [
  //           {
  //             name: BRUSH_SIGNAL_NAME,
  //             select: { type: 'interval', encodings: brushEncoding === 'default' ? undefined : [brushEncoding] },
  //           },
  //         ],
  //         mark,
  //         encoding: {
  //           ...encoding,
  //           color: 'color' in encoding ? {
  //             condition: {
  //               ...encoding.color,
  //               test: 'false',
  //             },
  //             value: '#888',
  //           } : {
  //             value: '#888',
  //           },
  //         },
  //       },
  //       {
  //         transform: [{ filter: { param: BRUSH_SIGNAL_NAME }}],
  //         mark,
  //         encoding: {
  //           ...encoding,
  //           color: encoding.color ?? { value: 'steelblue' },
  //         },
  //       },
  //     ],
  //   };
  // } else if (brushEncoding !== 'none') {
  //   return {
  //     params: [
  //       {
  //         name: BRUSH_SIGNAL_NAME,
  //         select: { type: 'interval', encodings: brushEncoding === 'default' ? undefined : [brushEncoding] },
  //       },
  //     ],
  //     mark,
  //     encoding: {
  //       ...encoding,
  //       color: {
  //         condition: {
  //           ...encoding.color,
  //           param: BRUSH_SIGNAL_NAME,
  //         },
  //         value: '#888',
  //       },
  //     },
  //   };
  // }
  // #[END bad-layer-interaction]

  if (brushEncoding !== 'none') {
    return {
      transform: asCrossFilterTrigger ? [] : [
        { filter: { param: BRUSH_SIGNAL_NAME } }
      ],
      params: [
        // {
        //   name: BRUSH_SIGNAL_DISPLAY_NAME,
        //   select: { type: 'interval', encodings: brushEncoding === 'default' ? undefined : [brushEncoding] },
        //   on: '__YOU_CANNOT_MODIFY_THIS_SIGNAL__',
        // },
        {
          name: BRUSH_SIGNAL_NAME,
          select: { type: 'interval', encodings: brushEncoding === 'default' ? undefined : [brushEncoding] },
        },
      ],
      mark,
      encoding,
    };
  }

  return {
    transform: asCrossFilterTrigger ? [] : [
      { filter: { param: POINT_SIGNAL_NAME } }
    ],
    params: [
      {
        name: POINT_SIGNAL_NAME,
        select: { type: 'point' },
      },
    ],
    mark,
    encoding: asCrossFilterTrigger ? {
      ...encoding,
      color: {
        condition: {
          ...encoding.color,
          param: POINT_SIGNAL_NAME,
        },
        value: '#888',
      },
    } : encoding,
  };
}
const ReactVega = forwardRef<IReactVegaHandler, ReactVegaProps>(function ReactVega (props, ref) {
  const {
    dataSource = [],
    rows = [],
    columns = [],
    defaultAggregate = true,
    stack = 'stack',
    geomType,
    color,
    opacity,
    size,
    theta,
    radius,
    shape,
    onGeomClick,
    showActions,
    interactiveScale,
    layoutMode,
    width,
    height,
    selectEncoding,
    brushEncoding,
  } = props;
  // const container = useRef<HTMLDivElement>(null);
  // const containers = useRef<(HTMLDivElement | null)[]>([]);
  const [viewPlaceholders, setViewPlaceholders] = useState<React.MutableRefObject<HTMLDivElement>[]>([]);
  const { i18n } = useTranslation();
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
  const rowDims = useMemo(() => rows.filter(f => f.analyticType === 'dimension'), [rows]);
  const colDims = useMemo(() => columns.filter(f => f.analyticType === 'dimension'), [columns]);
  const rowMeas = useMemo(() => rows.filter(f => f.analyticType === 'measure'), [rows]);
  const colMeas = useMemo(() => columns.filter(f => f.analyticType === 'measure'), [columns]);
  const rowFacetFields = useMemo(() => rowDims.slice(0, -1), [rowDims]);
  const colFacetFields = useMemo(() => colDims.slice(0, -1), [colDims]);
  const rowRepeatFields = useMemo(() => rowMeas.length === 0 ? rowDims.slice(-1) : rowMeas, [rowDims, rowMeas]);//rowMeas.slice(0, -1);
  const colRepeatFields = useMemo(() => colMeas.length === 0 ? colDims.slice(-1) : colMeas, [rowDims, rowMeas]);//colMeas.slice(0, -1);
  const allFieldIds = useMemo(() => [...rows, ...columns, color, opacity, size].filter(f => Boolean(f)).map(f => (f as IViewField).fid), [rows, columns, color, opacity, size]);

  const [crossFilterTriggerIdx, setCrossFilterTriggerIdx] = useState(-1);

  useEffect(() => {
    setCrossFilterTriggerIdx(-1);
    setViewPlaceholders(views => {
      const viewNum = Math.max(1, rowRepeatFields.length * colRepeatFields.length)
      const nextViews = new Array(viewNum).fill(null).map((v, i) => views[i] || React.createRef())
      return nextViews;
    })
  }, [rowRepeatFields, colRepeatFields])

  const vegaRefs = useRef<View[]>([]);

  useEffect(() => {
    vegaRefs.current = [];

    const yField = rows.length > 0 ? rows[rows.length - 1] : NULL_FIELD;
    const xField = columns.length > 0 ? columns[columns.length - 1] : NULL_FIELD;

    const rowLeftFacetFields = rows.slice(0, -1).filter(f => f.analyticType === 'dimension');
    const colLeftFacetFields = columns.slice(0, -1).filter(f => f.analyticType === 'dimension');

    const rowFacetField = rowLeftFacetFields.length > 0 ? rowLeftFacetFields[rowLeftFacetFields.length - 1] : NULL_FIELD;
    const colFacetField = colLeftFacetFields.length > 0 ? colLeftFacetFields[colLeftFacetFields.length - 1] : NULL_FIELD;

    const spec: any = {
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
      spec.params.push({
        name: "grid",
        select: "interval",
        bind: "scales"
      })
    }
    if (rowRepeatFields.length <= 1 && colRepeatFields.length <= 1) {
      if (layoutMode === 'fixed') {
        if (rowFacetField === NULL_FIELD && colFacetField === NULL_FIELD) {
          spec.autosize = 'fit'
        }
        spec.width = width;
        spec.height = height;
      }
      const singleView = getSingleView({
        x: xField,
        y: yField,
        color: color ? color : NULL_FIELD,
        opacity: opacity ? opacity : NULL_FIELD,
        size: size ? size : NULL_FIELD,
        shape: shape ? shape : NULL_FIELD,
        theta: theta ? theta : NULL_FIELD,
        radius: radius ? radius : NULL_FIELD,
        row: rowFacetField,
        column: colFacetField,
        xOffset: NULL_FIELD,
        yOffset: NULL_FIELD,
        defaultAggregated: defaultAggregate,
        stack,
        geomType,
        selectEncoding,
        brushEncoding,
        enableCrossFilter: false,
        asCrossFilterTrigger: false,
      });
      // if (layoutMode === 'fixed') {
      //   spec.width = 800;
      //   spec.height = 600;
      // }
      spec.mark = singleView.mark;
      if ('encoding' in singleView) {
        spec.encoding = singleView.encoding;
      }

      // #[BEGIN bad-layer-interaction]
      // if ('layer' in singleView) {
      //   if ('params' in spec) {
      //     const basicParams = spec['params'];
      //     delete spec['params'];
      //     singleView.layer![0].params = [...basicParams, ...singleView.layer![0].params ?? []];
      //   }
      //   spec.layer = singleView.layer;
      // } else if ('params' in singleView) {
      //   spec.params.push(...singleView.params!);
      // }
      // #[END bad-layer-interaction]

      if ('params' in singleView) {
        spec.params.push(...singleView.params!);
      }
      if (viewPlaceholders.length > 0 && viewPlaceholders[0].current) {
        embed(viewPlaceholders[0].current, spec, { mode: 'vega-lite', actions: showActions, timeFormatLocale: getVegaTimeFormatRules(i18n.language) }).then(res => {
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
      if (layoutMode === 'fixed') {
        spec.width = Math.floor(width / colRepeatFields.length) - 5;
        spec.height = Math.floor(height / rowRepeatFields.length) - 5;
        spec.autosize = 'fit'
      }
      const combinedParamStore$ = new Subject<ParamStoreEntry>();
      const throttledParamStore$ = combinedParamStore$.pipe(
        op.throttleTime(
          dataSource.length / 64 * rowRepeatFields.length * colRepeatFields.length,
          undefined,
          { leading: false, trailing: true }
        )
      );
      const subscriptions: Subscription[] = [];
      const subscribe = (cb: (entry: ParamStoreEntry) => void) => {
        subscriptions.push(throttledParamStore$.subscribe(cb));
      };
      let index = 0;
      for (let i = 0; i < rowRepeatFields.length; i++) {
        for (let j = 0; j < colRepeatFields.length; j++, index++) {
          const sourceId = index;
          const singleView = getSingleView({
            x: colRepeatFields[j] || NULL_FIELD,
            y: rowRepeatFields[i] || NULL_FIELD,
            color: color ? color : NULL_FIELD,
            opacity: opacity ? opacity : NULL_FIELD,
            size: size ? size : NULL_FIELD,
            shape: shape ? shape : NULL_FIELD,
            theta: theta ? theta : NULL_FIELD,
            radius: radius ? radius : NULL_FIELD,
            row: rowFacetField,
            column: colFacetField,
            xOffset: NULL_FIELD,
            yOffset: NULL_FIELD,
            defaultAggregated: defaultAggregate,
            stack,
            geomType,
            selectEncoding,
            brushEncoding,
            enableCrossFilter: crossFilterTriggerIdx !== -1,
            asCrossFilterTrigger: crossFilterTriggerIdx === sourceId,
          });
          const node = i * colRepeatFields.length + j < viewPlaceholders.length ? viewPlaceholders[i * colRepeatFields.length + j].current : null
          let commonSpec = { ...spec };

          // #[BEGIN bad-layer-interaction]
          // if ('layer' in singleView) {
          //   if ('params' in commonSpec) {
          //     const { params: basicParams, ...spec } = commonSpec;
          //     commonSpec = spec;
          //     singleView.layer![0].params = [...basicParams, ...singleView.layer![0].params ?? []];
          //   }
          //   commonSpec.layer = singleView.layer;
          // } else if ('params' in singleView) {
          //   commonSpec.params = [...commonSpec.params, ...singleView.params!];
          // }
          // #[END bad-layer-interaction]

          if ('params' in singleView) {
            commonSpec.params = [...commonSpec.params, ...singleView.params!];
          }
          const ans = { ...commonSpec, ...singleView }
          if ('params' in commonSpec) {
            ans.params = commonSpec.params;
          }
          if (node) {
            embed(node, ans, { mode: 'vega-lite', actions: showActions, timeFormatLocale: getVegaTimeFormatRules(i18n.language) }).then(res => {
              vegaRefs.current.push(res.view);
              const paramStores = (res.vgSpec.data?.map(d => d.name) ?? []).filter(
                name => [BRUSH_SIGNAL_NAME, POINT_SIGNAL_NAME].map(p => `${p}_store`).includes(name)
              ).map(name => name.replace(/_store$/, ''));
              try {
                for (const param of paramStores) {
                  let noBroadcasting = false;
                  // 发出
                  res.view.addSignalListener(param, name => {
                    if (noBroadcasting) {
                      noBroadcasting = false;
                      return;
                    }
                    if ([BRUSH_SIGNAL_NAME, POINT_SIGNAL_NAME].includes(name)) {
                      const data = res.view.getState().data?.[`${name}_store`];
                      if (!data || (Array.isArray(data) && data.length === 0)) {
                        setCrossFilterTriggerIdx(-1);
                      }
                      combinedParamStore$.next({
                        signal: name as typeof BRUSH_SIGNAL_NAME | typeof POINT_SIGNAL_NAME,
                        source: sourceId,
                        data: data ?? null,
                      });
                    }
                  });
                  subscribe(entry => {
                    if (entry.source === sourceId || !entry.data) {
                      return;
                    }
                    noBroadcasting = true;
                    res.view.setState({
                      data: {
                        [`${entry.signal}_store`]: entry.data,
                      },
                    });
                  });
                }
              } catch (error) {
                console.warn('Crossing filter failed', error);
              }
              try {
                res.view.addEventListener('mouseover', () => {
                  if (sourceId !== crossFilterTriggerIdx) {
                    setCrossFilterTriggerIdx(sourceId);
                  }
                });
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
      return () => {
        subscriptions.forEach(sub => sub.unsubscribe());
      };
    }
  }, [
    dataSource,
    allFieldIds,
    rows,
    columns,
    defaultAggregate,
    geomType,
    color,
    opacity,
    size,
    shape,
    theta, radius,
    viewPlaceholders,
    rowFacetFields,
    colFacetFields,
    rowRepeatFields,
    colRepeatFields,
    stack,
    showActions,
    interactiveScale,
    layoutMode,
    width,
    height,
    selectEncoding,
    brushEncoding,
    crossFilterTriggerIdx,
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

  return <CanvaContainer rowSize={Math.max(rowRepeatFields.length, 1)} colSize={Math.max(colRepeatFields.length, 1)}>
    {/* <div ref={container}></div> */}
    {
      viewPlaceholders.map((view, i) => <div key={i} ref={view}></div>)
    }
  </CanvaContainer>
});

export default ReactVega;
