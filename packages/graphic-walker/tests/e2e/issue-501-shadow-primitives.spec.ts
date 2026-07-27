import { expect, test, type Locator } from '@playwright/test';
import { expectClose, expectOverlayInHost, readOverlayGeometry, waitForAnimations } from './issue-501.helpers';

async function rect(locator: Locator) {
    const value = await locator.boundingBox();
    expect(value).not.toBeNull();
    return value!;
}

test('all shared fixed-position UI primitives use the scaled shadow-host coordinates', async ({ page }, testInfo) => {
    await page.goto('/tests/e2e/issue-501.html?mode=primitives&scale=0.8');
    await expect(page.locator('body')).toHaveAttribute('data-repro-ready', 'true');

    const host = page.locator('#root > div');
    await expect(host).toHaveCSS('contain', 'layout');
    const evidence: Record<string, unknown> = {};

    await page.getByTestId('normal-dialog-trigger').click();
    const normalDialog = page.getByTestId('normal-dialog-content');
    await expect(normalDialog).toBeVisible();
    await waitForAnimations(normalDialog);
    const dialogGeometry = await readOverlayGeometry(page);
    expectOverlayInHost(dialogGeometry);
    evidence.dialog = dialogGeometry;
    await page.keyboard.press('Escape');
    await expect(normalDialog).toBeHidden();

    const popoverTrigger = page.getByTestId('popover-trigger');
    await popoverTrigger.click();
    const popoverContent = page.getByTestId('popover-content');
    await expect(popoverContent).toBeVisible();
    await waitForAnimations(popoverContent);
    const popoverTriggerRect = await rect(popoverTrigger);
    const popoverContentRect = await rect(popoverContent);
    expectClose(popoverContentRect.x + popoverContentRect.width / 2, popoverTriggerRect.x + popoverTriggerRect.width / 2);
    expectClose(popoverContentRect.y, popoverTriggerRect.y + popoverTriggerRect.height + 4 * 0.8);
    evidence.popover = { trigger: popoverTriggerRect, content: popoverContentRect };
    await page.keyboard.press('Escape');
    await expect(popoverContent).toBeHidden();

    const selectTrigger = page.getByTestId('select-trigger');
    await selectTrigger.click();
    const selectContent = page.getByTestId('select-content');
    await expect(selectContent).toBeVisible();
    await waitForAnimations(selectContent);
    const selectTriggerRect = await rect(selectTrigger);
    const selectContentRect = await rect(selectContent);
    expectClose(selectContentRect.x, selectTriggerRect.x, 2);
    expect(selectContentRect.y).toBeGreaterThanOrEqual(selectTriggerRect.y + selectTriggerRect.height - 2);
    expect(selectContentRect.y - (selectTriggerRect.y + selectTriggerRect.height)).toBeLessThanOrEqual(12);
    evidence.select = { trigger: selectTriggerRect, content: selectContentRect };
    await page.keyboard.press('Escape');
    await expect(selectContent).toBeHidden();

    const contextTrigger = page.getByTestId('context-trigger');
    const contextTriggerRect = await rect(contextTrigger);
    const contextPoint = {
        x: contextTriggerRect.x + contextTriggerRect.width / 2,
        y: contextTriggerRect.y + contextTriggerRect.height / 2,
    };
    await page.mouse.click(contextPoint.x, contextPoint.y, { button: 'right' });
    const contextContent = page.getByTestId('context-content');
    await expect(contextContent).toBeVisible();
    await waitForAnimations(contextContent);
    const contextContentRect = await rect(contextContent);
    expectClose(contextContentRect.x, contextPoint.x, 2);
    expectClose(contextContentRect.y, contextPoint.y, 2);
    evidence.contextMenu = { point: contextPoint, content: contextContentRect };
    await page.keyboard.press('Escape');
    await expect(contextContent).toBeHidden();

    const hoverTrigger = page.getByTestId('hover-trigger');
    await hoverTrigger.hover();
    const hoverContent = page.getByTestId('hover-content');
    await expect(hoverContent).toBeVisible();
    await waitForAnimations(hoverContent);
    const hoverTriggerRect = await rect(hoverTrigger);
    const hoverContentRect = await rect(hoverContent);
    expectClose(hoverContentRect.x + hoverContentRect.width / 2, hoverTriggerRect.x + hoverTriggerRect.width / 2);
    expectClose(hoverContentRect.y, hoverTriggerRect.y + hoverTriggerRect.height + 4 * 0.8);
    evidence.hoverCard = { trigger: hoverTriggerRect, content: hoverContentRect };

    const tooltipTrigger = page.getByTestId('tooltip-trigger');
    await tooltipTrigger.hover();
    await expect(hoverContent).toBeHidden();
    const tooltipContent = page.getByTestId('tooltip-content');
    await expect(tooltipContent).toBeVisible();
    await waitForAnimations(tooltipContent);
    const tooltipTriggerRect = await rect(tooltipTrigger);
    const tooltipContentRect = await rect(tooltipContent);
    const tooltipBottom = tooltipContentRect.y + tooltipContentRect.height;
    expectClose(tooltipContentRect.x + tooltipContentRect.width / 2, tooltipTriggerRect.x + tooltipTriggerRect.width / 2);
    expect(tooltipBottom).toBeLessThanOrEqual(tooltipTriggerRect.y + 2);
    expect(tooltipTriggerRect.y - tooltipBottom).toBeLessThanOrEqual(12);
    evidence.tooltip = { trigger: tooltipTriggerRect, content: tooltipContentRect };

    await testInfo.attach('primitive-geometries', {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json',
    });
});
