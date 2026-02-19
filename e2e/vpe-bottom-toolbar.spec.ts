import { expect, test } from '@playwright/test';

const insertStarterTemplate = async (page: import('@playwright/test').Page) => {
  await page.getByTestId('toolbar-file-trigger').click();
  await page.getByTestId('toolbar-insert-starter-template').click();
  await expect(page.locator('[data-node-id="starter-sponsor"]')).toBeVisible();
};

test('desktop tray stays node-focused and excludes edge styling controls', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await insertStarterTemplate(page);

  const dock = page.getByTestId('bottom-tool-dock');
  await expect(dock).toBeVisible();
  await expect(dock.getByTestId('bottom-group-navigation')).toBeVisible();
  await expect(dock.getByTestId('bottom-group-creation')).toBeVisible();
  await expect(dock.getByTestId('bottom-group-view')).toBeVisible();
  await expect(dock.getByTestId('bottom-group-utility')).toBeVisible();

  const groupOrder = await dock.locator('[data-testid^="bottom-group-"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-testid'))
  );
  expect(groupOrder).toEqual([
    'bottom-group-navigation',
    'bottom-group-creation',
    'bottom-group-view',
    'bottom-group-utility'
  ]);

  const zoomTrigger = page.getByTestId('bottom-zoom-menu-trigger');
  const zoomMenu = page.locator('#bottom-zoom-menu');
  await zoomTrigger.click();
  await expect(zoomMenu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(zoomMenu).toBeHidden();
  await zoomTrigger.click();
  await expect(zoomMenu).toBeVisible();
  await page.mouse.click(600, 260);
  await expect(zoomMenu).toBeHidden();

  await page.getByTestId('toolbar-insert-connector').click();
  await expect(page.getByTestId('selection-action-tray')).toHaveCount(0);
  await expect(page.locator('button[title="straight edge path"]')).toHaveCount(0);

  await page.getByTestId('bottom-tool-hand').click();
  await expect(page.getByTestId('bottom-tool-hand')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('selection-action-tray')).toHaveCount(0);

  await page.getByTestId('bottom-tool-select').click();
  await expect(page.getByTestId('bottom-tool-select')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('selection-action-tray')).toHaveCount(0);

  await page.locator('[data-node-id="starter-sponsor"]').click();
  await page.keyboard.down('Shift');
  await page.locator('[data-node-id="starter-processor"]').click();
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('selection-action-tray')).toBeVisible();
  await expect(page.locator('button[title="dashed line style"]')).toHaveCount(0);
});

test('mobile bottom more-actions stays node-focused with no edge style controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await insertStarterTemplate(page);

  await page.getByTestId('bottom-tool-hand').click();
  await expect(page.getByTestId('bottom-tool-hand')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('bottom-more-actions')).toHaveCount(0);

  await page.getByTestId('bottom-tool-select').click();
  await page.locator('[data-node-id="starter-sponsor"]').click();
  const moreButton = page.getByTestId('bottom-more-actions');
  await expect(moreButton).toBeVisible();
  await expect(page.getByTestId('bottom-group-utility')).toBeVisible();
  await moreButton.click();

  const overflow = page.getByTestId('bottom-overflow-sheet');
  await expect(overflow).toBeVisible();
  await expect(overflow.locator('button[title="Duplicate selected nodes"]')).toBeVisible();
  await expect(overflow.locator('button[title="dashed line style"]')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await page.getByTestId('toolbar-insert-connector').click();
  await expect(page.getByTestId('bottom-more-actions')).toHaveCount(0);
});

test('mobile 320px dock stays in viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await insertStarterTemplate(page);

  await page.locator('[data-node-id="starter-sponsor"]').click();
  const dock = page.getByTestId('bottom-tool-dock');
  await expect(dock).toBeVisible();

  const dockBox = await dock.boundingBox();
  expect(dockBox).toBeTruthy();
  if (dockBox) {
    expect(dockBox.x).toBeGreaterThanOrEqual(0);
    expect(dockBox.x + dockBox.width).toBeLessThanOrEqual(320);
  }

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);

  const moreButton = page.getByTestId('bottom-more-actions');
  await expect(moreButton).toBeVisible();
  await moreButton.click();
  await expect(page.getByTestId('bottom-overflow-sheet')).toBeVisible();
});
