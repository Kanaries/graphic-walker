import { expect, test } from '@playwright/test';
import {
    expectClose,
    expectOverlayInHost,
    openDataTable,
    openFilterDialog,
    readOverlayGeometry,
    selectTab,
    waitForAnimations,
} from './issue-501.helpers';

for (const scale of [1, 0.8]) {
    test(`dialog, dropdown, and open-dialog scrolling stay in the shadow host at scale ${scale}`, async ({ page }, testInfo) => {
        const shadowHost = await openDataTable(page, `scale=${scale}`);

        await page.evaluate(() => {
            window.scrollTo(240, 320);
            document.querySelector<HTMLElement>('#host-scroll')!.scrollTo(48, 72);
        });

        const semanticTypeTrigger = shadowHost.locator('thead span.cursor-pointer').first();
        await semanticTypeTrigger.click();

        const menu = page.getByRole('menu');
        await expect(menu).toBeVisible();
        await waitForAnimations(menu);

        const triggerRect = await semanticTypeTrigger.boundingBox();
        const menuRect = await menu.boundingBox();
        expect(triggerRect).not.toBeNull();
        expect(menuRect).not.toBeNull();
        expectClose(menuRect!.x, triggerRect!.x);
        expectClose(menuRect!.y, triggerRect!.y + triggerRect!.height + 4 * scale);
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();

        await openFilterDialog(page, shadowHost);

        const initialGeometry = await readOverlayGeometry(page);
        await testInfo.attach('initial-overlay-geometry', {
            body: JSON.stringify(initialGeometry, null, 2),
            contentType: 'application/json',
        });
        expectOverlayInHost(initialGeometry);

        await page.evaluate(() => {
            window.scrollBy(75, 90);
            document.querySelector<HTMLElement>('#host-scroll')!.scrollBy(24, 36);
        });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

        const scrolledGeometry = await readOverlayGeometry(page);
        await testInfo.attach('scrolled-overlay-geometry', {
            body: JSON.stringify(scrolledGeometry, null, 2),
            contentType: 'application/json',
        });
        expectOverlayInHost(scrolledGeometry);
        expect(Math.abs(scrolledGeometry.host.left - initialGeometry.host.left)).toBeGreaterThan(1);
        expect(Math.abs(scrolledGeometry.host.top - initialGeometry.host.top)).toBeGreaterThan(1);
    });
}

