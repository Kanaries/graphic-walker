import React, { useEffect, useState, useRef, useMemo, useCallback, DependencyList, useContext } from 'react';
import { observer } from 'mobx-react-lite';
import { useCompututaion, useVizStore } from '../../store';
import { calcIndexesByDimensions, calcPaintMapV2, compressBitMap, createBitMapForMap, decompressBitMap, getCircleIndexes } from '../../lib/paint';
import { fieldStat } from '../../computation';
import { useRenderer } from '../../renderer/hooks';
import { IDarkMode, IPaintDimension, IPaintMapFacet, ISemanticType, IThemeKey, IViewField, VegaGlobalConfig } from '../../interfaces';
import embed from 'vega-embed';
import { PAINT_FIELD_ID } from '../../constants';
import { Scene, SceneGroup, SceneItem, ScenegraphEvent } from 'vega-typings';
import { renderModule, sceneVisit, CanvasHandler, Item } from 'vega';
import throttle from '../../utils/throttle';
import { useTranslation } from 'react-i18next';
import { ClickInput, ColorEditor, CursorDef, PixelContainer } from './components';
import LoadingLayer from '../loadingLayer';
import { GLOBAL_CONFIG } from '../../config';
import { GWGlobalConfig, builtInThemes } from '../../vis/theme';
import { unstable_batchedUpdates } from 'react-dom';
import { autoMark } from '../../vis/spec/mark';
import { Button } from '../ui/button';
import { Dialog, DialogContent } from '../ui/dialog';
import { Slider } from '../ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { uiThemeContext, themeContext } from '@/store/theme';
import { WebGLRenderer } from 'vega-webgl-renderer';
import { parseColorToHex } from '@/utils/colors';
import { getMeaAggKey, getMeaAggName } from '@/utils';
import rbush from 'rbush';

//@ts-ignore
CanvasHandler.prototype.context = function () {
    //@ts-ignore
    return this._canvas.getContext('2d') || this._canvas._textCanvas.getContext('2d');
};

renderModule('webgl', { handler: CanvasHandler, renderer: WebGLRenderer });

const MAGIC_PADDING = 5;
const PIXEL_INDEX = '_gw_pixel_index';
const ERASER = 255;

const MouseButtons = {
    PRIMARY: 1,
    SECONDARY: 2,
    WHELL: 4,
    BACK: 8,
    FORWARD: 16,
};

const scheme = ['#4c78a8', '#f58518', '#e45756', '#72b7b2', '#54a24b', '#eeca3b', '#b279a2', '#ff9da6', '#9d755d', '#bab0ac'];

const defaultScheme = Object.fromEntries(scheme.map((color, i) => [i + 1, { name: `L_${i + 1}`, color }]));

const emptyField = [];

function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList, initial?: T) {
    const [val, setVal] = useState<T | undefined>(initial);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let cancel = false;
        setLoading(true);
        const promise = factory();
        if (promise === undefined || promise === null) return;
        promise.then((val) => {
            if (!cancel) {
                setLoading(false);
                setVal(val);
            }
        });
        return () => {
            cancel = true;
        };
    }, deps);
    return [val, loading];
}

function selectInteractive(scene: { root: Scene }) {
    const selected: (Scene | SceneGroup)[] = [];
    let index = 0;
    function visit(item) {
        if (item.interactive === false) return;
        item._ig_start = index;
        if (item.items)
            for (let i of item.items) {
                visit(i);
            }
        item._ig_end = index;
        if (item.interactive === true && item._ig_start === item._ig_end) {
            selected.push(item);
            ++index;
            ++item._ig_end;
        }
    }
    visit(scene.root);
    return selected;
}

const getFactor = (f: IPaintDimension) =>
    f.domain.type === 'nominal' ? (GLOBAL_CONFIG.PAINT_SIZE_FACTOR * GLOBAL_CONFIG.PAINT_MAP_SIZE) / f.domain.width : GLOBAL_CONFIG.PAINT_SIZE_FACTOR;

function getMarkForAgg(types: ISemanticType[]) {
    if (types.every((x) => x === 'quantitative')) {
        return 'circle';
    }
    if (types.find((x) => x === 'quantitative')) {
        return 'bar';
    }
    return 'square';
}

function getMarkFor(types: ISemanticType[]) {
    if (types.every((x) => x === 'quantitative')) {
        return 'circle';
    }
    if (types.find((x) => x === 'quantitative')) {
        return 'tick';
    }
    return 'square';
}

type Dimension = {
    field: IViewField;
    domain?: IPaintDimension;
};

const aggMarkWhitelist = ['circle', 'bar'];

const getDomainType = (type: ISemanticType) => (type === 'quantitative' ? 'quantitative' : 'nominal');

const deduper = function <T>(items: T[], keyF: (k: T) => string) {
    const map = new Map<string, T>();
    items.forEach((x) => map.set(keyF(x), x));
    return [...map.values()];
};

const getAggDimensionFields = (fields: {
    x: IViewField;
    y: IViewField;
    color?: IViewField;
    size?: IViewField;
    opacity?: IViewField;
    shape?: IViewField;
}): IViewField[] => {
    return deduper(
        [fields.x, fields.y, fields.color, fields.size, fields.opacity, fields.shape]
            .filter((x): x is IViewField => !!x)
            .filter((x) => x!.analyticType === 'dimension'),
        (x) => x.fid
    );
};

const produceChannel = (
    channel: IViewField,
    domain: IPaintDimension,
    options?: {
        reverseNominalDomain?: boolean;
    }
) => {
    if (domain.domain.value.every((x) => x instanceof Array)) {
        return {
            field: `${channel.fid}[0]`,
            title: channel.name,
            type: domain.domain.type,
            axis: { labelOverlap: true },
            scale: {
                domain:
                    domain.domain.type === 'nominal' && options?.reverseNominalDomain
                        ? domain.domain.value.toReversed().map((x) => x[0])
                        : domain.domain.value.map((x) => x[0]),
            },
        };
    }
    return {
        field: channel.fid,
        title: channel.name,
        type: domain.domain.type,
        axis: { labelOverlap: true },
        scale: { domain: domain.domain.type === 'nominal' && options?.reverseNominalDomain ? domain.domain.value.toReversed() : domain.domain.value },
    };
};

