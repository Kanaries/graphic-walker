import { IPaintMap, IRow } from '../interfaces';

const length = 16384;
const width = 128;

function index(x: number, y: number) {
    return y * width + x;
}

function resolve(index: number) {
    const x = index % 128;
    const y = Math.floor(index / 128);
    return [x, y];
}

async function bufferToBase64(buffer: Uint8Array | ArrayBuffer) {
    return await new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result as string);
        reader.readAsDataURL(new Blob([buffer]));
    });
}

export async function compressMap(arr: Uint8Array) {
    const stream = new Response(arr).body!.pipeThrough(new CompressionStream('deflate-raw'));
    const result = await new Response(stream).arrayBuffer();
    return bufferToBase64(result);
}

export async function decompressMap(uri: string) {
    const stream = await fetch(uri).then((res) => res.body!.pipeThrough(new DecompressionStream('deflate-raw')));
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

export async function calcMap(dataX: number[], dataY: number[], paintMap: IPaintMap) {
    const { dict, domainX, domainY, map: raw } = paintMap;
    const map = await decompressMap(raw);
    return dataX.map((x, i) => {
        const y = dataY[i];
        return dict[map[index(calcIndex(domainX, x), calcIndex(domainY, y))]].name;
    });
}