test('narrow host keeps real filter and visual-config dialogs bounded, scrollable, and closable', async ({ page }, testInfo) => {
    const shadowHost = await openDataTable(page, 'hostWidth=520&hostHeight=380');
    await openFilterDialog(page, shadowHost);

    const filterGeometry = await readOverlayGeometry(page);
    expectOverlayInHost(filterGeometry);

    const filterDialog = page.getByRole('dialog');
    const filterEvidence = await filterDialog.evaluate(async (dialog) => {
        const scrollArea = dialog.firstElementChild as HTMLElement;
        const closeButton = [...dialog.querySelectorAll<HTMLButtonElement>('button')].at(-1)!;
        const before = {
            close: closeButton.getBoundingClientRect().toJSON(),
            clientHeight: scrollArea.clientHeight,
            scrollHeight: scrollArea.scrollHeight,
            scrollTop: scrollArea.scrollTop,
        };
        scrollArea.scrollTop = scrollArea.scrollHeight;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return {
            before,
            after: {
                close: closeButton.getBoundingClientRect().toJSON(),
                scrollTop: scrollArea.scrollTop,
            },
        };
    });
    await testInfo.attach('narrow-filter-dialog', {
        body: JSON.stringify({ geometry: filterGeometry, scroll: filterEvidence }, null, 2),
        contentType: 'application/json',
    });
    expect(filterEvidence.before.scrollHeight).toBeGreaterThan(filterEvidence.before.clientHeight);
    expect(filterEvidence.after.scrollTop).toBeGreaterThan(0);
    expectClose(filterEvidence.after.close.top, filterEvidence.before.close.top);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(filterDialog).toBeHidden();

    await selectTab(page, 'Visualization');
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (
                        window as Window & {
                            __issue501OpenVisualConfig?: () => boolean;
                        }
                    ).__issue501OpenVisualConfig?.() ?? false
            )
        )
        .toBe(true);

    const visualConfigDialog = page.getByRole('dialog');
    await expect(visualConfigDialog).toBeVisible();
    await waitForAnimations(visualConfigDialog);

    const visualConfigGeometry = await readOverlayGeometry(page);
    expectOverlayInHost(visualConfigGeometry);
    const visualConfigEvidence = await visualConfigDialog.evaluate(async (dialog) => {
        const outerScroll = dialog.firstElementChild as HTMLElement;
        const panel = outerScroll.firstElementChild as HTMLElement;
        const innerScroll = panel.querySelector<HTMLElement>('.overflow-y-auto')!;
        const closeButton = [...dialog.querySelectorAll<HTMLButtonElement>('button')].at(-1)!;
        const confirmButton = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Confirm')!;
        const before = {
            outerClientHeight: outerScroll.clientHeight,
            outerScrollHeight: outerScroll.scrollHeight,
            outerScrollTop: outerScroll.scrollTop,
            innerClientHeight: innerScroll.clientHeight,
            innerScrollHeight: innerScroll.scrollHeight,
            innerScrollTop: innerScroll.scrollTop,
            panelMaxHeight: getComputedStyle(panel).maxHeight,
            close: closeButton.getBoundingClientRect().toJSON(),
            footerButton: confirmButton.getBoundingClientRect().toJSON(),
        };
        innerScroll.scrollTop = innerScroll.scrollHeight;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return {
            before,
            after: {
                outerScrollTop: outerScroll.scrollTop,
                innerScrollTop: innerScroll.scrollTop,
                close: closeButton.getBoundingClientRect().toJSON(),
                footerButton: confirmButton.getBoundingClientRect().toJSON(),
            },
        };
    });
    await testInfo.attach('narrow-visual-config-dialog', {
        body: JSON.stringify({ geometry: visualConfigGeometry, scroll: visualConfigEvidence }, null, 2),
        contentType: 'application/json',
    });
    expect(visualConfigEvidence.before.outerScrollHeight).toBeLessThanOrEqual(visualConfigEvidence.before.outerClientHeight + 1);
    expect(visualConfigEvidence.before.innerScrollHeight).toBeGreaterThan(visualConfigEvidence.before.innerClientHeight);
    expect(visualConfigEvidence.after.outerScrollTop).toBe(0);
    expect(visualConfigEvidence.after.innerScrollTop).toBeGreaterThan(0);
    expectClose(visualConfigEvidence.after.close.top, visualConfigEvidence.before.close.top);
    expectClose(visualConfigEvidence.after.footerButton.top, visualConfigEvidence.before.footerButton.top);
    expect(visualConfigEvidence.after.footerButton.bottom).toBeLessThanOrEqual(visualConfigGeometry.dialog.bottom + 1.5);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(visualConfigDialog).toBeHidden();
});

test('a host taller than the viewport keeps its dialog reachable by page scroll', async ({ page }, testInfo) => {
    const shadowHost = await openDataTable(page, 'hostHeight=2400');
    await openFilterDialog(page, shadowHost);

    // Radix focuses into the dialog and the browser may scroll it into view automatically.
    // Reset to a known page position so the explicit reachability scroll below is deterministic.
    await page.evaluate(() => window.scrollTo(240, 320));
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    const initialGeometry = await readOverlayGeometry(page);
    expectOverlayInHost(initialGeometry);
    const closeButton = page.getByRole('button', { name: 'Close' });
    const readCloseRect = () =>
        page.evaluate(() => {
            const host = document.querySelector<HTMLElement>('#root > div')!;
            const dialog = host.shadowRoot!.querySelector<HTMLElement>('[role="dialog"]')!;
            return [...dialog.querySelectorAll<HTMLButtonElement>('button')].at(-1)!.getBoundingClientRect().toJSON();
        });
    const initialClose = await readCloseRect();
    expect(initialClose.top).toBeGreaterThan(page.viewportSize()!.height);

    await page.evaluate((scrollBy) => window.scrollBy(0, scrollBy), initialGeometry.dialog.top - 120);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    const scrolledGeometry = await readOverlayGeometry(page);
    const scrolledClose = await readCloseRect();
    expectOverlayInHost(scrolledGeometry);
    expect(scrolledClose.top).toBeGreaterThanOrEqual(0);
    expect(scrolledClose.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
    await testInfo.attach('tall-host-dialog', {
        body: JSON.stringify({ initial: { geometry: initialGeometry, close: initialClose }, scrolled: { geometry: scrolledGeometry, close: scrolledClose } }, null, 2),
        contentType: 'application/json',
    });

    await closeButton.click();
    await expect(page.getByRole('dialog')).toBeHidden();
});
