import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.PILOT_BASE_URL || 'http://127.0.0.1:5173/?fresh=1';
const ARTIFACT_ROOT = path.resolve('output/pilot');
const runLabel = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(ARTIFACT_ROOT, runLabel);
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const record = (results, key, value) => {
  results[key] = value;
  return value;
};

const safeScreenshot = async (page, name) => {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
};

const ensureFileMenuOpen = async (page) => {
  const strip = page.getByTestId('primary-actions-strip').first();
  const trigger = strip.getByTestId('toolbar-file-trigger').first();
  await trigger.click();
  await strip.getByTestId('toolbar-file-menu').first().waitFor({ state: 'visible' });
};

const insertStarterTemplate = async (page) => {
  // Uses existing explicit action; blank-first is expected.
  await ensureFileMenuOpen(page);
  const strip = page.getByTestId('primary-actions-strip').first();
  await strip.getByTestId('toolbar-insert-starter-template').click();
  await page.locator('[data-node-id="starter-sponsor"]').waitFor({ state: 'visible' });
};

const clickNodeByText = async (page, text) => {
  // Match the same clickable surface used by e2e helpers (node card wrapper).
  const locator = page.locator('div.group.absolute').filter({ hasText: text }).first();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`node not found: ${text}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

const triggerDownload = async (page, clickFn) => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    clickFn()
  ]);
  return download;
};

const run = async () => {
  const results = {
    baseUrl: BASE_URL,
    artifactsDir: outDir,
    checks: {},
    consoleErrors: [],
    pageErrors: []
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    // Reset/import flows use confirm/prompt in a few places; default to accept so pilot can proceed.
    try {
      await dialog.accept();
    } catch {
      // Ignore.
    }
  });

  page.on('pageerror', (err) => results.pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text());
    }
  });

  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('canvas-dropzone').waitFor({ state: 'visible' });
    await safeScreenshot(page, '01-loaded.png');

    // Blank-first expectation.
    const initialNodes = await page.locator('[data-node-id]').count();
    record(results.checks, 'blankFirst', initialNodes === 0);

    await insertStarterTemplate(page);
    await safeScreenshot(page, '02-starter-inserted.png');

    await clickNodeByText(page, 'Sponsor Bank');
    await page.getByTestId('inspector-mode-title').waitFor({ state: 'visible' });
    record(
      results.checks,
      'inspectorShowsNode',
      (await page.getByTestId('inspector-mode-title').innerText()).includes('Node')
    );

    // Notes edit + blur (debounced/blur safe).
    const notes = page.getByPlaceholder('Add context, assumptions, IDs, links…').first();
    await notes.fill('Pilot note: sponsor is regulated bank.');
    await notes.blur();
    await sleep(250);
    await safeScreenshot(page, '03-node-notes.png');

    // Edge selection + styling via inspector (single source of truth).
    const edge = page.locator('svg g.cursor-pointer.group').first();
    await edge.click();
    await page.getByTestId('inspector-mode-title').waitFor({ state: 'visible' });
    record(
      results.checks,
      'inspectorShowsEdge',
      (await page.getByTestId('inspector-mode-title').innerText()).includes('Edge')
    );
    await page.getByText('Line style').first().waitFor({ state: 'visible' });
    await safeScreenshot(page, '04-edge-selected.png');

    // Export JSON -> reset -> import.
    await ensureFileMenuOpen(page);
    const strip = page.getByTestId('primary-actions-strip').first();
    const menu = strip.getByTestId('toolbar-file-menu').first();
    const jsonDownload = await triggerDownload(page, () => menu.getByTestId('toolbar-export-json').click());
    const jsonPath = path.join(outDir, await jsonDownload.suggestedFilename());
    await jsonDownload.saveAs(jsonPath);
    record(results.checks, 'exportedJson', fs.existsSync(jsonPath));

    await ensureFileMenuOpen(page);
    await strip.getByTestId('toolbar-reset-canvas').click();
    await sleep(200);
    record(results.checks, 'resetToBlank', (await page.locator('[data-node-id]').count()) === 0);
    await safeScreenshot(page, '05-reset-blank.png');

    await ensureFileMenuOpen(page);
    await strip.getByTestId('toolbar-import-json').click();
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(jsonPath);
    await page.locator('[data-node-id="starter-sponsor"]').waitFor({ state: 'visible' });
    record(results.checks, 'importRestores', (await page.locator('[data-node-id]').count()) > 0);
    await safeScreenshot(page, '06-import-restored.png');

    // Menu close behavior.
    await ensureFileMenuOpen(page);
    await page.mouse.click(10, 10);
    await sleep(150);
    const fileMenu = strip.getByTestId('toolbar-file-menu').first();
    record(
      results.checks,
      'menuClosesByOutsideClick',
      (await fileMenu.isVisible().catch(() => false)) === false
    );

    // Search mode sanity: typing should switch to list view.
    const search = page.getByTestId('sidebar-search-input').first();
    await search.fill('spo');
    await sleep(150);
    record(
      results.checks,
      'sidebarSearchListVisible',
      (await page.getByTestId('sidebar-search-results').count()) > 0
    );
    record(
      results.checks,
      'sidebarSearchHidesQuickStart',
      (await page.getByTestId('quickstart-panel').count()) === 0
    );
    await safeScreenshot(page, '07-sidebar-search.png');
    await page.keyboard.press('Escape');
    await sleep(100);
    record(results.checks, 'sidebarSearchEscapeClears', (await search.inputValue()) === '');

    // Session-only sanity: reload should keep state.
    const nodesBeforeReload = await page.locator('[data-node-id]').count();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('canvas-dropzone').waitFor({ state: 'visible' });
    const nodesAfterReload = await page.locator('[data-node-id]').count();
    record(results.checks, 'reloadKeepsSession', nodesAfterReload === nodesBeforeReload);

    await safeScreenshot(page, '08-after-reload.png');
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  fs.writeFileSync(path.join(outDir, 'pilot-summary.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(results, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