const produceAggChannel = (
    channel: IViewField,
    domain?: IPaintDimension,
    options?: {
        reverseNominalDomain?: boolean;
        aggregate?: boolean;
    }
) => {
    if (domain?.domain.value.every((x) => x instanceof Array)) {
        return {
            field: `${channel.fid}[0]`,
            title: channel.name,
            type: getDomainType(channel.semanticType),
            axis: { labelOverlap: true },
            scale: domain
                ? {
                      domain:
                          domain.domain.type === 'nominal' && options?.reverseNominalDomain
                              ? domain.domain.value.toReversed().map((x) => x[0])
                              : domain.domain.value.map((x) => x[0]),
                  }
                : undefined,
            aggregate: options?.aggregate && channel.analyticType === 'measure',
        };
    }
    return {
        field: channel.fid,
        title: channel.name,
        type: getDomainType(channel.semanticType),
        axis: { labelOverlap: true },
        scale: domain
            ? { domain: domain.domain.type === 'nominal' && options?.reverseNominalDomain ? domain.domain.value.toReversed() : domain.domain.value }
            : undefined,
        aggregate: options?.aggregate && channel.analyticType === 'measure',
    };
};

const AggPainterContent = (props: {
    mark: string;
    x: Dimension;
    y: Dimension;
    color?: Dimension;
    size?: Dimension;
    opacity?: Dimension;
    shape?: Dimension;
    facets: IPaintMapFacet[];
    vegaConfig: VegaGlobalConfig;
    dict: typeof defaultScheme;
    onChangeDict: (d: typeof defaultScheme) => void;
    paintMapRef: React.MutableRefObject<Uint8Array | undefined>;
    allFields: IViewField[];
    displayOffset?: number;
    onReset: () => void;
    onDelete: () => void;
    onCancel: () => void;
    onSave: () => void;
}) => {
    const { t } = useTranslation();
    const mediaTheme = useContext(themeContext);
    const computation = useCompututaion();
    const fields = useMemo(
        () => [props.x, props.y, props.color, props.size, props.opacity, props.shape].filter((x) => x).map((x) => x!.field),
        [props.x, props.y, props.color, props.size, props.opacity, props.shape]
    );
    const [viewDimensions, viewMeasures] = useMemo(() => {
        const totalFields = deduper(
            fields.concat(
                props.facets.flatMap((x) =>
                    x.dimensions.map((d) => ({
                        fid: d.fid,
                        name: d.fid,
                        semanticType: d.domain.type,
                        analyticType: d.domain.type === 'nominal' ? 'dimension' : 'measure',
                    }))
                )
            ),
            (x) => x.fid
        );
        return [totalFields.filter((x) => x.analyticType === 'dimension'), fields.filter((x) => x.analyticType === 'measure')];
    }, [fields, props.facets]);
    const paintDimensions = useMemo(() => {
        return deduper(
            [props.x, props.y, props.color, props.size, props.opacity, props.shape].filter((x) => x).filter((x) => x!.domain),
            (x) => x!.field.fid
        ).map((x) => x!.domain!);
    }, []);
    const brushSizeRef = useRef(GLOBAL_CONFIG.PAINT_DEFAULT_BRUSH_SIZE);
    const [brushSize, setBrushSize] = useState(GLOBAL_CONFIG.PAINT_DEFAULT_BRUSH_SIZE);
    brushSizeRef.current = brushSize;
    const brushIdRef = useRef(2);
    const [brushId, setBrushId] = useState(2);
    brushIdRef.current = brushId;
    const containerRef = useRef<HTMLDivElement>(null);
    const { loading: loadingData, viewData } = useRenderer({
        computationFunction: computation,
        defaultAggregated: true,
        filters: emptyField,
        allFields: props.allFields,
        limit: -1,
        sort: 'none',
        viewDimensions,
        viewMeasures,
        timezoneDisplayOffset: props.displayOffset,
    });
    const indexes = useMemo(() => viewData.map(calcIndexesByDimensions(paintDimensions)), [viewData, paintDimensions]);
    const [data, loadingResult] = useAsyncMemo(async () => {
        const facetResult = await calcPaintMapV2(viewData, { dict: props.dict, facets: props.facets, usedColor: [] });
        return viewData.map((x, i) => {
            const pid = props.paintMapRef.current![indexes[i]];
            return {
                ...x,
                [PAINT_FIELD_ID]: pid === 0 ? facetResult[i] ?? props.dict[1].name : props.dict[pid]?.name,
                [PIXEL_INDEX]: indexes[i],
            };
        });
    }, [indexes, viewData, props.dict, props.facets]);

    const [pixelOffset, setPixelOffset] = useState([0, 0]);

    const resetRef = useRef(() => {});

    const loading = loadingData || loadingResult;

    useEffect(() => {
        if (!loading && containerRef.current) {
            const fallbackMark = getMarkForAgg([getDomainType(props.y.field.semanticType), getDomainType(props.x.field.semanticType)]);
            const mark = props.mark === 'auto' ? autoMark([props.x.field.semanticType, props.y.field.semanticType]) : props.mark;
            const colors = Object.entries(props.dict);
            const finalMark = aggMarkWhitelist.includes(mark) ? mark : fallbackMark;
            const spec: any = {
                data: {
                    name: 'data',
                    values: data,
                },
                mark: { type: finalMark, fillOpacity: 0.66, strokeWidth: 4, strokeOpacity: 1, size: finalMark === 'circle' ? 600 : undefined },
                encoding: {
                    x: produceAggChannel(props.x.field, props.x.domain, { aggregate: true }),
                    y: produceAggChannel(props.y.field, props.y.domain, { reverseNominalDomain: true, aggregate: true }),
                    fill: {
                        field: PAINT_FIELD_ID,
                        type: 'nominal',
                        title: 'custom feature',
                        scale: {
                            domain: colors.map(([_, x]) => x.name),
                            range: colors.map(([_, x]) => x.color),
                        },
                    },
                    stroke: props.color ? produceAggChannel(props.color.field, props.color.domain) : undefined,
                    opacity: props.opacity ? produceAggChannel(props.opacity.field, props.opacity.domain) : undefined,
                    size: props.size ? produceAggChannel(props.size.field, props.size.domain) : undefined,
                    shape: props.shape ? produceAggChannel(props.shape.field, props.shape.domain) : undefined,
                },
                width: GLOBAL_CONFIG.PAINT_MAP_SIZE * GLOBAL_CONFIG.PAINT_SIZE_FACTOR,
                height: GLOBAL_CONFIG.PAINT_MAP_SIZE * GLOBAL_CONFIG.PAINT_SIZE_FACTOR,
            };
            Object.values(spec.encoding).forEach((c: any) => {
                if (!c) return;
                if (c.aggregate === null) return;
                const targetField = viewMeasures.find((f) => f.fid === c.field);
                if (targetField) {
                    c.title = getMeaAggName(targetField.name, targetField.aggName);
                    c.field = getMeaAggKey(targetField.fid, targetField.aggName);
                }
            });

            embed(containerRef.current, spec, {
                renderer: 'webgl' as any,
                config: props.vegaConfig,
                actions: false,
                tooltip: {
                    theme: mediaTheme,
                },
            }).then((res) => {
                const scene = res.view.scenegraph() as unknown as { root: Scene };
                const origin = res.view.origin();
                setPixelOffset([origin[0] + MAGIC_PADDING, origin[1] + MAGIC_PADDING]);
                const itemsMap: Map<number, SceneItem[]> = new Map();
                const interactive = selectInteractive(scene);
                const tree = new rbush<{ id: number; minX: number; minY: number; maxX: number; maxY: number }>();
                interactive.forEach((item) =>
                    sceneVisit(item, (item) => {
                        if ('datum' in item) {
                            const id = item.datum![PIXEL_INDEX];
                            if (!itemsMap.has(id)) {
                                itemsMap.set(id, []);
                            }
                            itemsMap.get(id)?.push(item);
                            item.bounds && tree.insert({ minX: item.bounds.x1, minY: item.bounds.y1, maxX: item.bounds.x2, maxY: item.bounds.y2, id });
                        }
                    })
                );
                //@ts-ignore
                const rerender = throttle(() => res.view._renderer._render(scene.root), 15, { trailing: true });
                resetRef.current = () => {
                    props.onReset();
                    props.paintMapRef.current! = createBitMapForMap(paintDimensions);
                    const { name, color } = props.dict[1];
                    interactive.forEach((item) =>
                        sceneVisit(item, (item) => {
                            if ('datum' in item) {
                                item['fill'] = color;
                                item.datum![PAINT_FIELD_ID] = name;
                            }
                        })
                    );
                    rerender();
                };
                const handleDraw = (e: ScenegraphEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const paint = (x: number, y: number) => {
                        const targetColor =
                            brushIdRef.current === ERASER
                                ? {
                                      name: '',
                                      color: 'transparent',
                                  }
                                : props.dict[brushIdRef.current];
                        if (!targetColor) return;
                        const pts = tree
                            .search({
                                minX: x - brushSizeRef.current,
                                minY: y - brushSizeRef.current,
                                maxX: x + brushSizeRef.current,
                                maxY: y + brushSizeRef.current,
                            })
                            .map((i) => i.id);

                        let i = 0;
                        pts.forEach((x) => {
                            itemsMap.get(x)?.forEach((item) => {
                                item['fill'] = targetColor.color;
                                item.datum![PAINT_FIELD_ID] = targetColor.name;
                                i++;
                            });
                            props.paintMapRef.current![x] = brushIdRef.current;
                        });
                        i > 0 && rerender();
                    };
                    if (e instanceof MouseEvent && e.buttons & MouseButtons.PRIMARY) {
                        paint(e.offsetX - origin[0] - MAGIC_PADDING, e.offsetY - origin[1] - MAGIC_PADDING);
                    } else if (window.TouchEvent && e instanceof TouchEvent) {
                        const rect = containerRef.current!.getBoundingClientRect();
                        paint(
                            e.changedTouches[0].pageX - rect.left - origin[0] - MAGIC_PADDING,
                            e.changedTouches[0].pageY - rect.top - origin[1] - MAGIC_PADDING
                        );
                    }
                };
                res.view.addEventListener('mousedown', handleDraw);
                res.view.addEventListener('mousemove', handleDraw);
                res.view.addEventListener('touchstart', handleDraw);
                res.view.addEventListener('touchmove', handleDraw);
            });
        }
    }, [loading, data, props.dict, props.vegaConfig, paintDimensions, props.onReset, props.mark]);

    const [showCursorPreview, setShowCursorPreview] = React.useState(false);

    const cursor = useMemo((): CursorDef => {
        return { type: 'rect', x: brushSize, y: brushSize, xFactor: GLOBAL_CONFIG.PAINT_SIZE_FACTOR, yFactor: GLOBAL_CONFIG.PAINT_SIZE_FACTOR };
    }, [brushSize]);

    useEffect(() => {
        setShowCursorPreview(true);
        const timer = setTimeout(() => {
            setShowCursorPreview(false);
        }, 1_000);

        return () => {
            clearTimeout(timer);
        };
    }, [brushSize, brushId]);

    return (
        <div className="flex">
            <PixelContainer
                color={props.dict[brushId]?.color ?? '#333'}
                cursor={cursor}
                offsetX={pixelOffset[0]}
                offsetY={pixelOffset[1]}
                showPreview={showCursorPreview}
            >
                <div ref={containerRef} id="painter-container" className="!cursor-none min-w-[600px] min-h-[512px]"></div>
            </PixelContainer>
            <div className="flex flex-col space-y-2 pt-10 w-40 flex-shrink-0 px-1">
                <Tabs
                    value={brushId === ERASER ? 'eraser' : 'palette'}
                    onValueChange={(v) => {
                        if (v === 'palette') {
                            setBrushId(2);
                        } else {
                            setBrushId(ERASER);
                        }
                    }}
                >
                    <TabsList>
                        <TabsTrigger value="palette"> {t('main.tabpanel.settings.paint.palette')}</TabsTrigger>
                        <TabsTrigger value="eraser"> {t('main.tabpanel.settings.paint.eraser')}</TabsTrigger>
                    </TabsList>
                    {brushId !== ERASER && (
                        <TabsContent value="palette">
                            <div className="grid grid-cols-5 gap-2 p-2">
                                {Object.entries(props.dict).map(([id, { color }]) => (
                                    <div
                                        key={id}
                                        className={`box-border rounded-full border-primary hover: ${
                                            id === `${brushId}` ? 'border-2' : 'hover:border-2'
                                        } active:ring-ring active:ring-1 w-4 h-4`}
                                        style={{
                                            background: color,
                                        }}
                                        onClick={() => setBrushId(Number(id))}
                                    ></div>
                                ))}
                            </div>
                            <div className="flex space-x-2">
                                <label className="block text-xs font-medium">{t('main.tabpanel.settings.paint.color')}</label>
                                <ColorEditor
                                    color={props.dict[brushId].color}
                                    colors={scheme}
                                    onChangeColor={(color) => {
                                        props.onChangeDict({
                                            ...props.dict,
                                            [brushId]: {
                                                color,
                                                name: props.dict[brushId].name,
                                            },
                                        });
                                    }}
                                />
                            </div>
                            <div className="flex flex-col space-y-2">
                                <label className="block text-xs font-medium">{t('main.tabpanel.settings.paint.label')}</label>
                                <ClickInput
                                    value={props.dict[brushId].name}
                                    onChange={(name) => {
                                        props.onChangeDict({
                                            ...props.dict,
                                            [brushId]: {
                                                color: props.dict[brushId].color,
                                                name,
                                            },
                                        });
                                    }}
                                />
                            </div>
                        </TabsContent>
                    )}
                </Tabs>
                <div className="pt-2">
                    <output className="text-sm">
                        {t('main.tabpanel.settings.paint.brush_size')}: {`${brushSize}`}
                    </output>
                    <Slider
                        className="mt-2"
                        value={[brushSize]}
                        min={GLOBAL_CONFIG.PAINT_MIN_BRUSH_SIZE}
                        max={GLOBAL_CONFIG.PAINT_MAX_BRUSH_SIZE}
                        onValueChange={([v]) => setBrushSize(v)}
                    />
                </div>
                <div className="flex-1 flex flex-col space-y-2 justify-end">
                    <Button variant="destructive" children={t('main.tabpanel.settings.paint.delete_paint')} onClick={props.onDelete} />
                    <Button variant="outline" children={t('main.tabpanel.settings.paint.reset_paint')} onClick={() => resetRef.current()} />
                    <Button variant="outline" children={t('main.tabpanel.settings.paint.cancel')} onClick={props.onCancel} />
                    <Button children={t('main.tabpanel.settings.paint.save_paint')} onClick={props.onSave} />
                </div>
            </div>
        </div>
    );
};

