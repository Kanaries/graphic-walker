/** Logical offsets remain authoritative even when the browser track is compressed. */
export class ScrollMapper {
    readonly logicalMax: number;
    readonly physicalMax: number;
    constructor(extent: number, viewport: number, trackLimit = 1_000_000) {
        if (
            ![extent, viewport, trackLimit].every(Number.isFinite) ||
            extent < 0 ||
            viewport < 0 ||
            trackLimit <= viewport ||
            extent > Number.MAX_SAFE_INTEGER
        ) {
            throw new RangeError('Unsafe scroll extent');
        }
        this.logicalMax = Math.max(0, extent - viewport);
        this.physicalMax = Math.min(this.logicalMax, trackLimit - viewport);
    }
    get compressed(): boolean {
        return this.logicalMax > this.physicalMax;
    }
    clamp(value: number): number {
        return Math.max(0, Math.min(this.logicalMax, Number.isFinite(value) ? value : 0));
    }
    toPhysical(value: number): number {
        return this.logicalMax ? (this.clamp(value) / this.logicalMax) * this.physicalMax : 0;
    }
    toLogical(value: number): number {
        return this.physicalMax ? this.clamp((value / this.physicalMax) * this.logicalMax) : 0;
    }
}
