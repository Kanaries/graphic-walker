import { IPaintMap } from '../interfaces';

const circles = new Map<number, [number, number][]>();

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

export function getCircleFrom([x0, y0]: [number, number], dia: number, mapWidth: number) {
    const center = (dia - (dia % 2)) / 2;
    return getCircle(dia)
        .map(([x, y]) => [x + x0 - center, y + y0 - center])
        .filter(([x, y]) => x >= 0 && x < mapWidth && y >= 0 && y < mapWidth);
}

export function indexesFrom(center: [number, number], radius: number, mapWidth: number) {
    return getCircleFrom(center, radius, mapWidth).map(([x, y]) => index(x, y, mapWidth));
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

export async function compressMap(arr: Uint8Array) {
    const stream = new Response(arr).body!.pipeThrough(new CompressionStream('deflate-raw'));
    const result = await new Response(stream).arrayBuffer();
    return bufferToBase64(result);
}

export async function decompressMap(uri: string) {
    const stream = await fetch('data:application/octet-stream;base64,' + uri).then((res) => res.body!.pipeThrough(new DecompressionStream('deflate-raw')));
    const result = await new Response(stream).arrayBuffer();
    return new Uint8Array(result);
}

export function emptyMap(mapWidth: number) {
    return new Uint8Array(mapWidth * mapWidth);
}

export function calcIndex(domain: [number, number], item: number, mapWidth: number) {
    if (item >= domain[1]) return mapWidth - 1;
    if (item <= domain[0]) return 0;
    return Math.floor((mapWidth * (item - domain[0])) / (domain[1] - domain[0]));
}

export function calcIndexs(dataX: number[], dataY: number[], domainX: [number, number], domainY: [number, number], mapWidth: number) {
    return dataX.map((x, i) => {
        const y = dataY[i];
        return index(calcIndex(domainX, x, mapWidth), calcIndex(domainY, y, mapWidth), mapWidth);
    });
}

export async function calcMap(dataX: number[], dataY: number[], paintMap: IPaintMap) {
    const { dict, domainX, domainY, map: raw, mapwidth } = paintMap;
    const map = await decompressMap(raw);
    return calcIndexs(dataX, dataY, domainX, domainY, mapwidth).map((x) => {
        return dict[map[x]]?.name;
    });
}
