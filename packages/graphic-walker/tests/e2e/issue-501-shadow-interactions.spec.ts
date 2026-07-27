import { expect, test, type Page } from '@playwright/test';
import {
    expectClose,
    expectOverlayInHost,
    openDataTable,
    openFilterDialog,
    readOverlayGeometry,
    waitForAnimations,
} from './issue-501.helpers';

async function moveMouseInSteps(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps: number
) {
    for (let index = 1; index <= steps; index += 1) {
        const progress = index / steps;
        await page.mouse.move(from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress);
        await page.waitForTimeout(10);
    }
}

test('ActionMenu and drag/drop keep their nearer FieldsContext coordinates', async ({ page }, testInfo) => {
    await page.goto('/tests/e2e/issue-501.html?scale=1');
    await expect(page.locator('body')).toHaveAttribute('data-repro-ready', 'true');

    await page.evaluate(() => {
        window.scrollTo(240, 320);
        document.querySelector<HTMLElement>('#host-scroll')!.scrollTo(48, 72);
    });

    const shadowHost = page.locator('#root > div');
    const category = shadowHost.locator('[data-rbd-draggable-id="dimension_category"]');
    await expect(category).toBeVisible();

    const actionButton = category.locator('[aria-haspopup="menu"]');
    await actionButton.click();

    const actionMenu = page.getByRole('menu');
    await expect(actionMenu).toBeVisible();
    await waitForAnimations(actionMenu);

    const buttonRect = await actionButton.boundingBox();
    const menuRect = await actionMenu.boundingBox();
    expect(buttonRect).not.toBeNull();
    expect(menuRect).not.toBeNull();
    expectClose(menuRect!.x, buttonRect!.x + buttonRect!.width);
    expectClose(menuRect!.y, buttonRect!.y + 2);

    await page.keyboard.press('Escape');
    await expect(actionMenu).toBeHidden();

    const sourceRect = await category.boundingBox();
    const target = shadowHost.locator('[data-rbd-droppable-id="columns"]');
    const targetRect = await target.boundingBox();
    expect(sourceRect).not.toBeNull();
    expect(targetRect).not.toBeNull();

    const start = {
        x: sourceRect!.x + 24,
        y: sourceRect!.y + sourceRect!.height / 2,
    };
    const destination = {
        x: targetRect!.x + targetRect!.width / 2,
        y: targetRect!.y + targetRect!.height / 2,
    };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const lifted = { x: start.x + 18, y: start.y + 2 };
    await moveMouseInSteps(page, start, lifted, 8);

    await expect
        .poll(() =>
            page.evaluate(() => {
                const shadowRoot = document.querySelector<HTMLElement>('#root > div')!.shadowRoot!;
                return [...shadowRoot.querySelectorAll<HTMLElement>('[data-rbd-draggable-id]')].some(
                    (element) => getComputedStyle(element).position === 'fixed'
                );
            })
        )
        .toBe(true);

    const dragGeometry = await page.evaluate(
        ({ pointerX, pointerY }) => {
            const shadowRoot = document.querySelector<HTMLElement>('#root > div')!.shadowRoot!;
            const clone = [...shadowRoot.querySelectorAll<HTMLElement>('[data-rbd-draggable-id]')].find(
                (element) => getComputedStyle(element).position === 'fixed'
            )!;
            return {
                pointer: { x: pointerX, y: pointerY },
                clone: HTMLElement.prototype.getBoundingClientRect.call(clone).toJSON(),
            };
        },
        { pointerX: lifted.x, pointerY: lifted.y }
    );
    await testInfo.attach('drag-clone-geometry', {
        body: JSON.stringify(dragGeometry, null, 2),
        contentType: 'application/json',
    });
    expect(dragGeometry.pointer.x).toBeGreaterThan(dragGeometry.clone.left);
    expect(dragGeometry.pointer.x).toBeLessThan(dragGeometry.clone.right);
    expect(dragGeometry.pointer.y).toBeGreaterThan(dragGeometry.clone.top);
    expect(dragGeometry.pointer.y).toBeLessThan(dragGeometry.clone.bottom);

    await moveMouseInSteps(page, lifted, destination, 24);
    await page.waitForTimeout(150);
    await testInfo.attach('drop-target-geometry', {
        body: JSON.stringify(
            {
                target: await target.boundingBox(),
                targetTextBeforeDrop: await target.textContent(),
                pointer: destination,
            },
            null,
            2
        ),
        contentType: 'application/json',
    });
    await page.mouse.up();

    await expect(target).toContainText('Category');
});

test('full-viewport layout preserves the viewport baseline', async ({ page }) => {
    const shadowHost = await openDataTable(page, 'fullscreen=1');
    await openFilterDialog(page, shadowHost);

    const geometry = await readOverlayGeometry(page);
    expectOverlayInHost(geometry);
    const viewport = page.viewportSize()!;

    expectClose(geometry.host.left, 0);
    expectClose(geometry.host.top, 0);
    expectClose(geometry.host.width, viewport.width);
    expectClose(geometry.host.height, viewport.height);
});

test('the toolbar-sized DataSource host keeps its dialog viewport-relative', async ({ page }) => {
    await page.goto('/tests/e2e/issue-501.html?mode=data-source');
    await expect(page.locator('body')).toHaveAttribute('data-repro-ready', 'true');

    const shadowHost = page.locator('#root > div');
    await expect(shadowHost).toHaveCSS('contain', 'none');
    await page.getByRole('button', { name: 'Create Dataset' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await waitForAnimations(dialog);

    const geometry = await readOverlayGeometry(page);
    const viewport = page.viewportSize()!;
    expect(geometry.host.height).toBeLessThan(geometry.dialog.height);
    expectClose(geometry.overlay.left, 0);
    expectClose(geometry.overlay.top, 0);
    expectClose(geometry.overlay.width, viewport.width);
    expectClose(geometry.overlay.height, viewport.height);
    expectClose(geometry.dialog.left + geometry.dialog.width / 2, viewport.width / 2);
    expectClose(geometry.dialog.top + geometry.dialog.height / 2, viewport.height / 2);
    expect(geometry.dialog.top).toBeGreaterThanOrEqual(0);
    expect(geometry.dialog.bottom).toBeLessThanOrEqual(viewport.height);
});

test('caller style.contain can opt a GraphicWalker host out', async ({ page }) => {
    const shadowHost = await openDataTable(page, 'contain=none');
    await expect(shadowHost).toHaveCSS('contain', 'none');
    await openFilterDialog(page, shadowHost);

    const geometry = await readOverlayGeometry(page);
    const viewport = page.viewportSize()!;
    expect(geometry.contain).toBe('none');
    expectClose(geometry.overlay.left, 0);
    expectClose(geometry.overlay.top, 0);
    expectClose(geometry.overlay.width, viewport.width);
    expectClose(geometry.overlay.height, viewport.height);
});

test('GraphicRenderer forwards its public className and style to the shadow host', async ({ page }) => {
    await page.goto('/tests/e2e/issue-501.html?mode=renderer&contain=none');
    await expect(page.locator('body')).toHaveAttribute('data-repro-ready', 'true');

    const shadowHost = page.locator('#root > div');
    await expect(shadowHost).toHaveClass(/issue-501-renderer-host/);
    await expect(shadowHost).toHaveCSS('contain', 'none');
});
