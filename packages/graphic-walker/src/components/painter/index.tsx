import React, { useEffect, useState, useRef, useMemo, useCallback, DependencyList } from 'react';
import { observer } from 'mobx-react-lite';
import { useCompututaion, useVizStore } from '../../store';
import { calcIndexesByDimensions, calcPaintMapV2, compressBitMap, createBitMapForMap, decompressBitMap, getCircleIndexes } from '../../lib/paint';
import { fieldStat } from '../../computation';
import { useRenderer } from '../../renderer/hooks';
import { IDarkMode, IField, IPaintDimension, IPaintMapFacet, ISemanticType, IThemeKey, IViewField, VegaGlobalConfig } from '../../interfaces';
import embed from 'vega-embed';
import Modal from '../modal';
import { PAINT_FIELD_ID } from '../../constants';
import { Scene, SceneGroup, SceneItem, ScenegraphEvent } from 'vega-typings';
import { sceneVisit } from 'vega';
import throttle from '../../utils/throttle';
import { useTranslation } from 'react-i18next';
import { ClickInput, ColorEditor, CursorDef, PixelContainer } from './components';
import LoadingLayer from '../loadingLayer';
import DefaultButton from '../button/default';
import PrimaryButton from '../button/primary';
import { GLOBAL_CONFIG } from '../../config';
import { GWGlobalConfig, builtInThemes } from '../../vis/theme';
import { useCurrentMediaTheme } from '../../utils/media';
import { unstable_batchedUpdates } from 'react-dom';
import { autoMark } from '../../vis/spec/mark';

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

