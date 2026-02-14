import { expect, test, type Download, type Page } from '@playwright/test';

const clickNodeByLabel = async (page: Page, label: string) => {
  const locator = page.locator('div.group.absolute').filter({ hasText: label }).first();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Could not find node bounding box for ${label}`);
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

const openFileMenu = async (page: Page) => {
  const strip = page.getByTestId('primary-actions-strip').first();
  const menu = strip.getByTestId('toolbar-file-menu');
  if (await menu.isVisible()) {
    return menu;
  }
  const trigger = strip.getByTestId('toolbar-file-trigger');
  await trigger.click();
  await expect(menu).toBeVisible();
  return menu;
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.waitForLoadState('networkidle');
});

test('node documentation notes stay isolated from metadata tags', async ({ page }) => {
  await clickNodeByLabel(page, 'Sponsor Bank');
  await expect(page.getByTestId('inspector-mode-title')).toContainText('Node');

  const metadataToggle = page
    .getByTestId('inspector-scroll-body')
    .getByRole('button', { name: 'Metadata' })
    .first();
  if ((await metadataToggle.getAttribute('aria-expanded')) === 'false') {
    await metadataToggle.click();
  }

  const notesInput = page.locator('#node-field-notes');
  const noteText = 'Operational runbook for settlement and triage.';
  await notesInput.fill(noteText);
  await page.locator('#node-field-tags').fill('ops,critical');
  await page.locator('#node-field-external-refs').fill('REF-1234');
  await page.keyboard.press('Tab');

  await expect(notesInput).toHaveValue(noteText);

  const fileMenu = await openFileMenu(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    fileMenu.getByTestId('toolbar-export-json').click()
  ]);
  const exportedText = await readDownloadText(download);
  const payload = JSON.parse(exportedText) as {
    diagram?: { nodes?: Array<{ label?: string; description?: string; data?: { notes?: string } }> };
  };
  const sponsorNode = payload.diagram?.nodes?.find((node) => node.label === 'Sponsor Bank');

  expect(sponsorNode?.description || '').toContain('[[finflow-meta]]');
  expect(sponsorNode?.description || '').toContain('tags=ops,critical');
  expect(sponsorNode?.data?.notes).toBe(noteText);
  expect(sponsorNode?.data?.notes || '').not.toContain('tags=');
});
