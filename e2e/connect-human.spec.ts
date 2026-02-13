import { expect, test, type Download, type Page } from '@playwright/test';

const EDGE_SELECTOR = 'svg g.cursor-pointer.group';
const CANVAS_SELECTOR = '[data-testid="canvas-dropzone"]';

const countEdges = async (page: Page) => page.locator(EDGE_SELECTOR).count();

const getNodeCenter = async (page: Page, nodeId: string) => {
  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
  const box = await node.boundingBox();
  if (!box) throw new Error(`Could not find node: ${nodeId}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const clickNodeBody = async (page: Page, nodeId: string) => {
  const { x, y } = await getNodeCenter(page, nodeId);
  await page.mouse.click(x, y);
};

const readDownloadText = async (download: Download): Promise<string> => {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Could not read download stream.');

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const panCanvas = async (page: Page) => {
  const canvas = page.locator(CANVAS_SELECTOR);
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found.');

  await page.keyboard.down('Space');
  await page.mouse.move(box.x + 320, box.y + 220);
  await page.mouse.down();
  await page.mouse.move(box.x + 430, box.y + 300);
  await page.mouse.up();
  await page.keyboard.up('Space');
};

const exportDiagramText = async (page: Page) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export JSON/i }).click()
  ]);
  return readDownloadText(download);
};

const importDiagramText = async (page: Page, jsonText: string) => {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import JSON/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'connect-human.json',
    mimeType: 'application/json',
    buffer: Buffer.from(jsonText, 'utf8')
  });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.waitForLoadState('networkidle');
});

test('connect tool: node-body click path creates an edge', async ({ page }) => {
  const before = await countEdges(page);

  await page.getByRole('button', { name: 'Connect tool' }).click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');

  await expect.poll(async () => countEdges(page)).toBe(before + 1);
});

test('connect tool: port-click path creates an edge', async ({ page }) => {
  const before = await countEdges(page);

  await page.getByRole('button', { name: 'Connect tool' }).click();
  await page.getByTestId('node-port-starter-sponsor-1').click();
  await page.getByTestId('node-port-starter-network-3').click();

  await expect.poll(async () => countEdges(page)).toBe(before + 1);
});

test('select tool: clicking nodes does not create edges', async ({ page }) => {
  const before = await countEdges(page);

  await page.getByRole('button', { name: 'Select tool' }).click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');

  await expect.poll(async () => countEdges(page)).toBe(before);
});

test('escape clears pending connect state', async ({ page }) => {
  const before = await countEdges(page);

  await page.getByRole('button', { name: 'Connect tool' }).click();
  await clickNodeBody(page, 'starter-sponsor');
  await page.keyboard.press('Escape');
  await clickNodeBody(page, 'starter-network');

  await expect.poll(async () => countEdges(page)).toBe(before);
});

test('edge interactions remain reachable after reset, import, and pan', async ({ page }) => {
  const baseline = await countEdges(page);

  await page.getByRole('button', { name: 'Connect tool' }).click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);

  const exportedText = await exportDiagramText(page);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('toolbar-reset-canvas').click();
  await expect.poll(async () => countEdges(page)).toBe(baseline);

  await page.getByRole('button', { name: 'Connect tool' }).click();
  await page.getByTestId('node-port-starter-sponsor-1').click();
  await page.getByTestId('node-port-starter-network-3').click();
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);

  await importDiagramText(page, exportedText);
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);

  await panCanvas(page);

  await page.getByRole('button', { name: 'Connect tool' }).click();
  await page.getByTestId('node-port-starter-sponsor-1').click();
  await page.getByTestId('node-port-starter-network-3').click();
  await expect.poll(async () => countEdges(page)).toBe(baseline + 2);
});

test('undo reverts graph edit while preserving camera transform', async ({ page }) => {
  const baseline = await countEdges(page);

  await page.getByRole('button', { name: 'Connect tool' }).click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);

  await panCanvas(page);

  const worldLayer = page.locator(`${CANVAS_SELECTOR} div.absolute.inset-0`).first();
  const transformBeforeUndo = await worldLayer.getAttribute('style');

  await page.locator('button[title="Undo"]').click();

  await expect.poll(async () => countEdges(page)).toBe(baseline);
  await expect(worldLayer).toHaveAttribute('style', transformBeforeUndo || '');
});

test('edge style controls remain enabled for selected edge', async ({ page }) => {
  await page.getByRole('button', { name: 'Connect tool' }).click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');

  const dashedButton = page.locator('button[title="dashed line style"]');
  await expect(dashedButton).toBeEnabled();

  await dashedButton.click();
  await expect(dashedButton).toHaveAttribute('aria-pressed', 'true');
});