// TODO: add text: fetch the text channel to show
const markWhitelist = ['point', 'circle', 'tick'];

const PainterContent = (props: {
    mark: string;
    x: IViewField;
    y: IViewField;
    domainX: IPaintDimension;
    domainY: IPaintDimension;
    dict: typeof defaultScheme;
    facets: IPaintMapFacet[];
    vegaConfig: VegaGlobalConfig;
    onChangeDict: (d: typeof defaultScheme) => void;
    paintMapRef: React.MutableRefObject<Uint8Array | undefined>;
    allFields: IViewField[];
    displayOffset?: number;
    onReset: () => void;
    onDelete: () => void;
    onCancel: () => void;
    onSave: () => void;
}) => {
    const { t } = useTranslation();
    const mediaTheme = useContext(themeContext);
    const computation = useCompututaion();
    const fields = useMemo(
        () =>
            deduper(
                [
                    {
                        ...props.x,
                        analyticType: 'measure' as const,
                    },
                    {
                        ...props.y,
                        analyticType: 'measure' as const,
                    },
                ].concat(
                    props.facets.flatMap((x) =>
                        x.dimensions.map((d) => ({ fid: d.fid, name: d.fid, semanticType: d.domain.type, analyticType: 'measure' as const }))
                    )
                ),
                (x) => x.fid
            ),
        [props.x, props.y]
    );
    const brushSizeRef = useRef(GLOBAL_CONFIG.PAINT_DEFAULT_BRUSH_SIZE);
    const [brushSize, setBrushSize] = useState(GLOBAL_CONFIG.PAINT_DEFAULT_BRUSH_SIZE);
    brushSizeRef.current = brushSize;
    const brushIdRef = useRef(2);
    const [brushId, setBrushId] = useState(2);
    brushIdRef.current = brushId;
    const containerRef = useRef<HTMLDivElement>(null);
    const { loading: loadingData, viewData } = useRenderer({
        computationFunction: computation,
        defaultAggregated: false,
        filters: emptyField,
        allFields: props.allFields,
        limit: -1,
        sort: 'none',
        viewDimensions: emptyField,
        viewMeasures: fields,
        timezoneDisplayOffset: props.displayOffset,
    });
    const indexes = useMemo(() => viewData.map(calcIndexesByDimensions([props.domainY, props.domainX])), [viewData, props.domainX, props.domainY]);
    const [data, loadingResult] = useAsyncMemo(async () => {
        const facetResult = await calcPaintMapV2(viewData, { dict: props.dict, facets: props.facets, usedColor: [] });
        return viewData.map((x, i) => {
            const pid = props.paintMapRef.current![indexes[i]];
            return {
                ...x,
                [PAINT_FIELD_ID]: pid === 0 ? facetResult[i] : props.dict[pid]?.name,
                [PIXEL_INDEX]: indexes[i],
            };
        });
    }, [indexes, viewData, props.dict, props.facets]);

    const [pixelOffset, setPixelOffset] = useState([0, 0]);

    const resetRef = useRef(() => {});

    const loading = loadingData || loadingResult;

    useEffect(() => {
        if (!loading && containerRef.current) {
            const fallbackMark = getMarkFor([props.domainY.domain.type, props.domainX.domain.type]);
            const mark = props.mark === 'auto' ? autoMark([props.x.semanticType, props.y.semanticType]) : props.mark;
            const colors = Object.entries(props.dict);
            const spec: any = {
                data: {
                    name: 'data',
                    values: data,
                },
                mark: { type: markWhitelist.includes(mark) ? mark : fallbackMark, opacity: 0.66 },
                encoding: {
                    x: produceChannel(props.x, props.domainX),
                    y: produceChannel(props.y, props.domainY, { reverseNominalDomain: true }),
                    color: {
                        field: PAINT_FIELD_ID,
                        type: 'nominal',
                        title: 'custom feature',
                        scale: {
                            domain: colors.map(([_, x]) => x.name),
                            range: colors.map(([_, x]) => x.color),
                        },
                    },
                },
                width: GLOBAL_CONFIG.PAINT_MAP_SIZE * GLOBAL_CONFIG.PAINT_SIZE_FACTOR,
                height: GLOBAL_CONFIG.PAINT_MAP_SIZE * GLOBAL_CONFIG.PAINT_SIZE_FACTOR,
            };
            embed(containerRef.current, spec, {
                renderer: 'webgl' as any,
                config: props.vegaConfig,
                actions: false,
                tooltip: {
                    theme: mediaTheme,
                },
            }).then((res) => {
                const scene = res.view.scenegraph() as unknown as { root: Scene };
                const origin = res.view.origin();
                setPixelOffset([origin[0] + MAGIC_PADDING, origin[1] + MAGIC_PADDING]);
                const itemsMap: Map<number, SceneItem[]> = new Map();
                const interactive = selectInteractive(scene);
                interactive.forEach((item) =>
                    sceneVisit(item, (item) => {
                        if ('datum' in item) {
                            const id = item.datum![PIXEL_INDEX];
                            if (!itemsMap.has(id)) {
                                itemsMap.set(id, []);
                            }
                            itemsMap.get(id)?.push(item);
                        }
                    })
                );
                //@ts-ignore
                const rerender = throttle(() => res.view._renderer._render(scene.root), 15, { trailing: true });
                resetRef.current = () => {
                    props.onReset();
                    props.paintMapRef.current! = createBitMapForMap([props.domainY, props.domainX]);
                    const { name, color } = props.dict[1];
                    interactive.forEach((item) =>
                        sceneVisit(item, (item) => {
                            if ('datum' in item) {
                                item['fill'] && item['fill'] !== 'transparent' && (item['fill'] = color);
                                item['stroke'] && item['stroke'] !== 'transparent' && (item['stroke'] = color);
                                item.datum![PAINT_FIELD_ID] = name;
                            }
                        })
                    );
                    rerender();
                };
                const handleDraw = (e: ScenegraphEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const paint = (x: number, y: number) => {
                        const targetColor =
                            brushIdRef.current === ERASER
                                ? {
                                      name: '',
                                      color: 'transparent',
                                  }
                                : props.dict[brushIdRef.current];
                        if (!targetColor) return;
                        const pts = getCircleIndexes(
                            [Math.floor(x / getFactor(props.domainX)), props.domainY.domain.width - 1 - Math.floor(y / getFactor(props.domainY))],
                            brushSizeRef.current,
                            [props.domainY, props.domainX]
                        );
                        let i = 0;
                        pts.forEach((x) => {
                            itemsMap.get(x)?.forEach((item) => {
                                switch (item['ariaRoleDescription']) {
                                    case 'circle':
                                    case 'square':
                                    case 'tick':
                                        item['fill'] = targetColor.color;
                                        break;
                                    case 'point':
                                        item['stroke'] = targetColor.color;
                                        break;
                                }
                                item.datum![PAINT_FIELD_ID] = targetColor.name;
                                i++;
                            });
                            props.paintMapRef.current![x] = brushIdRef.current;
                        });
                        i > 0 && rerender();
                    };
                    if (e instanceof MouseEvent && e.buttons & MouseButtons.PRIMARY) {
                        paint(e.offsetX - origin[0] - MAGIC_PADDING, e.offsetY - origin[1] - MAGIC_PADDING);
                    } else if (window.TouchEvent && e instanceof TouchEvent) {
                        const rect = containerRef.current!.getBoundingClientRect();
                        paint(
                            e.changedTouches[0].pageX - rect.left - origin[0] - MAGIC_PADDING,
                            e.changedTouches[0].pageY - rect.top - origin[1] - MAGIC_PADDING
                        );
                    }
                };
                res.view.addEventListener('mousedown', handleDraw);
                res.view.addEventListener('mousemove', handleDraw);
                res.view.addEventListener('touchstart', handleDraw);
                res.view.addEventListener('touchmove', handleDraw);
            });
        }
    }, [loading, data, props.dict, props.vegaConfig, props.domainX, props.domainY, props.onReset, props.mark]);

    const [showCursorPreview, setShowCursorPreview] = React.useState(false);

    const cursor = useMemo((): CursorDef => {
        if (props.domainX.domain.type === 'quantitative' && props.domainY.domain.type === 'quantitative') {
            return { dia: brushSize, factor: GLOBAL_CONFIG.PAINT_SIZE_FACTOR, type: 'circle' };
        }
        return {
            type: 'rect',
            x: props.domainX.domain.type === 'nominal' ? 1 : brushSize,
            xFactor:
                props.domainX.domain.type === 'nominal'
                    ? (GLOBAL_CONFIG.PAINT_SIZE_FACTOR * GLOBAL_CONFIG.PAINT_MAP_SIZE) / props.domainX.domain.width
                    : GLOBAL_CONFIG.PAINT_SIZE_FACTOR,
            y: props.domainY.domain.type === 'nominal' ? 1 : brushSize,
            yFactor:
                props.domainY.domain.type === 'nominal'
                    ? (GLOBAL_CONFIG.PAINT_SIZE_FACTOR * GLOBAL_CONFIG.PAINT_MAP_SIZE) / props.domainY.domain.width
                    : GLOBAL_CONFIG.PAINT_SIZE_FACTOR,
        };
    }, [props.domainX, props.domainY, brushSize]);

    useEffect(() => {
        setShowCursorPreview(true);
        const timer = setTimeout(() => {
            setShowCursorPreview(false);
        }, 1_000);

        return () => {
            clearTimeout(timer);
        };
    }, [brushSize, brushId]);

    return (
        <div className="flex">
            <PixelContainer
                color={props.dict[brushId]?.color ?? '#333'}
                cursor={cursor}
                offsetX={pixelOffset[0]}
                offsetY={pixelOffset[1]}
                showPreview={showCursorPreview}
            >
                <div ref={containerRef} id="painter-container" className="!cursor-none min-w-[600px] min-h-[512px]"></div>
            </PixelContainer>
            <div className="flex flex-col space-y-2 pt-10 w-40 flex-shrink-0 px-1">
                <Tabs
                    value={brushId === ERASER ? 'eraser' : 'palette'}
                    onValueChange={(v) => {
                        if (v === 'palette') {
                            setBrushId(2);
                        } else {
                            setBrushId(ERASER);
                        }
                    }}
                >
                    <TabsList>
                        <TabsTrigger value="palette"> {t('main.tabpanel.settings.paint.palette')}</TabsTrigger>
                        <TabsTrigger value="eraser"> {t('main.tabpanel.settings.paint.eraser')}</TabsTrigger>
                    </TabsList>
                    {brushId !== ERASER && (
                        <TabsContent value="palette">
                            <div className="grid grid-cols-5 gap-2 p-2">
                                {Object.entries(props.dict).map(([id, { color }]) => (
                                    <div
                                        key={id}
                                        className={`box-border rounded-full border-primary hover: ${
                                            id === `${brushId}` ? 'border-2' : 'hover:border-2'
                                        } active:ring-ring active:ring-1 w-4 h-4`}
                                        style={{
                                            background: color,
                                        }}
                                        onClick={() => setBrushId(Number(id))}
                                    ></div>
                                ))}
                            </div>
                            <div className="flex space-x-2">
                                <label className="block text-xs font-medium">{t('main.tabpanel.settings.paint.color')}</label>
                                <ColorEditor
                                    color={props.dict[brushId].color}
                                    colors={scheme}
                                    onChangeColor={(color) => {
                                        props.onChangeDict({
                                            ...props.dict,
                                            [brushId]: {
                                                color,
                                                name: props.dict[brushId].name,
                                            },
                                        });
                                    }}
                                />
                            </div>
                            <div className="flex flex-col space-y-2">
                                <label className="block text-xs font-medium">{t('main.tabpanel.settings.paint.label')}</label>
                                <ClickInput
                                    value={props.dict[brushId].name}
                                    onChange={(name) => {
                                        props.onChangeDict({
                                            ...props.dict,
                                            [brushId]: {
                                                color: props.dict[brushId].color,
                                                name,
                                            },
                                        });
                                    }}
                                />
                            </div>
                        </TabsContent>
                    )}
                </Tabs>
                {(props.domainX.domain.type === 'quantitative' || props.domainY.domain.type === 'quantitative') && (
                    <div className="pt-2">
                        <output className="text-sm">
                            {t('main.tabpanel.settings.paint.brush_size')}: {`${brushSize}`}
                        </output>
                        <Slider
                            className="mt-2"
                            value={[brushSize]}
                            min={GLOBAL_CONFIG.PAINT_MIN_BRUSH_SIZE}
                            max={GLOBAL_CONFIG.PAINT_MAX_BRUSH_SIZE}
                            onValueChange={([v]) => setBrushSize(v)}
                        />
                    </div>
                )}
                <div className="flex-1 flex flex-col space-y-2 justify-end">
                    <Button variant="destructive" children={t('main.tabpanel.settings.paint.delete_paint')} onClick={props.onDelete} />
                    <Button variant="outline" children={t('main.tabpanel.settings.paint.reset_paint')} onClick={() => resetRef.current()} />
                    <Button variant="outline" children={t('main.tabpanel.settings.paint.cancel')} onClick={props.onCancel} />
                    <Button children={t('main.tabpanel.settings.paint.save_paint')} onClick={props.onSave} />
                </div>
            </div>
        </div>
    );
};

