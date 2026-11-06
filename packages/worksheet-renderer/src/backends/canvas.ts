import type { SceneFrame } from '../scene/types';

/** One viewport bitmap; every mark, axis, header and interaction overlay uses this context. */
export function paintCanvas(canvas: HTMLCanvasElement, frame: SceneFrame, requestedDpr = window.devicePixelRatio || 1): void {
    const dpr = Math.max(0.5, Math.min(2, requestedDpr, Math.sqrt(16_777_216 / Math.max(1, frame.width * frame.height))));
    const width = Math.ceil(frame.width * dpr),
        height = Math.ceil(frame.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    canvas.style.width = `${frame.width}px`;
    canvas.style.height = `${frame.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, frame.width, frame.height);
    for (const { clip, primitive: p } of frame.commands) {
        if (!clip.width || !clip.height) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(clip.x, clip.y, clip.width, clip.height);
        ctx.clip();
        ctx.globalAlpha = p.opacity ?? 1;
        if (p.kind === 'rect') {
            ctx.fillStyle = p.fill;
            ctx.fillRect(p.box.x, p.box.y, p.box.width, p.box.height);
            if (p.stroke) {
                ctx.strokeStyle = p.stroke;
                ctx.lineWidth = p.strokeWidth ?? 1;
                ctx.strokeRect(p.box.x, p.box.y, p.box.width, p.box.height);
            }
        } else if (p.kind === 'line') {
            ctx.strokeStyle = p.stroke;
            ctx.lineWidth = p.width ?? 1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x1, p.y1);
            ctx.lineTo(p.x2, p.y2);
            ctx.stroke();
        } else if (p.kind === 'circle') {
            ctx.fillStyle = p.fill;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            if (p.stroke) {
                ctx.strokeStyle = p.stroke;
                ctx.lineWidth = p.strokeWidth ?? 1;
                ctx.stroke();
            }
        } else if (p.kind === 'path') {
            ctx.beginPath();
            p.points.forEach((point, index) => {
                if (index) ctx.lineTo(point.x, point.y);
                else ctx.moveTo(point.x, point.y);
            });
            if (p.closed) ctx.closePath();
            if (p.fill) {
                ctx.fillStyle = p.fill;
                ctx.fill();
            }
            if (p.stroke) {
                ctx.strokeStyle = p.stroke;
                ctx.lineWidth = p.width ?? 1;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        } else {
            ctx.fillStyle = p.fill;
            ctx.font = `${p.size ?? 12}px ${p.fontFamily ?? 'sans-serif'}`;
            ctx.textAlign = p.align ?? 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(p.text, p.x, p.y);
        }
        ctx.restore();
    }
}
