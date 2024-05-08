import { IPaintDimension, IPaintMap, IPaintMapV2, IRow } from '../interfaces';

const circles = new Map<number, [number, number][]>();

/**
 * Returns Points of a Circle.
 * @param dia Diameter of the circle.
 * @returns Points of the Circle.
 */
export const getCircle = (dia: number) => {
    if (circles.has(dia)) return circles.get(dia)!;
    const result: [number, number][] = [];
    for (let x = 0; x < dia; x++) {
        for (let y = 0; y < dia; y++) {
            if (((x - (dia - 1) / 2) ** 2 + (y - (dia - 1) / 2) ** 2) * 4 < dia ** 2) {
                result.push([x, y]);
            }
        }
    }
    circles.set(dia, result);
    return result;
};

/**
 * Returns Points of a Circle with specified center at in a map.
 * @param center Coordination of center of the circle.
 * @param dia Diameter of the circle.
 * @param mapWidth Width of the Map (points outside map will be croped)
 * @returns Points of the circle in the map.
 */
export function getCircleFrom([x0, y0]: [number, number], dia: number, mapWidth: number) {
    const center = (dia - (dia % 2)) / 2;
    return getCircle(dia)
        .map(([x, y]) => [x + x0 - center, y + y0 - center])
        .filter(([x, y]) => x >= 0 && x < mapWidth && y >= 0 && y < mapWidth);
}

/**
 * Returns Indexes of circle points with specified center at in a map.
 * @param center Coordination of center of the circle.
 * @param dia Diameter of the circle.
 * @param mapWidth Width of the Map (points outside map will be croped)
 * @returns Indexes of circle points in the map.
 */
export function getCircleIndexes(center: [number, number], dia: number, dimensions: [IPaintDimension, IPaintDimension]) {
    const [y, x] = dimensions;
    const index = indexByDimensions(dimensions);
    if (y.domain.type === 'quantitative' && x.domain.type === 'quantitative') {
        const mapWidth = y.domain.width;
        return getCircleFrom(center, dia, mapWidth).map(([x, y]) => index([y, x]));
    }
    const getI = (c: number, domain: IPaintDimension): number[] => {
        if (domain.domain.type === 'nominal') {
            return [c];
        }
        const half = (dia - (dia % 2)) / 2;
        return new Array(dia)
            .fill(0)
            .map((_, i) => i + c - half)
            .filter((x) => x >= 0 && x < domain.domain.width);
    };
    return getI(center[0], x)
        .flatMap((x) => getI(center[1], y).map((y) => [x, y] as const))
        .map(([x, y]) => index([y, x]));
}

function index(x: number, y: number, mapWidth: number) {
    return y * mapWidth + x;
}

async function bufferToBase64(buffer: Uint8Array | ArrayBuffer): Promise<string> {
    return await new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => r((reader.result as string).substring(37));
        reader.readAsDataURL(new Blob([buffer]));
    });
}
/**
 * Compress a Uint8Array.
 * @param arr Uint8Array to be compressed.
 * @returns Promise of the compressed data in base64-string.
 */
export async function compressBitMap(arr: Uint8Array) {
    const stream = new Response(arr).body!.pipeThrough(new CompressionStream('deflate-raw'));
    const result = await new Response(stream).arrayBuffer();
    return bufferToBase64(result);
}

/**
 * Decompress a base64-string to Uint8Array.
 * @param base64 base64-string to be decompressed.
 * @returns Promise of the decompressed data.
 */
export async function decompressBitMap(base64: string) {
    const stream = await fetch('data:application/octet-stream;base64,' + base64).then((res) => res.body!.pipeThrough(new DecompressionStream('deflate-raw')));
    const result = await new Response(stream).arrayBuffer();
    return new Uint8Array(result);
}

export function createBitMapForMap(dimensions: IPaintDimension[]) {
    return new Uint8Array(dimensions.reduce((x, d) => x * d.domain.width, 1));
}

/**
 * calc the item index in the map.
 * @param domain domain of the item.
 * @param item value of the item.
 * @param mapWidth width of the map.
 * @returns index of the item in the map.
 */
