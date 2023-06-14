import React, { useEffect, useState, useMemo, forwardRef, useImperativeHandle, useRef, createRef } from 'react';
import embed from 'vega-embed';
import { Subject } from 'rxjs'
import * as op from 'rxjs/operators';
import type { ScenegraphEvent, View } from 'vega';
import styled from 'styled-components';
import { nanoid } from 'nanoid';

import { IViewField, IRow, IDarkMode, IThemeKey, IVisualConfig } from '../interfaces';
import { useTranslation } from 'react-i18next';
import { getVegaTimeFormatRules } from './temporalFormat';
import { builtInThemes } from './theme';
import { useCurrentMediaTheme } from '../utils/media';
import { getSingleView } from './spec/view';
import { NULL_FIELD } from './spec/field';
import type { IVisEncodingChannel, IVisField, IVisSpec } from './protocol/interface';

const CanvaContainer = styled.div<{ rowSize: number; colSize: number; }>`
  display: grid;
  grid-template-columns: repeat(${props => props.colSize}, 1fr);
  grid-template-rows: repeat(${props => props.rowSize}, 1fr);
`

const SELECTION_NAME = 'geom';
export interface IVegaRendererHandler {
    getSVGData: () => Promise<string[]>;
    getCanvasData: () => Promise<string[]>;
    downloadSVG: (filename?: string) => Promise<string[]>;
    downloadPNG: (filename?: string) => Promise<string[]>;
}
interface IVegaRendererProps {
    spec: IVisSpec;
    format?: IVisualConfig['format'];
    onGeomClick?: (values: any, e: any) => void
    /** @default "vega" */
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    /** @default false */
    interactiveScale?: boolean;
    /** @default false */
    showActions?: boolean;
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
    dimensions: readonly IVisField[],
    measures: readonly IVisField[],
    ref: IVisEncodingChannel | undefined,
): IViewField => {
    if (!ref) {
        return NULL_FIELD;
    }
    const fieldKey = typeof ref === 'string' ? ref : ref.field;
    const dim = dimensions.find(d => d.key === fieldKey);
    if (dim) {
        return {
            dragId: nanoid(),
            fid: dim.key,
            name: dim.name || fieldKey,
            semanticType: dim.type,
            analyticType: 'dimension',
        };
    }
    const mea = measures.find(m => m.key === fieldKey);
    if (mea) {
        return {
            dragId: nanoid(),
            fid: mea.key,
            name: mea.name || fieldKey,
            semanticType: mea.type,
            analyticType: 'measure',
        };
    }
    return NULL_FIELD;
};


