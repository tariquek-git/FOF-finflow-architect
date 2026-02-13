import { expect, test, type Download, type Page } from '@playwright/test';

const EDGE_SELECTOR = 'svg g.cursor-pointer.group';
const WORLD_LAYER_SELECTOR = '[data-testid="canvas-dropzone"] div.absolute.inset-0';

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
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('toolbar-export-json').first().click()
  ]);
  return readDownloadText(download);
};

const importDiagramText = async (page: Page, jsonText: string) => {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('toolbar-import-json').first().click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'acceptance-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(jsonText, 'utf8')
  });
};

const clickNodeByLabel = async (page: Page, label: string, shift = false) => {
  const locator = page.locator('div.group.absolute').filter({ hasText: label }).first();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Could not find node bounding box for ${label}`);
  }
  if (shift) {
    await page.keyboard.down('Shift');
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  if (shift) {
    await page.keyboard.up('Shift');
  }
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.waitForLoadState('networkidle');
});

test('starter diagram is loaded and can be edited', async ({ page }) => {
  await expect(page.locator('div.group.absolute').filter({ hasText: 'Sponsor Bank' }).first()).toBeVisible();
  await expect(page.locator('div.group.absolute').filter({ hasText: 'Processor' }).first()).toBeVisible();
  await expect(page.locator('div.group.absolute').filter({ hasText: 'Card Network' }).first()).toBeVisible();

  const duplicateButton = page.locator('button[title="Duplicate selected nodes"]');
  await expect(duplicateButton).toBeDisabled();

  await clickNodeByLabel(page, 'Sponsor Bank');
  await clickNodeByLabel(page, 'Processor', true);

  await expect(duplicateButton).toBeEnabled();

  const beforeNodeCount = await page.locator('div.group.absolute').count();
  await duplicateButton.click();
  await expect.poll(async () => page.locator('div.group.absolute').count()).toBeGreaterThan(beforeNodeCount);
});

test('connector drag-drop from toolbar into canvas inserts a connector edge', async ({ page }) => {
  const beforeEdges = await page.locator(EDGE_SELECTOR).count();

  await page.evaluate(() => {
    const connectorButton = document.querySelector('[data-testid="toolbar-insert-connector"]');
    const canvas = document.querySelector('[data-testid="canvas-dropzone"]');
    if (!connectorButton || !canvas) {
      throw new Error('Missing connector button or canvas dropzone');
    }

    const transfer = new DataTransfer();
    connectorButton.dispatchEvent(
      new DragEvent('dragstart', { dataTransfer: transfer, bubbles: true, cancelable: true })
    );

    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width * 0.68;
    const y = rect.top + rect.height * 0.58;

    canvas.dispatchEvent(
      new DragEvent('dragover', {
        dataTransfer: transfer,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true
      })
    );

    canvas.dispatchEvent(
      new DragEvent('drop', {
        dataTransfer: transfer,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true
      })
    );
  });

  await expect.poll(async () => page.locator(EDGE_SELECTOR).count()).toBe(beforeEdges + 1);
});

test('reset and restore recover previous workspace state', async ({ page }) => {
  const connectorButton = page.locator('[data-testid="toolbar-insert-connector"]');
  await connectorButton.click();
  const modifiedEdgeCount = await page.locator(EDGE_SELECTOR).count();
  await expect(modifiedEdgeCount).toBeGreaterThan(2);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-testid="toolbar-reset-canvas"]').click();
  await expect.poll(async () => page.locator(EDGE_SELECTOR).count()).toBe(2);

  const restoreButton = page.locator('[data-testid="toolbar-restore"]');
  await expect(restoreButton).toBeEnabled();
  await restoreButton.click();

  await expect.poll(async () => page.locator(EDGE_SELECTOR).count()).toBe(modifiedEdgeCount);
});

test('edge style controls respond for selected connector', async ({ page }) => {
  await page.locator('[data-testid="toolbar-insert-connector"]').click();

  const dashedButton = page.locator('button[title="dashed line style"]');
  const dottedButton = page.locator('button[title="dotted line style"]');
  const solidButton = page.locator('button[title="solid line style"]');
  const arrowHeadButton = page.locator('button[title="Toggle arrow head"]');
  const midArrowButton = page.locator('button[title="Toggle middle arrow"]');

  await expect(dashedButton).toBeEnabled();
  await dashedButton.click();
  await expect(dashedButton).toHaveAttribute('aria-pressed', 'true');

  await dottedButton.click();
  await expect(dottedButton).toHaveAttribute('aria-pressed', 'true');

  await solidButton.click();
  await expect(solidButton).toHaveAttribute('aria-pressed', 'true');

  await arrowHeadButton.click();
  await midArrowButton.click();
});

test('export controls include JSON/PNG/PDF and trigger downloads', async ({ page }) => {
  await expect(page.getByTestId('toolbar-export-json').first()).toBeVisible();

  await page.locator('summary:has-text("More")').first().click();
  await expect(page.getByTestId('toolbar-export-png').first()).toBeVisible();
  await expect(page.getByTestId('toolbar-export-pdf').first()).toBeVisible();

  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('toolbar-export-png').first().click()
  ]);
  expect((await pngDownload.suggestedFilename()).toLowerCase()).toContain('.png');

  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('toolbar-export-pdf').first().click()
  ]);
  expect((await pdfDownload.suggestedFilename()).toLowerCase()).toContain('.pdf');
});

test('overlay toggles affect canvas overlays and expose aria-pressed state', async ({ page }) => {
  await page.getByTitle('Drag Compliance Gate to canvas').click();

  const riskToggle = page.getByTestId('toolbar-toggle-risk-overlay');
  const ledgerToggle = page.getByTestId('toolbar-toggle-ledger-overlay');

  await expect(riskToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(ledgerToggle).toHaveAttribute('aria-pressed', 'false');

  await riskToggle.click();
  await expect(riskToggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => page.locator('[data-testid^="risk-overlay-"]').count()).toBeGreaterThan(0);

  await ledgerToggle.click();
  await expect(ledgerToggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => page.locator('[data-testid^="ledger-overlay-"]').count()).toBeGreaterThan(0);
});

test('minimap toggle shows an interactive minimap and pans viewport', async ({ page }) => {
  await page.locator('button[title="Open layout controls"]').click();
  await expect(page.getByTestId('inspector-tab-canvas')).toHaveAttribute('aria-pressed', 'true');

  const minimapToggle = page.getByRole('button', { name: /Minimap Off|Minimap On/ }).first();
  await minimapToggle.click();
  await expect(page.getByTestId('canvas-minimap')).toBeVisible();

  const worldLayer = page.locator(WORLD_LAYER_SELECTOR).first();
  const before = await worldLayer.getAttribute('style');

  await page.evaluate(() => {
    const minimap = document.querySelector('[data-testid="canvas-minimap"] [role="button"]') as HTMLElement | null;
    if (!minimap) {
      throw new Error('Minimap control is missing.');
    }
    const rect = minimap.getBoundingClientRect();
    minimap.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 12,
        clientY: rect.top + 12
      })
    );
  });
  await expect.poll(async () => worldLayer.getAttribute('style')).not.toBe(before);
});

test('edge labels reveal on edge focus and non-connected edges dim on node selection', async ({ page }) => {
  const firstEdge = page.locator('g[data-edge-id]').first();
  const edgeId = await firstEdge.getAttribute('data-edge-id');
  if (!edgeId) {
    throw new Error('Could not resolve first edge id');
  }
  const edgeLabel = page.getByTestId(`edge-label-${edgeId}`);

  const opacityBeforeHover = await edgeLabel.evaluate((element) => window.getComputedStyle(element).opacity);
  expect(Number(opacityBeforeHover)).toBeLessThan(0.2);

  await firstEdge.dispatchEvent('click');
  await expect
    .poll(async () =>
      edgeLabel.evaluate((element) => Number.parseFloat(window.getComputedStyle(element).opacity))
    )
    .toBeGreaterThan(0.75);

  await clickNodeByLabel(page, 'Sponsor Bank');
  await expect.poll(async () => page.locator('g[data-dimmed="true"]').count()).toBeGreaterThan(0);
});

test('inspector metadata is encoded in description and survives export/import', async ({ page }) => {
  await clickNodeByLabel(page, 'Sponsor Bank');
  await expect(page.getByTestId('inspector-tab-node')).toHaveAttribute('aria-pressed', 'true');

  const detailsToggle = page.getByTestId('inspector-toggle-node-details');
  if ((await detailsToggle.getAttribute('aria-expanded')) === 'false') {
    await detailsToggle.click();
  }

  await page
    .getByPlaceholder('Operational context and workflow notes...')
    .fill('Primary settlement and sponsorship responsibilities.');
  await page.getByPlaceholder('e.g. Sponsor Bank').fill('North Ridge Sponsor');
  await page.getByPlaceholder('Team or provider').fill('Compliance Ops');

  const exportedText = await exportDiagramText(page);
  const payload = JSON.parse(exportedText) as {
    diagram?: { nodes?: Array<{ label?: string; description?: string }> };
  };
  const sponsorNode = payload.diagram?.nodes?.find((node) => node.label === 'Sponsor Bank');
  expect(sponsorNode?.description).toContain('[[finflow-meta]]');
  expect(sponsorNode?.description).toContain('custodyHolder=North Ridge Sponsor');
  expect(sponsorNode?.description).toContain('kycOwner=Compliance Ops');
  expect(sponsorNode?.description).toContain('Primary settlement and sponsorship responsibilities.');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('toolbar-reset-canvas').first().click();
  await importDiagramText(page, exportedText);

  await clickNodeByLabel(page, 'Sponsor Bank');
  if ((await detailsToggle.getAttribute('aria-expanded')) === 'false') {
    await detailsToggle.click();
  }
  await expect(page.getByPlaceholder('e.g. Sponsor Bank')).toHaveValue('North Ridge Sponsor');
  await expect(page.getByPlaceholder('Team or provider')).toHaveValue('Compliance Ops');
});

test('level-of-detail hides node metadata and edge labels as zoom decreases', async ({ page }) => {
  await expect(page.getByTestId('node-meta-starter-sponsor')).toBeVisible();

  const firstEdge = page.locator('g[data-edge-id]').first();
  const edgeId = await firstEdge.getAttribute('data-edge-id');
  if (!edgeId) {
    throw new Error('Could not resolve first edge id');
  }

  await firstEdge.dispatchEvent('click');
  await expect
    .poll(async () =>
      page
        .getByTestId(`edge-label-${edgeId}`)
        .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).opacity))
    )
    .toBeGreaterThan(0.75);

  const zoomOutButton = page.locator('button[title="Zoom out"]');
  for (let i = 0; i < 5; i += 1) {
    await zoomOutButton.click();
  }
  await expect(page.getByTestId('node-meta-starter-sponsor')).toHaveCount(0);

  for (let i = 0; i < 3; i += 1) {
    await zoomOutButton.click();
  }
  await expect(page.getByTestId(`edge-label-${edgeId}`)).toHaveCount(0);
});
