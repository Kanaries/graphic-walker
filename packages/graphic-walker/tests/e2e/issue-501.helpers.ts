import { expect, type Locator, type Page } from '@playwright/test';

export type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
};

export type OverlayGeometry = {
    contain: string;
    host: Rect;
    overlay: Rect;
    dialog: Rect;
};

export async function waitForAnimations(locator: Locator) {
    await locator.evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    });
}

export async function openDataTable(page: Page, query: string) {
    await page.goto(`/tests/e2e/issue-501.html?${query}`);
    await expect(page.locator('body')).toHaveAttribute('data-repro-ready', 'true');
    await selectTab(page, 'Data');

    const shadowHost = page.locator('#root > div');
    await expect(shadowHost.locator('tbody tr').first()).toBeVisible();

    return shadowHost;
}

export async function selectTab(page: Page, name: string) {
    const tab = page.getByRole('tab', { name });
    await expect(tab).toBeVisible();
    await expect
        .poll(async () => {
            if ((await tab.getAttribute('aria-selected')) !== 'true') {
                await tab.click();
            }
            return tab.getAttribute('aria-selected');
        })
        .toBe('true');
}

export async function openFilterDialog(page: Page, shadowHost: Locator) {
    const header = shadowHost.locator('thead th').first();
    await header.hover();
    await header.locator('div.group > div').last().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await waitForAnimations(dialog);
    return dialog;
}

export async function readOverlayGeometry(page: Page): Promise<OverlayGeometry> {
    return page.evaluate(() => {
        const host = document.querySelector<HTMLElement>('#root > div')!;
        const dialog = host.shadowRoot!.querySelector<HTMLElement>('[role="dialog"]')!;
        const overlay = dialog.previousElementSibling as HTMLElement;

        return {
            contain: getComputedStyle(host).contain,
            host: host.getBoundingClientRect().toJSON(),
            overlay: overlay.getBoundingClientRect().toJSON(),
            dialog: dialog.getBoundingClientRect().toJSON(),
        };
    });
}

export function expectClose(actual: number, expected: number, tolerance = 1.5) {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

export function expectOverlayInHost(geometry: OverlayGeometry) {
    const tolerance = 1.5;
    expect(geometry.contain).toContain('layout');
    expectClose(geometry.overlay.left, geometry.host.left);
    expectClose(geometry.overlay.top, geometry.host.top);
    expectClose(geometry.overlay.width, geometry.host.width);
    expectClose(geometry.overlay.height, geometry.host.height);

    const hostCenter = {
        x: geometry.host.left + geometry.host.width / 2,
        y: geometry.host.top + geometry.host.height / 2,
    };
    const dialogCenter = {
        x: geometry.dialog.left + geometry.dialog.width / 2,
        y: geometry.dialog.top + geometry.dialog.height / 2,
    };

    expectClose(dialogCenter.x, hostCenter.x);
    expectClose(dialogCenter.y, hostCenter.y);
    expect(geometry.dialog.left).toBeGreaterThanOrEqual(geometry.host.left - tolerance);
    expect(geometry.dialog.right).toBeLessThanOrEqual(geometry.host.right + tolerance);
    expect(geometry.dialog.top).toBeGreaterThanOrEqual(geometry.host.top - tolerance);
    expect(geometry.dialog.bottom).toBeLessThanOrEqual(geometry.host.bottom + tolerance);
}