function getMarkFor(types: ISemanticType[]) {
    if (types.every((x) => x === 'quantitative')) {
        return 'circle';
    }
    if (types.find((x) => x === 'quantitative')) {
        return 'tick';
    }
    return 'square';
}

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
    const computation = useCompututaion();
    const fields = useMemo(
        () => [
            {
                ...props.x,
                analyticType: 'measure' as const,
            },
            {
                ...props.y,
                analyticType: 'measure' as const,
            },
        ],
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
                    x: {
                        field: props.x.fid,
                        title: props.x.name,
                        type: props.domainX.domain.type,
                        axis: { labelOverlap: true },
                        scale: { domain: props.domainX.domain.value },
                    },
                    y: {
                        field: props.y.fid,
                        title: props.y.name,
                        type: props.domainY.domain.type,
                        axis: { labelOverlap: true },
                        scale: { domain: props.domainY.domain.type === 'quantitative' ? props.domainY.domain.value : props.domainY.domain.value.toReversed() },
                    },
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
            embed(containerRef.current, spec, { config: props.vegaConfig, actions: false }).then((res) => {
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
                const rerender = throttle(() => res.view._renderer._render(scene.root), 100, { trailing: true });
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
                                      color: '#00000000',
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
                                item['fill'] && item['fill'] !== 'transparent' && (item['fill'] = targetColor.color);
                                item['stroke'] && item['stroke'] !== 'transparent' && (item['stroke'] = targetColor.color);
                                item.datum![PAINT_FIELD_ID] = targetColor.name;
                                i++;
                            });
                            props.paintMapRef.current![x] = brushIdRef.current;
                        });
                        i > 0 && rerender();
                    };
                    if (e instanceof MouseEvent && e.buttons & MouseButtons.PRIMARY) {
                        paint(e.offsetX - origin[0] - MAGIC_PADDING, e.offsetY - origin[1] - MAGIC_PADDING);
                    } else if (e instanceof TouchEvent) {
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
                <div ref={containerRef} id="painter-container" className="!cursor-none"></div>
            </PixelContainer>
            <div className="flex flex-col space-y-2 pt-10 w-40 flex-shrink-0">
                <div className="flex space-x-4" aria-label="Tabs">
                    <a
                        className={
                            (brushId === ERASER ? 'text-gray-500 hover:text-gray-700' : 'bg-indigo-100 text-indigo-700') +
                            ' rounded-md px-3 py-2 text-sm font-medium'
                        }
                        onClick={() => setBrushId(2)}
                    >
                        {t('main.tabpanel.settings.paint.palette')}
                    </a>
                    <a
                        className={
                            (brushId !== ERASER ? 'text-gray-500 hover:text-gray-700' : 'bg-indigo-100 text-indigo-700') +
                            ' rounded-md px-3 py-2 text-sm font-medium'
                        }
                        onClick={() => setBrushId(ERASER)}
                    >
                        {t('main.tabpanel.settings.paint.eraser')}
                    </a>
                </div>
                {brushId !== ERASER && (
                    <>
                        <div className="grid grid-cols-5 gap-2 p-2">
                            {Object.entries(props.dict).map(([id, { color }]) => (
                                <div
                                    key={id}
                                    className={`box-border rounded-full border-black hover:border-gray-200 ${
                                        id === `${brushId}` ? 'border-2' : 'hover:border-2'
                                    } active:ring-black active:ring-1 w-4 h-4`}
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
                    </>
                )}
                <div className="pt-2">
                    <output className="text-sm">
                        {t('main.tabpanel.settings.paint.brush_size')}: {`${brushSize}`}
                    </output>
                    <input
                        className="w-full h-2 bg-blue-100 appearance-none"
                        type="range"
                        value={brushSize}
                        min={GLOBAL_CONFIG.PAINT_MIN_BRUSH_SIZE}
                        max={GLOBAL_CONFIG.PAINT_MAX_BRUSH_SIZE}
                        step="1"
                        onChange={(e) => {
                            const v = parseInt(e.target.value);
                            if (!isNaN(v)) {
                                setBrushSize(v);
                            }
                        }}
                    />
                </div>
                <div className="flex-1 flex flex-col space-y-2 justify-end">
                    <PrimaryButton className="bg-red-600 hover:bg-red-700" text={t('main.tabpanel.settings.paint.delete_paint')} onClick={props.onDelete} />
                    <DefaultButton text={t('main.tabpanel.settings.paint.reset_paint')} onClick={() => resetRef.current()} />
                    <DefaultButton text={t('main.tabpanel.settings.paint.cancel')} onClick={props.onCancel} />
                    <PrimaryButton text={t('main.tabpanel.settings.paint.save_paint')} onClick={props.onSave} />
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

const Painter = ({ dark, themeConfig, themeKey }: { dark?: IDarkMode; themeConfig?: GWGlobalConfig; themeKey?: IThemeKey }) => {
    const vizStore = useVizStore();
    const { showPainterPanel, allFields, layout, config } = vizStore;
    const { geoms, timezoneDisplayOffset } = config;
    const { zeroScale } = layout;
    const { t } = useTranslation();
    const compuation = useCompututaion();

    const [loading, setLoading] = useState(true);
    const paintMapRef = useRef<Uint8Array>();
    const [dict, setDict] = useState(defaultScheme);
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
                const getNewMap = async (paintInfo: { x: IViewField; y: IViewField }) => {
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
                            const value = res.values.map((x) => x.value);
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
                    const [domainX, domainY] = await Promise.all([getDomain(paintInfo.x), getDomain(paintInfo.y)]);
                    return {
                        x: paintInfo.x,
                        y: paintInfo.y,
                        domainX,
                        domainY,
                        map: createBitMapForMap([domainY, domainX]),
                    };
                };
                if (paintInfo) {
                    if (paintInfo.type === 'exist') {
                        const lastFacet = paintInfo.item.facets.at(-1)!;
                        if (
                            paintInfo.new.type === 'new' &&
                            (lastFacet.dimensions[0]?.fid !== paintInfo.new.y.fid ||
                                lastFacet.dimensions[1]?.fid !== paintInfo.new.x.fid ||
                                !isDomainZeroscaledAs(lastFacet.dimensions[0]?.domain, zeroScale) ||
                                !isDomainZeroscaledAs(lastFacet.dimensions[1]?.domain, zeroScale))
                        ) {
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
                                setLoading(false);
                            });
                        } else {
                            paintMapRef.current = await decompressBitMap(lastFacet.map);
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
                                setLoading(false);
                            });
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
                            setFacets([]);
                            setLoading(false);
                        });
                    }
                }
            })();
        }
    }, [showPainterPanel, vizStore, compuation, zeroScale]);

    const saveMap = async () => {
        if (domainX && domainY && paintMapRef.current) {
            const newFacets = [
                ...facets,
                {
                    map: await compressBitMap(paintMapRef.current),
                    dimensions: [domainY, domainX],
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

    const mediaTheme = useCurrentMediaTheme(dark);

    const vegaConfig = useMemo<VegaGlobalConfig>(() => {
        const presetConfig = themeConfig ?? builtInThemes[themeKey ?? 'vega'];
        const config: VegaGlobalConfig = {
            ...presetConfig?.[mediaTheme],
            background: mediaTheme === 'dark' ? '#18181f' : '#ffffff',
        };
        return config;
    }, [themeConfig, themeKey, mediaTheme]);

    return (
        <Modal
            show={showPainterPanel}
            onClose={() => {
                vizStore.setShowPainter(false);
            }}
        >
            {loading ? (
                <LoadingLayer />
            ) : (
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
        </Modal>
    );
};

export default observer(Painter);
