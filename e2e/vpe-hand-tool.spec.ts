import { expect, test } from '@playwright/test';

const CANVAS_SELECTOR = '[data-testid="canvas-dropzone"]';
const WORLD_LAYER_SELECTOR = `${CANVAS_SELECTOR} div.absolute.inset-0`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.waitForLoadState('networkidle');
});

test('keyboard shortcut switches to hand tool', async ({ page }) => {
  const handTool = page.getByRole('button', { name: 'Hand tool' });
  await expect(handTool).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('h');
  await expect(handTool).toHaveAttribute('aria-pressed', 'true');
});

test('hand tool pans canvas without holding space', async ({ page }) => {
  const handTool = page.getByRole('button', { name: 'Hand tool' });
  await handTool.click();
  await expect(handTool).toHaveAttribute('aria-pressed', 'true');

  const canvas = page.locator(CANVAS_SELECTOR);
  const worldLayer = page.locator(WORLD_LAYER_SELECTOR).first();
  const before = await worldLayer.getAttribute('style');

  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounds unavailable');

  await page.mouse.move(box.x + box.width - 180, box.y + box.height - 150);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 60, box.y + box.height - 70);
  await page.mouse.up();

  await expect.poll(async () => worldLayer.getAttribute('style')).not.toBe(before);
});
