import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.VISUAL_BASE_URL || 'http://127.0.0.1:5181/?fresh=1';
const OUT_DIR = path.resolve('docs/ui-baseline/after-modern');
const SHAPES = [
  { key: 'diamond', label: /Diamond/i },
  { key: 'circle', label: /Circle/i },
  { key: 'square', label: /Square/i }
];
const ZOOMS = [75, 100, 150];

const ensureStarterTemplate = async (page) => {
  const starter = page.locator('[data-node-id="starter-sponsor"]').first();
  if (await starter.count()) return;
  const strip = page.getByTestId('primary-actions-strip').first();
  await strip.getByTestId('toolbar-file-trigger').click();
  const menu = strip.getByTestId('toolbar-file-menu').first();
  await menu.getByTestId('toolbar-insert-starter-template').click();
  await starter.waitFor({ state: 'visible' });
};

const setZoom = async (page, zoom) => {
  const trigger = page.getByTestId('bottom-zoom-menu-trigger').first();
  await trigger.click();
  const item = page.getByTestId(`bottom-zoom-set-${zoom}`).first();
  if (await item.count()) {
    await item.click();
    return;
  }
  await page.keyboard.press('Escape');
};

const setShape = async (page, shapeLabelRegex) => {
  const appearanceToggle = page.getByText('Appearance', { exact: true }).first();
  if ((await appearanceToggle.count()) > 0) {
    await appearanceToggle.click();
  }
  const button = page.getByRole('button', { name: shapeLabelRegex }).first();
  await button.waitFor({ state: 'visible' });
  await button.click({ force: true });
};

const collectMetrics = async (page, nodeId) => {
  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
  const title = node.getByTestId(`node-title-${nodeId}`).first();
  const [nodeBox, titleBox] = await Promise.all([node.boundingBox(), title.boundingBox()]);

  if (!nodeBox || !titleBox) {
    return { ok: false, reason: 'missing-node-or-title-box' };
  }

  const detail = await title.evaluate((element) => {
    const el = element;
    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight || '0') || 14;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      lineHeight,
      lineCount: Math.max(1, Math.round(el.clientHeight / lineHeight)),
      text: el.textContent || ''
    };
  });

  const insideNode =
    titleBox.x >= nodeBox.x + 2 &&
    titleBox.x + titleBox.width <= nodeBox.x + nodeBox.width - 2 &&
    titleBox.y >= nodeBox.y + 2 &&
    titleBox.y + titleBox.height <= nodeBox.y + nodeBox.height - 2;

  const noHorizontalOverflow = detail.scrollWidth <= detail.clientWidth + 2;
  const ok = insideNode && noHorizontalOverflow && detail.lineCount <= 2;

  return {
    ok,
    insideNode,
    noHorizontalOverflow,
    node: { width: nodeBox.width, height: nodeBox.height },
    title: { width: titleBox.width, height: titleBox.height },
    detail
  };
};

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  await page.goto(BASE_URL);
  await page.evaluate(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');

  await ensureStarterTemplate(page);

  const nodeId = 'starter-sponsor';
  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
  await node.click();

  const typeSelect = page.locator('#node-field-type').first();
  await typeSelect.selectOption('Compliance Gate');
  const nameInput = page.locator('#node-field-label').first();
  await nameInput.fill('Compliance Gate Risk Controls and Policy Checks');
  await nameInput.blur();

  const report = {
    baseUrl: BASE_URL,
    timestamp: new Date().toISOString(),
    nodeId,
    cases: []
  };

  for (const shape of SHAPES) {
    await node.click();
    await setShape(page, shape.label);

    for (const zoom of ZOOMS) {
      await setZoom(page, zoom);
      await node.click();

      const metrics = await collectMetrics(page, nodeId);
      const screenshotPath = path.join(OUT_DIR, `node-text-fit-${shape.key}-${zoom}.png`);
      await node.screenshot({ path: screenshotPath });

      report.cases.push({
        shape: shape.key,
        zoom,
        screenshot: path.relative(process.cwd(), screenshotPath),
        ...metrics
      });
    }
  }

  const reportPath = path.join(OUT_DIR, 'node-text-fit-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const failed = report.cases.filter((entry) => !entry.ok);
  console.log(`Saved report: ${reportPath}`);
  console.log(`Cases: ${report.cases.length}, failed: ${failed.length}`);
  if (failed.length) {
    console.log('Failures:', JSON.stringify(failed, null, 2));
  }

  await context.close();
  await browser.close();

  if (failed.length) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
