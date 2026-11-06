import type { HeaderTarget, HitRegion, SceneFrame } from '../scene/types';
import { typedValueLabel } from '../core/keys';

export function headerDescription(target: HeaderTarget): string {
    const path = target.path.map((member) => typedValueLabel(member.value)).join(' / ');
    return (target.axis === 'row' ? 'Row header: ' : 'Column header: ') + (path ? path + '. ' : '') + target.label;
}

export interface SemanticActions {
    step(delta: number): void;
    edge(last: boolean): void;
    toggleHeaders(): void;
    activate(): void;
    sort(): void;
    clear(): void;
    enter(): void;
    leave(): void;
}
const hiddenStyle = 'position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap';

/** One focus proxy and a paged view of visible records keep semantic DOM bounded. */
export function createSemanticView(root: HTMLElement, name: string, actions: SemanticActions) {
    const proxy = document.createElement('div');
    const summary = document.createElement('div');
    const tooltip = document.createElement('div');
    const button = document.createElement('button');
    const panel = document.createElement('div');
    const pageLabel = document.createElement('span');
    const previous = document.createElement('button');
    const next = document.createElement('button');
    const table = document.createElement('table');
    let page = 0;
    let frame: SceneFrame | undefined;
    proxy.style.cssText = hiddenStyle;
    proxy.tabIndex = 0;
    proxy.setAttribute('role', 'button');
    proxy.setAttribute(
        'aria-label',
        name +
            '. Focus a chart item. Arrow keys move between visible items; H switches to headers; Enter selects or expands; S requests sorting; Escape returns to scrolling.',
    );
    summary.style.cssText = hiddenStyle;
    summary.setAttribute('aria-live', 'polite');
    tooltip.style.cssText =
        'position:absolute;z-index:4;max-width:360px;padding:8px 10px;background:#0f172a;color:white;border-radius:4px;font:12px sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none';
    tooltip.hidden = true;
    tooltip.setAttribute('role', 'tooltip');
    button.textContent = 'Visible data';
    button.setAttribute('type', 'button');
    button.setAttribute('aria-expanded', 'false');
    button.style.cssText =
        'position:absolute;bottom:4px;right:22px;z-index:3;font:12px sans-serif;padding:4px 8px;border:1px solid #cbd5e1;background:white;border-radius:4px';
    panel.hidden = true;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Visible worksheet data');
    panel.style.cssText =
        'position:absolute;bottom:32px;left:12px;right:22px;max-height:220px;overflow:auto;background:white;border:1px solid #94a3b8;padding:8px;z-index:3;font:12px sans-serif';
    previous.textContent = 'Previous 100';
    next.textContent = 'Next 100';
    previous.setAttribute('type', 'button');
    next.setAttribute('type', 'button');
    panel.append(previous, pageLabel, next, table);
    root.append(summary, proxy, tooltip, button, panel);
    const renderData = () => {
        if (panel.hidden) return;
        const hits = frame?.hits ?? [];
        page = Math.min(page, Math.max(0, Math.ceil(hits.length / 100) - 1));
        table.replaceChildren();
        const heading = document.createElement('tr');
        for (const label of ['Chart item', 'Prepared values']) {
            const cell = document.createElement('th');
            cell.textContent = label;
            heading.appendChild(cell);
        }
        table.appendChild(heading);
        for (const hit of hits.slice(page * 100, (page + 1) * 100)) {
            const row = document.createElement('tr');
            const label = document.createElement('td');
            label.textContent = hit.label ?? hit.datumKey;
            const values = document.createElement('td');
            values.textContent = Object.entries(hit.values)
                .map(([key, value]) => key + ': ' + String(value ?? '(null)'))
                .join('; ');
            row.append(label, values);
            table.appendChild(row);
        }
        pageLabel.textContent = hits.length
            ? ' Items ' + (page * 100 + 1) + '–' + Math.min(hits.length, (page + 1) * 100) + ' of ' + hits.length + ' '
            : ' No visible records ';
        previous.disabled = page === 0;
        next.disabled = (page + 1) * 100 >= hits.length;
    };
    const toggle = () => {
        panel.hidden = !panel.hidden;
        button.setAttribute('aria-expanded', String(!panel.hidden));
        renderData();
    };
    const back = () => {
        page--;
        renderData();
    };
    const forward = () => {
        page++;
        renderData();
    };
    const onFocus = () => actions.enter();
    const onKey = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        const handlers: Record<string, () => void> = {
            arrowright: () => actions.step(1),
            arrowdown: () => actions.step(1),
            arrowleft: () => actions.step(-1),
            arrowup: () => actions.step(-1),
            home: () => actions.edge(false),
            end: () => actions.edge(true),
            h: actions.toggleHeaders,
            enter: actions.activate,
            ' ': actions.activate,
            s: actions.sort,
            escape: () => {
                actions.clear();
                actions.leave();
            },
        };
        if (handlers[key]) {
            event.preventDefault();
            handlers[key]();
        }
    };
    proxy.addEventListener('focus', onFocus);
    proxy.addEventListener('keydown', onKey);
    button.addEventListener('click', toggle);
    previous.addEventListener('click', back);
    next.addEventListener('click', forward);
    return {
        update(nextFrame: SceneFrame | undefined, focused: HitRegion | HeaderTarget | undefined, selected: boolean, description: string) {
            frame = nextFrame;
            summary.textContent = description;
            if (focused) {
                const isHeader = focused.kind === 'header';
                proxy.setAttribute(
                    'aria-label',
                    (isHeader ? headerDescription(focused) : (focused.label ?? focused.datumKey)) +
                        (isHeader
                            ? focused.canCollapse
                                ? '. Enter expands or collapses; S requests sorting.'
                                : '. S requests sorting.'
                            : '. Enter selects.'),
                );
                proxy.setAttribute('role', 'button');
                if (!isHeader) proxy.setAttribute('aria-pressed', String(selected));
                else proxy.removeAttribute?.('aria-pressed');
                if (isHeader && focused.canCollapse) proxy.setAttribute('aria-expanded', String(focused.expanded !== false));
                else proxy.removeAttribute?.('aria-expanded');
            } else {
                proxy.setAttribute(
                    'aria-label',
                    nextFrame
                        ? 'No visible item is focused. Arrow keys focus visible items; H switches to headers.'
                        : 'Worksheet data is not ready.',
                );
                proxy.removeAttribute?.('aria-expanded');
                proxy.removeAttribute?.('aria-pressed');
            }
            renderData();
        },
        focus() {
            proxy.focus?.();
        },
        tooltip(label: string | undefined, x = 0, y = 0) {
            tooltip.hidden = !label;
            tooltip.textContent = label ?? '';
            tooltip.style.left = Math.max(0, Math.min(x + 12, root.clientWidth - 360)) + 'px';
            tooltip.style.top = Math.max(0, Math.min(y + 12, root.clientHeight - 100)) + 'px';
        },
        dispose() {
            proxy.removeEventListener('focus', onFocus);
            proxy.removeEventListener('keydown', onKey);
            button.removeEventListener('click', toggle);
            previous.removeEventListener('click', back);
            next.removeEventListener('click', forward);
            frame = undefined;
            for (const node of [summary, proxy, tooltip, button, panel]) node.remove();
        },
    };
}
