import { IPaintMap, IRow } from '../interfaces';

const length = 16384;
const width = 128;

const circles = new Map<number, [number, number][]>();

const getCircle = (radius: number) => {
    if (circles.has(radius)) return circles.get(radius)!;
    const result: [number, number][] = [];
    for (let x = 0; x < radius * 2; x++) {
        for (let y = 0; y < radius * 2; y++) {
            if ((x - radius + 0.5) ** 2 + (y - radius + 0.5) ** 2 < radius ** 2) {
                result.push([x, y]);
            }
        }
    }
    circles.set(radius, result);
    return result;
};

export function getCircleFrom([x0, y0]: [number, number], radius: number) {
    return getCircle(radius)
        .map(([x, y]) => [x + x0 - radius, y + y0 - radius])
        .filter(([x, y]) => x >= 0 && x < 128 && y >= 0 && y < 128);
}

export function indexesFrom(center: [number, number], radius: number) {
    return getCircleFrom(center, radius).map(([x, y]) => index(x, y));
}

function index(x: number, y: number) {
    return y * width + x;
}

function resolve(index: number) {
    const x = index % 128;
    const y = Math.floor(index / 128);
    return [x, y];
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

export function emptyMap() {
    return new Uint8Array(length);
}

export function calcIndex(domain: [number, number], item: number) {
    if (item >= domain[1]) return 127;
    if (item <= domain[0]) return 0;
    return Math.floor((128 * (item - domain[0])) / (domain[1] - domain[0]));
}

export function calcIndexs(dataX: number[], dataY: number[], domainX: [number, number], domainY: [number, number]) {
    return dataX.map((x, i) => {
        const y = dataY[i];
        return index(calcIndex(domainX, x), calcIndex(domainY, y));
    });
}

export async function calcMap(dataX: number[], dataY: number[], paintMap: IPaintMap) {
    const { dict, domainX, domainY, map: raw } = paintMap;
    const map = await decompressMap(raw);
    return calcIndexs(dataX, dataY, domainX, domainY).map((x) => {
        return dict[map[x]]?.name;
    });
}