export function calcIndexInPaintMap(domain: [number, number], item: number, mapWidth: number) {
    if (item >= domain[1]) return mapWidth - 1;
    if (item <= domain[0]) return 0;
    return Math.floor((mapWidth * (item - domain[0])) / (domain[1] - domain[0]));
}

/**
 * calc indexes of items in X and Y axises in the map.
 * @param dataX data of item in X axis.
 * @param dataY data of item in Y axis.
 * @param domainX domain of item in X axis.
 * @param domainY domain of item in Y axis.
 * @param mapWidth width of the map.
 * @returns index of items in the map.
 */
export function calcIndexesInPaintMap(dataX: number[], dataY: number[], domainX: [number, number], domainY: [number, number], mapWidth: number) {
    return dataX.map((x, i) => {
        const y = dataY[i];
        return index(calcIndexInPaintMap(domainX, x, mapWidth), calcIndexInPaintMap(domainY, y, mapWidth), mapWidth);
    });
}

/**
 * calc result of items in paintMap.
 * @param dataX data of item in X axis.
 * @param dataY data of item in Y axis.
 * @param paintMap the PaintMap to use.
 * @returns
 */
export async function calcPaintMap(dataX: number[], dataY: number[], paintMap: IPaintMap) {
    const { dict, domainX, domainY, map: raw, mapwidth } = paintMap;
    const map = await decompressBitMap(raw);
    return calcIndexesInPaintMap(dataX, dataY, domainX, domainY, mapwidth).map((x) => {
        return dict[map[x]]?.name;
    });
}

// e.g. [3,3,3] => [9,3,1]
function indexByDimensions(dimensions: IPaintDimension[]) {
    const indexWeights = dimensions
        .map((x) => x.domain.width)
        .reduceRight(([n, ...rest], a) => [a * n, n, ...rest], [1])
        .slice(1);
    return (indexes: number[]) => indexes.map((i, wi) => i * indexWeights[wi]).reduce((x, y) => x + y);
}

/**
 * calc indexes of items in the map.
 * @param dimensions the dimensions of the map
 * @returns mapper for data.
 */
export function calcIndexesByDimensions(dimensions: IPaintDimension[]) {
    const getSingleIndex = dimensions.map(({ domain, fid }) => {
        if (domain.type === 'nominal') {
            const indexDict = new Map(domain.value.map((x, i) => [`${x}`, i]));
            return (data: IRow) => indexDict.get(`${data[fid]}`) ?? 0;
        }
        if (domain.type === 'quantitative') {
            return (data: IRow) => calcIndexInPaintMap(domain.value, data[fid], domain.width);
        }
        const neverType: never = domain;
        throw new Error(`unsupported domain type ${neverType['type']}`);
    });

    const index = indexByDimensions(dimensions);
    return (data: IRow) => index(getSingleIndex.map((f) => f(data)));
}

export function IPaintMapAdapter(paintMap: IPaintMap): IPaintMapV2 {
    return {
        dict: paintMap.dict,
        usedColor: paintMap.usedColor,
        facets: [
            {
                map: paintMap.map,
                usedColor: paintMap.usedColor,
                dimensions: [
                    {
                        fid: paintMap.y,
                        domain: {
                            type: 'quantitative',
                            value: paintMap.domainY,
                            width: paintMap.mapwidth,
                        },
                    },
                    {
                        fid: paintMap.x,
                        domain: {
                            type: 'quantitative',
                            value: paintMap.domainX,
                            width: paintMap.mapwidth,
                        },
                    },
                ],
            },
        ],
    };
}

/**
 * calc result of items in paintMap.
 * @param data data
 * @param paintMap paintMap
 * @returns result
 */
export async function calcPaintMapV2(data: IRow[], paintMap: IPaintMapV2) {
    const { dict, facets } = paintMap;
    let result = data.map(() => dict[1].name);
    for (const { map: raw, dimensions } of facets) {
        const map = await decompressBitMap(raw);
        const index = calcIndexesByDimensions(dimensions);
        result = data.map(index).map((x, i) => (map[x] !== 0 ? dict[map[x]]?.name : result[i]));
    }

    return result;
}
