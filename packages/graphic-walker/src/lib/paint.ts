import { IPaintMap } from '../interfaces';

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
export function indexesFrom(center: [number, number], dia: number, mapWidth: number) {
    return getCircleFrom(center, dia, mapWidth).map(([x, y]) => index(x, y, mapWidth));
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
export async function compressMap(arr: Uint8Array) {
    const stream = new Response(arr).body!.pipeThrough(new CompressionStream('deflate-raw'));
    const result = await new Response(stream).arrayBuffer();
    return bufferToBase64(result);
}

/**
 * Decompress a base64-string to Uint8Array.
 * @param base64 base64-string to be decompressed.
 * @returns Promise of the decompressed data.
 */
export async function decompressMap(base64: string) {
    const stream = await fetch('data:application/octet-stream;base64,' + base64).then((res) => res.body!.pipeThrough(new DecompressionStream('deflate-raw')));
    const result = await new Response(stream).arrayBuffer();
    return new Uint8Array(result);
}

export function emptyMap(mapWidth: number) {
    return new Uint8Array(mapWidth * mapWidth);
}

/**
 * calc the item index in the map.
 * @param domain domain of the item.
 * @param item value of the item.
 * @param mapWidth width of the map.
 * @returns index of the item in the map.
 */
export function calcIndex(domain: [number, number], item: number, mapWidth: number) {
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
export function calcIndexs(dataX: number[], dataY: number[], domainX: [number, number], domainY: [number, number], mapWidth: number) {
    return dataX.map((x, i) => {
        const y = dataY[i];
        return index(calcIndex(domainX, x, mapWidth), calcIndex(domainY, y, mapWidth), mapWidth);
    });
}

/**
 * calc result of items in paintMap.
 * @param dataX data of item in X axis.
 * @param dataY data of item in Y axis.
 * @param paintMap the PaintMap to use.
 * @returns 
 */
export async function calcMap(dataX: number[], dataY: number[], paintMap: IPaintMap) {
    const { dict, domainX, domainY, map: raw, mapwidth } = paintMap;
    const map = await decompressMap(raw);
    return calcIndexs(dataX, dataY, domainX, domainY, mapwidth).map((x) => {
        return dict[map[x]]?.name;
    });
}
