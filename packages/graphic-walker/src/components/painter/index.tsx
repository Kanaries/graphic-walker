import React, { useEffect, useState, useRef, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useCompututaion, useVizStore } from '../../store';
import { calcIndexs, compressMap, decompressMap, emptyMap, indexesFrom } from '../../lib/paint';
import { fieldStat } from '../../computation';
import { useRenderer } from '../../renderer/hooks';
import { IViewField } from '../../interfaces';
import embed from 'vega-embed';
import Modal from '../modal';
import { PAINT_FIELD_ID } from '../../constants';
import { Scene, SceneGroup, SceneItem, ScenegraphEvent } from 'vega-typings';
import { sceneVisit } from 'vega';
import throttle from '../../utils/throttle';
import { useTranslation } from 'react-i18next';

const MAGIC_PADDING = 5;
const CHART_WIDTH = 512;
const PIXEL_INDEX = '_gw_pixel_index';

const scheme = ['#4c78a8', '#f58518', '#e45756', '#72b7b2', '#54a24b', '#eeca3b', '#b279a2', '#ff9da6', '#9d755d', '#bab0ac'];

const defaultScheme = Object.fromEntries(scheme.map((color, i) => [i, { name: `L_${i + 1}`, color }]));

const emptyField = [];

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

const PainterContent = (props: {
    x: IViewField;
    y: IViewField;
    domainX: [number, number];
    domainY: [number, number];
    dict: typeof defaultScheme;
    onChangeDict: (d: typeof defaultScheme) => void;
    mapRef: React.MutableRefObject<Uint8Array | undefined>;
}) => {
    const computation = useCompututaion();
    const fields = useMemo(() => [props.x, props.y], [props.x, props.y]);
    const brushSizeRef = useRef(5);
    const [brushSize, setBrushSize] = useState(5);
    brushSizeRef.current = brushSize;
    const brushIdRef = useRef(1);
    const [brushId, setBrushId] = useState(1);
    brushIdRef.current = brushId;
    const containerRef = useRef<HTMLDivElement>(null);
    const { loading, viewData } = useRenderer({
        computationFunction: computation,
        defaultAggregated: false,
        filters: emptyField,
        allFields: fields,
        limit: -1,
        sort: 'none',
        viewDimensions: emptyField,
        viewMeasures: fields,
    });
    const indexes = useMemo(() => {
        return calcIndexs(
            viewData.map((x) => {
                return x[props.x.fid];
            }),
            viewData.map((x) => {
                return x[props.y.fid];
            }),
            props.domainX,
            props.domainY
        );
    }, [viewData, props.x, props.y, props.domainX, props.domainY]);
    const data = useMemo(() => {
        return viewData.map((x, i) => {
            return {
                ...x,
                [PAINT_FIELD_ID]: props.dict[props.mapRef.current![indexes[i]]]?.name,
                [PIXEL_INDEX]: indexes[i],
            };
        });
    }, [indexes, viewData, props.dict]);
    useEffect(() => {
        if (!loading && containerRef.current) {
            const colors = Object.entries(props.dict);
            const spec: any = {
                data: {
                    name: 'data',
                    values: data,
                },
                mark: { type: 'circle', opacity: 0.66 },
                encoding: {
                    x: {
                        field: props.x.fid,
                        title: props.x.name,
                        type: 'quantitative',
                        axis: { labelOverlap: true },
                        scale: { domain: props.domainX },
                    },
                    y: {
                        field: props.y.fid,
                        title: props.y.name,
                        type: 'quantitative',
                        axis: { labelOverlap: true },
                        scale: { domain: props.domainY },
                    },
                    color: {
                        field: PAINT_FIELD_ID,
                        type: 'nominal',
                        title: 'custom feature',
                        scale: {
                            domain: colors.map((x) => x[1].name),
                            range: colors.map((x) => x[1].color),
                        },
                    },
                },
                width: CHART_WIDTH,
                height: CHART_WIDTH,
            };
            embed(containerRef.current, spec).then((res) => {
                const scene = res.view.scenegraph() as unknown as { root: Scene };
                const origin = res.view.origin();
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
                const handleDraw = (e: ScenegraphEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const paint = (x: number, y: number) => {
                        const targetColor = props.dict[brushIdRef.current];
                        if (!targetColor) return;
                        const pts = indexesFrom([Math.floor(x / 4), Math.floor((CHART_WIDTH - y) / 4)], brushSizeRef.current);
                        let i = 0;
                        pts.forEach((x) => {
                            itemsMap.get(x)?.forEach((item) => {
                                item['fill'] = targetColor.color;
                                item.datum![PAINT_FIELD_ID] = targetColor.name;
                                i++;
                            });
                            props.mapRef.current![x] = brushIdRef.current;
                        });
                        i > 0 && rerender();
                    };
                    if (e instanceof MouseEvent && e.buttons & 1) {
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
                res.view.addEventListener('mouseup', handleDraw);
                res.view.addEventListener('mousemove', handleDraw);
                res.view.addEventListener('touchmove', handleDraw);
            });
        }
    }, [loading, viewData, props.dict]);
    return <div ref={containerRef} id="painter-container"></div>;
};

const Painter = () => {
    const vizStore = useVizStore();
    const { showPainterPanel } = vizStore;
    const { t } = useTranslation();
    const compuation = useCompututaion();

    const [loading, setLoading] = useState(true);
    const mapRef = useRef<Uint8Array>();
    const [dict, setDict] = useState(defaultScheme);
    const [fieldX, setX] = useState<IViewField>();
    const [fieldY, setY] = useState<IViewField>();
    const [domainX, setDomainX] = useState<[number, number]>([0, 0]);
    const [domainY, setDomainY] = useState<[number, number]>([0, 0]);

    useEffect(() => {
        if (showPainterPanel) {
            setLoading(true);
            (async () => {
                const { paintInfo, measures } = vizStore;
                if (paintInfo) {
                    const { x, y } = paintInfo;
                    const xf = measures.find((a) => a.fid === x);
                    const yf = measures.find((a) => a.fid === y);
                    if ('map' in paintInfo) {
                        mapRef.current = await decompressMap(paintInfo.map);
                        setDict(paintInfo.dict);
                        setDomainX(paintInfo.domainX);
                        setDomainY(paintInfo.domainY);
                    } else {
                        mapRef.current = emptyMap();
                        const xs = fieldStat(compuation, paintInfo.x, { range: true });
                        const ys = fieldStat(compuation, paintInfo.y, { range: true });
                        const { range: domainX } = await xs;
                        const { range: domainY } = await ys;
                        setDict(defaultScheme);
                        setDomainX(domainX);
                        setDomainY(domainY);
                    }
                    setX(xf);
                    setY(yf);
                    setLoading(false);
                }
            })();
        }
    }, [showPainterPanel, vizStore, compuation]);

    return (
        <Modal
            show={showPainterPanel}
            onClose={async () => {
                vizStore.setShowPainter(false);
                if (fieldX && fieldY && mapRef.current) {
                    vizStore.updatePaint(
                        {
                            dict,
                            domainX,
                            domainY,
                            map: await compressMap(mapRef.current),
                            x: fieldX.fid,
                            y: fieldY.fid,
                            usedColor: [...new Set(mapRef.current).values()],
                        },
                        t('constant.paint_key')
                    );
                }
            }}
        >
            {loading ? (
                <div></div>
            ) : (
                <PainterContent x={fieldX!} y={fieldY!} domainX={domainX} domainY={domainY} dict={dict} onChangeDict={setDict} mapRef={mapRef} />
            )}
        </Modal>
    );
};

export default observer(Painter);