function isZeroscaled([min, max]: [number, number]) {
    return (min < 0 && max > 0) || min === 0 || max === 0;
}

function isDomainZeroscaledAs(domain: IPaintDimension['domain'] | undefined, exceptedZeroscale: boolean) {
    if (!domain) return false;
    if (domain.type === 'nominal') return true;
    return isZeroscaled(domain.value) === exceptedZeroscale;
}

function toZeroscaled([min, max]: [number, number]): [number, number] {
    if (min > 0) {
        return [0, max];
    }
    if (max < 0) {
        return [min, 0];
    }
    return [min, max];
}

const Painter = ({ themeConfig, themeKey }: { themeConfig?: GWGlobalConfig; themeKey?: IThemeKey }) => {
    const vizStore = useVizStore();
    const { showPainterPanel, allFields, layout, config } = vizStore;
    const { geoms, timezoneDisplayOffset } = config;
    const { zeroScale } = layout;
    const { t } = useTranslation();
    const compuation = useCompututaion();

    const [loading, setLoading] = useState(true);
    const paintMapRef = useRef<Uint8Array>();
    const [dict, setDict] = useState(defaultScheme);
    const [aggInfo, setAggInfo] = useState<{
        x: Dimension;
        y: Dimension;
        color?: Dimension;
        size?: Dimension;
        opacity?: Dimension;
        shape?: Dimension;
    } | null>(null);
    const [fieldX, setX] = useState<IViewField>();
    const [fieldY, setY] = useState<IViewField>();
    const [domainX, setDomainX] = useState<IPaintDimension>();
    const [domainY, setDomainY] = useState<IPaintDimension>();
    const [facets, setFacets] = useState<IPaintMapFacet[]>([]);

    useEffect(() => {
        if (showPainterPanel) {
            setLoading(true);
            (async () => {
                const { paintInfo, allFields } = vizStore;
                const getDomain = async (f: IViewField): Promise<IPaintDimension> => {
                    if (f.semanticType === 'quantitative') {
                        const res = await fieldStat(compuation, f, { range: true, values: false, valuesMeta: false }, allFields);
                        return {
                            domain: {
                                type: 'quantitative',
                                value: zeroScale ? toZeroscaled(res.range) : res.range,
                                width: GLOBAL_CONFIG.PAINT_MAP_SIZE,
                            },
                            fid: f.fid,
                        };
                    } else {
                        const res = await fieldStat(compuation, f, { range: false, values: true, valuesMeta: false }, allFields);
                        const value = res.values.map((x) => x.value).sort();
                        return {
                            domain: {
                                type: 'nominal',
                                value,
                                width: value.length,
                            },
                            fid: f.fid,
                        };
                    }
                };
                const getNewMap = async (paintInfo: { x: IViewField; y: IViewField }) => {
                    const [domainX, domainY] = await Promise.all([getDomain(paintInfo.x), getDomain(paintInfo.y)]);
                    return {
                        x: paintInfo.x,
                        y: paintInfo.y,
                        domainX,
                        domainY,
                        map: createBitMapForMap([domainY, domainX]),
                    };
                };
                const getNewAggMap = async (paintInfo: {
                    x: IViewField;
                    y: IViewField;
                    color?: IViewField;
                    size?: IViewField;
                    opacity?: IViewField;
                    shape?: IViewField;
                }) => {
                    const paintDimensionFields = getAggDimensionFields(paintInfo);
                    const domains = await Promise.all(paintDimensionFields.map((x) => getDomain(x!)));
                    return {
                        x: { field: paintInfo.x, domain: domains.find((x) => x.fid === paintInfo.x.fid) },
                        y: { field: paintInfo.y, domain: domains.find((x) => x.fid === paintInfo.y.fid) },
                        color: paintInfo.color ? { field: paintInfo.color, domain: domains.find((x) => x.fid === paintInfo.color!.fid) } : undefined,
                        size: paintInfo.size ? { field: paintInfo.size, domain: domains.find((x) => x.fid === paintInfo.size!.fid) } : undefined,
                        opacity: paintInfo.opacity ? { field: paintInfo.opacity, domain: domains.find((x) => x.fid === paintInfo.opacity!.fid) } : undefined,
                        shape: paintInfo.shape ? { field: paintInfo.shape, domain: domains.find((x) => x.fid === paintInfo.shape!.fid) } : undefined,
                        map: createBitMapForMap(domains),
                    };
                };
                if (paintInfo) {
                    if (paintInfo.type === 'exist') {
                        const lastFacet = paintInfo.item.facets.at(-1)!;
                        if (paintInfo.new.type === 'new') {
                            // is non-aggergated paint map
                            if (
                                lastFacet.dimensions[0]?.fid !== paintInfo.new.y.fid ||
                                lastFacet.dimensions[1]?.fid !== paintInfo.new.x.fid ||
                                !isDomainZeroscaledAs(lastFacet.dimensions[0]?.domain, zeroScale) ||
                                !isDomainZeroscaledAs(lastFacet.dimensions[1]?.domain, zeroScale)
                            ) {
                                // is not same channel, create a new facet
                                const { domainX, domainY, map } = await getNewMap(paintInfo.new);
                                // adapter for old single facet
                                if (paintInfo.item.facets[0] && !paintInfo.item.facets[0].usedColor) {
                                    paintInfo.item.facets[0].usedColor = paintInfo.item.usedColor;
                                }
                                paintMapRef.current = map;
                                unstable_batchedUpdates(() => {
                                    setDict(paintInfo.item.dict);
                                    setDomainX(domainX);
                                    setDomainY(domainY);
                                    setFacets(paintInfo.item.facets);
                                    setX(paintInfo.new.x);
                                    setY(paintInfo.new.y);
                                    setAggInfo(null);
                                    setLoading(false);
                                });
                            } else {
                                // editing the existing paint map
                                const x = lastFacet.dimensions.at(-1)?.fid;
                                const y = lastFacet.dimensions.at(-2)?.fid;
                                const xf = allFields.find((a) => a.fid === x);
                                const yf = allFields.find((a) => a.fid === y);
                                unstable_batchedUpdates(() => {
                                    setDict(paintInfo.item.dict);
                                    setDomainX(lastFacet.dimensions.at(-1));
                                    setDomainY(lastFacet.dimensions.at(-2));
                                    setFacets(paintInfo.item.facets.slice(0, -1));
                                    setX(xf);
                                    setY(yf);
                                    setAggInfo(null);
                                    setLoading(false);
                                });
                            }
                        } else if (paintInfo.new.type === 'agg') {
                            // is aggergated paint map
                            if (
                                !getAggDimensionFields(paintInfo.new).every((f, i) => {
                                    const last = lastFacet.dimensions[i];
                                    return f?.fid === last?.fid && isDomainZeroscaledAs(last?.domain, zeroScale);
                                })
                            ) {
                                // is not same channel, create a new facet
                                const { map, ...info } = await getNewAggMap(paintInfo.new);
                                paintMapRef.current = map;
                                unstable_batchedUpdates(() => {
                                    setDict(defaultScheme);
                                    setAggInfo(info);
                                    setFacets(paintInfo.item.facets);
                                    setDomainX(undefined);
                                    setDomainY(undefined);
                                    setX(undefined);
                                    setY(undefined);
                                    setLoading(false);
                                });
                            } else {
                                // editing the existing aggergated paint map
                                paintMapRef.current = await decompressBitMap(lastFacet.map);
                                const { map, ...info } = await getNewAggMap(paintInfo.new);

                                unstable_batchedUpdates(() => {
                                    setDict(paintInfo.item.dict);
                                    setAggInfo(info);
                                    setFacets(paintInfo.item.facets.slice(0, -1));
                                    setDomainX(undefined);
                                    setDomainY(undefined);
                                    setX(undefined);
                                    setY(undefined);
                                    setLoading(false);
                                });
                            }
                        } else {
                            throw new Error('paintInfo.new.type is not supported');
                        }
                    } else if (paintInfo.type === 'new') {
                        const { domainX, domainY, map } = await getNewMap(paintInfo);
                        paintMapRef.current = map;
                        unstable_batchedUpdates(() => {
                            setDict(defaultScheme);
                            setDomainX(domainX);
                            setDomainY(domainY);
                            setX(paintInfo.x);
                            setY(paintInfo.y);
                            setAggInfo(null);
                            setFacets([]);
                            setLoading(false);
                        });
                    } else if (paintInfo.type === 'agg') {
                        const { map, ...info } = await getNewAggMap(paintInfo);
                        paintMapRef.current = map;
                        unstable_batchedUpdates(() => {
                            setDict(defaultScheme);
                            setAggInfo(info);
                            setFacets([]);
                            setDomainX(undefined);
                            setDomainY(undefined);
                            setX(undefined);
                            setY(undefined);
                            setLoading(false);
                        });
                    }
                }
            })();
        }
    }, [showPainterPanel, vizStore, compuation, zeroScale]);

    const saveMap = async () => {
        const dimensions =
            domainX && domainY
                ? [domainY, domainX]
                : aggInfo
                ? [aggInfo.x, aggInfo.y, aggInfo.color, aggInfo.size, aggInfo.opacity, aggInfo.shape]
                      .map((x) => x?.domain)
                      .filter((x): x is IPaintDimension => !!x)
                : null;
        if (dimensions && paintMapRef.current) {
            const newFacets = [
                ...facets,
                {
                    map: await compressBitMap(paintMapRef.current),
                    dimensions,
                    usedColor: Array.from(new Set(paintMapRef.current)).map((x) => x || 1),
                },
            ];
            // all colors in map
            const defaultUsedColor = Object.keys(dict)
                .map((x) => parseInt(x))
                .concat(ERASER);
            vizStore.updatePaint(
                {
                    dict,
                    facets: newFacets,
                    usedColor: Array.from(new Set(newFacets.flatMap((f) => f.usedColor ?? defaultUsedColor))),
                },
                t('constant.paint_key')
            );
        }
        vizStore.setShowPainter(false);
    };

    const onReset = useCallback(() => {
        setFacets([]);
    }, []);

    const mediaTheme = useContext(themeContext);
    const uiTheme = useContext(uiThemeContext);

    const vegaConfig = useMemo<VegaGlobalConfig>(() => {
        const presetConfig = themeConfig ?? builtInThemes[themeKey ?? 'vega'];
        const config: VegaGlobalConfig = {
            ...presetConfig?.[mediaTheme],
            background: parseColorToHex(uiTheme[mediaTheme].background),
        };
        return config;
    }, [uiTheme, themeConfig, themeKey, mediaTheme]);

    return (
        <Dialog
            open={showPainterPanel}
            onOpenChange={() => {
                vizStore.setShowPainter(false);
            }}
        >
            <DialogContent>
                {loading && <LoadingLayer />}
                {!loading && !aggInfo && (
                    <PainterContent
                        mark={geoms[0]}
                        vegaConfig={vegaConfig}
                        onSave={saveMap}
                        onDelete={() => {
                            vizStore.updatePaint(null, '');
                            vizStore.setShowPainter(false);
                        }}
                        onCancel={() => {
                            vizStore.setShowPainter(false);
                        }}
                        x={fieldX!}
                        y={fieldY!}
                        facets={facets}
                        allFields={allFields}
                        domainX={domainX!}
                        domainY={domainY!}
                        dict={dict}
                        onChangeDict={setDict}
                        paintMapRef={paintMapRef}
                        onReset={onReset}
                        displayOffset={timezoneDisplayOffset}
                    />
                )}
                {!loading && aggInfo && (
                    <AggPainterContent
                        mark={geoms[0]}
                        vegaConfig={vegaConfig}
                        onSave={saveMap}
                        onDelete={() => {
                            vizStore.updatePaint(null, '');
                            vizStore.setShowPainter(false);
                        }}
                        onCancel={() => {
                            vizStore.setShowPainter(false);
                        }}
                        x={aggInfo.x}
                        y={aggInfo.y}
                        color={aggInfo.color}
                        size={aggInfo.size}
                        opacity={aggInfo.opacity}
                        shape={aggInfo.shape}
                        facets={facets}
                        allFields={allFields}
                        dict={dict}
                        onChangeDict={setDict}
                        paintMapRef={paintMapRef}
                        onReset={onReset}
                        displayOffset={timezoneDisplayOffset}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};

export default observer(Painter);
