import { expect, test } from '@playwright/test';

const CANVAS_SELECTOR = '[data-testid="canvas-dropzone"]';

const rightClickNodeById = async (page: import('@playwright/test').Page, nodeId: string) => {
  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  if (!box) throw new Error(`Node bounds unavailable for ${nodeId}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
};

const rightClickCanvasBlank = async (
  page: import('@playwright/test').Page,
  offset?: { x: number; y: number }
) => {
  const canvas = page.locator(CANVAS_SELECTOR);
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounds unavailable');
  const point = offset
    ? { x: box.x + offset.x, y: box.y + offset.y }
    : { x: box.x + box.width - 44, y: box.y + box.height - 44 };
  await page.mouse.click(point.x, point.y, { button: 'right' });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.waitForLoadState('networkidle');
});

test('node context menu supports start connection and duplicate', async ({ page }) => {
  const initialNodeCount = await page.locator('[data-node-id]').count();

  await rightClickNodeById(page, 'starter-sponsor');
  const nodeMenu = page.getByTestId('node-context-menu');
  await expect(nodeMenu).toBeVisible();

  await nodeMenu.getByTestId('context-menu-start-connect').click();
  await expect(page.getByRole('button', { name: 'Connect tool' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('cancel-pending-connection')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('cancel-pending-connection')).toHaveCount(0);

  await rightClickNodeById(page, 'starter-sponsor');
  await expect(nodeMenu).toBeVisible();
  await nodeMenu.getByTestId('context-menu-duplicate-node').click();

  await expect.poll(async () => page.locator('[data-node-id]').count()).toBe(initialNodeCount + 1);
});

test('canvas context menu can add nodes', async ({ page }) => {
  const initialNodeCount = await page.locator('[data-node-id]').count();

  await rightClickCanvasBlank(page);
  const canvasMenu = page.getByTestId('canvas-context-menu');
  await expect(canvasMenu).toBeVisible();

  await canvasMenu.getByTestId('context-menu-add-sponsor').click();
  await expect.poll(async () => page.locator('[data-node-id]').count()).toBe(initialNodeCount + 1);

  await rightClickCanvasBlank(page, { x: 110, y: 110 });
  await expect(canvasMenu).toBeVisible();
  await canvasMenu.getByTestId('context-menu-fit-view').click();
  await expect(canvasMenu).toHaveCount(0);
});
