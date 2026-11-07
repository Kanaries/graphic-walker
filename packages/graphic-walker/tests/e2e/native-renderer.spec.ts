import { expect, test, type Page } from '@playwright/test';

async function invoke<T>(page: Page, name: string, ...args: unknown[]): Promise<T> {
    return page.evaluate(({ name, args }) => (window as any).__nativeRenderer[name](...args), { name, args });
}
const ready = (page: Page) => expect.poll(() => invoke(page, 'status')).toBe('idle');
const scroller = (page: Page) => page.getByRole('region', { name: 'Worksheet. Arrow keys scroll; Home and End jump to limits.', exact: true });
test.beforeEach(async ({ page }) => {
    await page.goto('/tests/e2e/native-renderer.html');
    await ready(page);
});

test('StrictMode keeps one bounded controller and complete viewport export refs', async ({ page }) => {
    await expect(scroller(page)).toHaveCount(1);
    await expect(page.locator('[data-renderer="native"] svg')).toHaveCount(1);
    const bounds = await page.locator('[data-renderer="native"]').boundingBox();
    expect(bounds?.width).toBe(900);
    expect(bounds?.height).toBe(560);
    const svg = await invoke<string[]>(page, 'export', 'svg'),
        png = await invoke<string[]>(page, 'export', 'png');
    expect(svg).toHaveLength(1);
    expect(svg[0]).toContain('<svg');
    expect(png).toHaveLength(1);
    expect(png[0]).toMatch(/^data:image\/png;base64,/);
    const exported = await invoke<any>(page, 'exportChart');
    expect(exported).toMatchObject({ chartType: 'native', nRows: 1, nCols: 1 });
    expect(exported.charts).toHaveLength(1);
    expect(exported.charts[0].width).toBeGreaterThan(800);
    const list = await invoke<any[]>(page, 'exportList');
    expect(list).toHaveLength(1);
    expect(list[0].data.chartType).toBe('native');
    for (const format of ['svg', 'png']) {
        const download = page.waitForEvent('download');
        const contents = await invoke<string[]>(page, 'download', format);
        expect(contents).toHaveLength(1);
        expect((await download).suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
    }
});

test('backend and static theme changes preserve the controller, scroll and prepared presentation', async ({ page }) => {
    await invoke(page, 'enableColor');
    await ready(page);
    const before = await invoke<any>(page, 'report');
    await scroller(page).evaluate(async (element) => {
        (window as any).__originalScroller = element;
        await new Promise<void>(resolve => {
            element.addEventListener('scroll', () => requestAnimationFrame(() => requestAnimationFrame(() => resolve())), { once: true });
            element.scrollTop = 180;
            element.scrollLeft = 100;
        });
    });
    await expect.poll(() => scroller(page).evaluate((element) => element.scrollTop)).toBe(180);
    await invoke(page, 'setBackend', false);
    await ready(page);
    await expect(page.locator('[data-renderer="native"] canvas')).toHaveCount(1);
    await expect(page.locator('[data-renderer="native"] svg')).toHaveCount(0);
    expect(await scroller(page).evaluate((element) => element === (window as any).__originalScroller)).toBe(true);
    expect(await scroller(page).evaluate((element) => element.scrollTop)).toBe(180);
    await invoke(page, 'setDark', true);
    await ready(page);
    const after = await invoke<any>(page, 'report');
    expect(after.version).toEqual(before.version);
    expect(after.plan.style.background).toBe('#111827');
    await invoke(page, 'setPalette', ['#123456', '#abcdef']);
    await ready(page);
    const colored = await invoke<any>(page, 'report');
    expect(colored.version).toEqual(before.version);
    expect(colored.plan.scales[colored.plan.channels.color.fieldRef].range).toEqual(['#123456', '#abcdef']);
    await invoke(page, 'setBackend', true);
    await ready(page);
    await expect(page.locator('[data-renderer="native"] svg')).toHaveCount(1);
    expect((await invoke<any>(page, 'report')).version).toEqual(before.version);
    await invoke(page, 'setSize', 'auto', 420);
    await expect(page.locator('[data-renderer="native"]')).toHaveCSS('height', '420px');
});

test('pending and failed query snapshots block every legacy export and recover with a new version', async ({ page }) => {
    const version = (await invoke<any>(page, 'report')).version;
    await invoke(page, 'setLoading', true);
    await expect.poll(() => invoke(page, 'status')).toBe('computing');
    for (const name of ['export', 'download'])
        for (const format of ['svg', 'png']) {
            const message = await page.evaluate(
                async ({ name, format }) => {
                    try {
                        await (window as any).__nativeRenderer[name](format);
                        return 'unexpected success';
                    } catch (error) {
                        return String(error);
                    }
                },
                { name, format },
            );
            expect(message).toContain('still computing');
        }
    await expect(page.locator('[data-renderer="native"] [inert]')).toHaveCount(1);
    await invoke(page, 'setError', 'Remote query failed');
    await invoke(page, 'setLoading', false);
    await expect.poll(() => invoke(page, 'status')).toBe('error');
    await expect(page.getByRole('alert')).toContainText('Remote query failed');
    await invoke(page, 'setSnapshot', 2);
    await invoke(page, 'setError', undefined);
    await ready(page);
    expect((await invoke<any>(page, 'report')).version.snapshotId).toBe('2');
    expect((await invoke<any>(page, 'report')).version).not.toEqual(version);
    expect(await invoke<string[]>(page, 'export', 'svg')).toHaveLength(1);
});

test('actual pointer clicks retain coordinates and original values; keyboard and brush do not inherit them', async ({ page }) => {
    const color = (await invoke<any>(page, 'report')).plan.style.color ?? '#2563eb';
    const mark = page.locator(`[data-pane] rect[fill="${color}"]`).first(),
        box = await mark.boundingBox();
    expect(box).toBeTruthy();
    const x = box!.x + box!.width / 2,
        y = box!.y + box!.height / 2;
    await page.mouse.click(x, y);
    await expect.poll(async () => (await invoke<any[]>(page, 'events')).length).toBeGreaterThan(0);
    const clicked = (await invoke<any[]>(page, 'events')).at(-1);
    expect(clicked.source).toBe('pointer');
    expect(clicked.interaction).toMatchObject({ clientX: Math.round(x), clientY: Math.round(y) });
    expect(clicked.targets[0].values.every((value: any) => value.field.fid && value.configRef.startsWith('encodings.') && 'raw' in value)).toBe(true);
    const proxy = page.locator('[data-renderer="native"] div[role="button"][tabindex="0"]');
    await proxy.focus();
    await proxy.press('Enter');
    const keyboard = (await invoke<any[]>(page, 'events')).at(-1);
    expect(keyboard.source).toBe('keyboard');
    expect(keyboard.interaction).toBeUndefined();
    await page.keyboard.down('Shift');
    await page.mouse.move(x - 3, y - 3);
    await page.mouse.down();
    await page.mouse.move(x + 8, y + 8);
    await page.mouse.up();
    await page.keyboard.up('Shift');
    const brushed = (await invoke<any[]>(page, 'events')).at(-1);
    expect(brushed.source).toBe('pointer');
    expect(brushed.interaction).toBeUndefined();
});

test('unmount removes the controller and restores only the export handlers it owns', async ({ page }) => {
    await invoke(page, 'replaceExportHandler');
    await invoke(page, 'setMounted', false);
    await expect(page.locator('[data-renderer="native"]')).toHaveCount(0);
    expect(await invoke(page, 'hasRef')).toBe(false);
    expect((await invoke<any>(page, 'exportChart')).title).toBe('other-owner');
    await invoke(page, 'setMounted', true);
    await ready(page);
    await expect(scroller(page)).toHaveCount(1);
    expect((await invoke<any>(page, 'exportChart')).chartType).toBe('native');
});

test('header collapse and sorting commit a new prepared presentation without combining child values', async ({ page }) => {
    const before = (await invoke<any>(page, 'report')).version.presentationId;
    const proxy = page.locator('[data-renderer="native"] div[role="button"][tabindex="0"]');
    await proxy.focus();
    await proxy.press('h');
    await expect(proxy).toHaveAttribute('aria-expanded', 'true');
    await proxy.press('Enter');
    await ready(page);
    const collapsed = await invoke<any>(page, 'report');
    expect(collapsed.version.presentationId).not.toBe(before);
    expect(collapsed.diagnostics.some((item: any) => item.code === 'empty-parent-display')).toBe(true);
    await expect(proxy).toHaveAttribute('aria-expanded', 'false');
    await proxy.press('s');
    await ready(page);
    await expect.poll(async () => (await invoke<any>(page, 'report')).version.presentationId).not.toBe(collapsed.version.presentationId);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await proxy.press('Enter');
    await ready(page);
    await expect(proxy).toHaveAttribute('aria-expanded', 'true');
    expect((await invoke<any>(page, 'report')).diagnostics.some((item: any) => item.code === 'empty-parent-display')).toBe(false);
});
