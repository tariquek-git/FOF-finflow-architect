import { expect, test, type Download, type Page } from '@playwright/test';
import { insertStarterTemplate, openFileMenu } from './helpers/diagramSetup';

const readDownloadText = async (download: Download): Promise<string> => {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Could not read download stream.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const exportDiagramText = async (page: Page) => {
  const menu = await openFileMenu(page);
  const [download] = await Promise.all([page.waitForEvent('download'), menu.getByTestId('toolbar-export-json').click()]);
  return readDownloadText(download);
};

const clickCanvasBlank = async (page: Page) => {
  const canvas = page.getByTestId('canvas-dropzone');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounds unavailable');
  await page.mouse.click(box.x + box.width * 0.5, box.y + 24);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await insertStarterTemplate(page);
});

test('pilot: edge selection stays stable when using inspector + menus', async ({ page }) => {
  await page.getByTestId('edge-starter-edge-1').click();
  await expect(page.getByTestId('inspector-mode-title')).toContainText('Edge');

  // Change a styling option in the inspector and ensure selection does not drop.
  const inspector = page.getByTestId('inspector-scroll-body');
  await inspector.getByRole('button', { name: 'Straight' }).click();
  await expect(page.getByTestId('inspector-mode-title')).toContainText('Edge');

  const notes = page.locator('#edge-field-notes');
  await expect(notes).toBeVisible();
  await notes.fill('Pilot note: edge selection should persist.');
  await notes.blur();
  await expect(page.getByTestId('inspector-mode-title')).toContainText('Edge');

  // Open/close View menu and toggle Grid without losing edge selection.
  const viewTrigger = page.getByTestId('toolbar-view-trigger').first();
  await viewTrigger.click();
  const viewMenu = page.getByTestId('toolbar-view-menu').first();
  await expect(viewMenu).toBeVisible();
  await viewMenu.getByTestId('toolbar-view-grid').click();
  await expect(viewMenu).not.toBeVisible();
  await expect(page.getByTestId('inspector-mode-title')).toContainText('Edge');

  // Export and confirm the edge includes the chosen pathType and notes.
  const payloadText = await exportDiagramText(page);
  const payload = JSON.parse(payloadText) as {
    diagram?: { edges?: Array<{ id?: string; pathType?: string; data?: { notes?: string } }> };
  };
  const edge = payload.diagram?.edges?.find((candidate) => candidate.id === 'starter-edge-1');
  expect(edge?.pathType).toBe('orthogonal');
  expect(edge?.data?.notes).toBe('Pilot note: edge selection should persist.');

  // Click off should clear selection as expected.
  await clickCanvasBlank(page);
  await expect(page.getByTestId('inspector-mode-title')).toContainText('Nothing selected');
});