const VegaRenderer = forwardRef<IVegaRendererHandler, IVegaRendererProps>(function VegaRenderer(props, ref) {
    const {
        spec,
        format,
        onGeomClick,
        themeKey = 'vega',
        dark = 'media',
        interactiveScale = false,
        showActions = false,
    } = props;
    const { encodings, size: sizeConfig, markType } = spec;
    const [viewPlaceholders, setViewPlaceholders] = useState<React.MutableRefObject<HTMLDivElement>[]>([]);
    const { i18n } = useTranslation();
    const mediaTheme = useCurrentMediaTheme(dark);
    const themeConfig = builtInThemes[themeKey]?.[mediaTheme];

    const vegaConfig = useMemo(() => {
        const config: any = {
            ...themeConfig,
        }
        if (!format) {
            return config;
        }
        if (format.normalizedNumberFormat && format.normalizedNumberFormat.length > 0) {
            config.normalizedNumberFormat = format.normalizedNumberFormat;
        }
        if (format.numberFormat && format.numberFormat.length > 0) {
            config.numberFormat = format.numberFormat;
        }
        if (format.timeFormat && format.timeFormat.length > 0) {
            config.timeFormat = format.timeFormat;
        }
        return config;
    }, [themeConfig, format?.normalizedNumberFormat, format?.numberFormat, format?.timeFormat])

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
            const viewNum = Math.max(1, nRows * nCols);
            const nextViews = new Array(viewNum).fill(null).map((v, i) => views[i] || createRef());
            return nextViews;
        });
    }, [nRows, nCols]);

    const vegaRefs = useRef<View[]>([]);

    const dataSource = useMemo<IRow[]>(() => {
        return [];
    }, []);
    const dimensions = useMemo<IVisField[]>(() => {
        return [];
    }, []);
    const measures = useMemo<IVisField[]>(() => {
        return [];
    }, []);

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
                    fields: allFieldIds,
                },
            }],
        };
        if (interactiveScale) {
            vegaLiteSpec.params.push({
                name: "grid",
                select: "interval",
                bind: "scales"
            });
        }
        const { x, y, color, opacity, shape, size, theta, radius, text, row, column, details } = encodings;
        if (nRows <= 1 && nCols <= 1) {
            if (sizeConfig) {
                if (!row && !column) {
                    vegaLiteSpec.autosize = 'fit';
                }
                vegaLiteSpec.width = sizeConfig.width;
                vegaLiteSpec.height = sizeConfig.height;
            }
            const singleView = getSingleView({
                x: resolveViewField(dimensions, measures, Array.isArray(x) ? x[0] : x),
                y: resolveViewField(dimensions, measures, Array.isArray(y) ? y[0] : y),
                color: resolveViewField(dimensions, measures, color),
                opacity: resolveViewField(dimensions, measures, opacity),
                size: resolveViewField(dimensions, measures, size),
                shape: resolveViewField(dimensions, measures, shape),
                theta: resolveViewField(dimensions, measures, theta),
                radius: resolveViewField(dimensions, measures, radius),
                text: resolveViewField(dimensions, measures, text),
                row: resolveViewField(dimensions, measures, row),
                column: resolveViewField(dimensions, measures, column),
                xOffset: NULL_FIELD,
                yOffset: NULL_FIELD,
                details: (
                    Array.isArray(details) ? details : [details]
                ).map(f => resolveViewField(dimensions, measures, f)),
                defaultAggregated: true,
                stack: 'stack', // FIXME:
                geomType: markType,
            });

            vegaLiteSpec.mark = singleView.mark;
            if ('encoding' in singleView) {
                vegaLiteSpec.encoding = singleView.encoding;
            }

            if (viewPlaceholders.length > 0 && viewPlaceholders[0].current) {
                embed(viewPlaceholders[0].current, vegaLiteSpec, { mode: 'vega-lite', actions: showActions, timeFormatLocale: getVegaTimeFormatRules(i18n.language), config: vegaConfig }).then(res => {
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
                        x: resolveViewField(dimensions, measures, Array.isArray(x) ? x[j] : x),
                        y: resolveViewField(dimensions, measures, Array.isArray(y) ? y[i] : y),
                        color: resolveViewField(dimensions, measures, color),
                        opacity: resolveViewField(dimensions, measures, opacity),
                        size: resolveViewField(dimensions, measures, size),
                        shape: resolveViewField(dimensions, measures, shape),
                        theta: resolveViewField(dimensions, measures, theta),
                        radius: resolveViewField(dimensions, measures, radius),
                        row: resolveViewField(dimensions, measures, row),
                        column: resolveViewField(dimensions, measures, column),
                        text: resolveViewField(dimensions, measures, text),
                        xOffset: NULL_FIELD,
                        yOffset: NULL_FIELD,
                        details: (
                            Array.isArray(details) ? details : [details]
                        ).map(f => resolveViewField(dimensions, measures, f)),
                        defaultAggregated: true,
                        stack: 'stack', // FIXME:
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
                        embed(node, ans, { mode: 'vega-lite', actions: showActions, timeFormatLocale: getVegaTimeFormatRules(i18n.language), config: vegaConfig }).then(res => {
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
            return () => {};
        }
    }, [
        dimensions,
        measures,
        encodings,
        markType,
        vegaConfig,
        showActions,
        sizeConfig,
        nRows,
        nCols,
        viewPlaceholders,
        i18n.language,
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

export default VegaRenderer;
