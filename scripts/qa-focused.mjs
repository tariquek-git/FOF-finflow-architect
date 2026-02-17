import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.QA_BASE_URL || 'http://127.0.0.1:3003/';
// If QA_BASE_URL includes `?fresh=1`, the app clears storage on boot (index.tsx),
// which would wipe seeded sessionStorage used by the performance pass. Use a
// variant without `fresh=1` for seeded/perf scenarios.
const PERF_BASE_URL = (() => {
  try {
    const url = new URL(BASE_URL);
    if (url.searchParams.get('fresh') === '1') {
      url.searchParams.delete('fresh');
      return url.toString();
    }
    return BASE_URL;
  } catch {
    return BASE_URL;
  }
})();
const ARTIFACT_ROOT = path.resolve('qa-artifacts');
const runLabel = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(ARTIFACT_ROOT, runLabel);
fs.mkdirSync(outDir, { recursive: true });

const WORKSPACE_INDEX_STORAGE_KEY = 'fof:workspaces:index';
const ACTIVE_WORKSPACE_STORAGE_KEY = 'fof:active-workspace-id';
const WORKSPACE_STORAGE_PREFIX = 'fof:workspace';
const ONBOARDING_DISMISSED_STORAGE_KEY = 'finflow-builder.quickstart.dismissed.v1';

const getWorkspaceStorageKey = (workspaceId) => `${WORKSPACE_STORAGE_PREFIX}:${workspaceId}`;
const getWorkspaceLayoutStorageKey = (workspaceId) => `${WORKSPACE_STORAGE_PREFIX}:${workspaceId}:layout`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const now = () => Number(new Date());

const saveJson = (name, payload) => {
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const ensureExportMenuOpen = async (page) => {
  const strip = page.getByTestId('primary-actions-strip').first();
  const menu = strip.getByTestId('toolbar-file-menu').first();
  const isMenuVisible = await menu.isVisible().catch(() => false);
  if (isMenuVisible) return;

  const trigger = strip.getByTestId('toolbar-file-trigger').first();
  if (!(await trigger.count())) return;

  await trigger.click();
  await menu.waitFor({ state: 'visible' });
};

const triggerDownload = async (page, trigger) => {
  try {
    // PNG export (html2canvas) can be slow in CI/headless; give it room to finish.
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), trigger()]);
    return download;
  } catch {
    return null;
  }
};

const insertStarterTemplateIfMissing = async (page) => {
  const starter = page.locator('[data-node-id="starter-sponsor"]').first();
  if (await starter.count()) return;
  const strip = page.getByTestId('primary-actions-strip').first();
  await strip.getByTestId('toolbar-file-trigger').click();
  const menu = strip.getByTestId('toolbar-file-menu').first();
  await menu.getByTestId('toolbar-insert-starter-template').click();
  await starter.waitFor({ state: 'visible' });
};

const clickNodeByLabel = async (page, label, shift = false) => {
  const locator = page.locator('div.group.absolute').filter({ hasText: label }).first();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Could not find node bounding box for ${label}`);
  }
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  if (shift) await page.keyboard.up('Shift');
};

const buildLargeDiagram = () => {
  const cols = 25;
  const rows = 20;
  const nodes = [];
  const edges = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const index = r * cols + c;
      const id = `perf-node-${index}`;
      const type = index % 7 === 0 ? 'Sponsor Bank' : index % 7 === 1 ? 'Processor' : index % 7 === 2 ? 'Card Network' : index % 7 === 3 ? 'Program Manager' : index % 7 === 4 ? 'Compliance Gate' : index % 7 === 5 ? 'Liquidity Provider' : 'End-Point';
      nodes.push({
        id,
        type,
        label: `${type.split(' ')[0]} ${index + 1}`,
        shape: type === 'Compliance Gate' ? 'diamond' : 'rectangle',
        position: {
          x: 120 + c * 220,
          y: 120 + r * 130
        },
        swimlaneId: Math.floor((120 + r * 130) / 300) + 1,
        ...(type === 'End-Point' ? { endPointType: index % 2 === 0 ? 'Consumer' : 'Merchant' } : {})
      });

      if (c > 0) {
        edges.push({
          id: `perf-edge-h-${index}`,
          sourceId: `perf-node-${index - 1}`,
          targetId: id,
          sourcePortIdx: 1,
          targetPortIdx: 3,
          rail: c % 3 === 0 ? 'RTP' : c % 3 === 1 ? 'ACH' : 'FedNow',
          direction: 'Push (Credit)',
          label: c % 4 === 0 ? 'Settlement' : 'Transfer',
          isFX: false,
          thickness: 2,
          style: c % 9 === 0 ? 'dashed' : 'solid',
          showArrowHead: true,
          showMidArrow: false,
          pathType: 'bezier'
        });
      }

      if (r > 0 && c % 2 === 0) {
        edges.push({
          id: `perf-edge-v-${index}`,
          sourceId: `perf-node-${index - cols}`,
          targetId: id,
          sourcePortIdx: 2,
          targetPortIdx: 0,
          rail: r % 2 === 0 ? 'Wire' : 'ACH',
          direction: 'Settlement',
          label: 'Clearing',
          isFX: false,
          thickness: 2,
          style: r % 7 === 0 ? 'dotted' : 'solid',
          showArrowHead: true,
          showMidArrow: false,
          pathType: 'bezier'
        });
      }
    }
  }

  return { nodes, edges, drawings: [] };
};

const desktopQa = async (context, result) => {
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await insertStarterTemplateIfMissing(page);

  const bottomDock = page.getByTestId('bottom-tool-dock');
  const tray = page.getByTestId('selection-action-tray');
  const nodeToolbar = page.getByTestId('node-context-toolbar');
  await bottomDock.waitFor({ state: 'visible' });

  result.desktop.bottomDockVisible = true;
  result.desktop.trayHiddenAtRest = (await tray.count()) === 0;

  await clickNodeByLabel(page, 'Sponsor Bank');
  const trayVisibleOnNode = await tray.isVisible().catch(() => false);
  if (!trayVisibleOnNode) {
    await nodeToolbar.waitFor({ state: 'visible' });
  }
  result.desktop.trayVisibleOnNode = trayVisibleOnNode || (await nodeToolbar.isVisible().catch(() => false));

  await page.screenshot({ path: path.join(outDir, 'desktop-node-selection.png'), fullPage: true });

  await page.getByRole('button', { name: 'Connect tool' }).click();
  await sleep(120);
  const trayVisibleInConnectMode = await tray.isVisible().catch(() => false);
  const nodeToolbarVisibleInConnectMode = await nodeToolbar.isVisible().catch(() => false);
  result.desktop.trayHiddenInConnectMode = !trayVisibleInConnectMode && !nodeToolbarVisibleInConnectMode;
  await page.screenshot({ path: path.join(outDir, 'desktop-connect-mode.png'), fullPage: true });

  await page.getByRole('button', { name: 'Select tool' }).click();
  await page.getByTestId('toolbar-insert-connector').click();
  await page.getByText('Line style').first().waitFor({ state: 'visible' });
  result.desktop.edgeActionsVisibleOnEdgeSelection = true;
  await page.screenshot({ path: path.join(outDir, 'desktop-edge-selection.png'), fullPage: true });

  await clickNodeByLabel(page, 'Sponsor Bank');
  await page.getByPlaceholder('Operational context and workflow notes...').fill('QA note for visual regression check.');
  await page.getByPlaceholder('e.g. Sponsor Bank').fill('Desk QA Custody Holder');
  await page.getByPlaceholder('Team or provider').fill('Desk QA Compliance');
  await sleep(200);
  const custodyValue = await page.getByPlaceholder('e.g. Sponsor Bank').inputValue();
  const kycValue = await page.getByPlaceholder('Team or provider').inputValue();
  result.desktop.inspectorValuesPersistInPlace = custodyValue === 'Desk QA Custody Holder' && kycValue === 'Desk QA Compliance';

  await ensureExportMenuOpen(page);
  const exportMenu = page.getByTestId('primary-actions-strip').first().getByTestId('toolbar-file-menu').first();
  const pngDownload = await triggerDownload(page, () =>
    exportMenu.getByTestId('toolbar-export-png').click()
  );
  await ensureExportMenuOpen(page);
  const pdfDownload = await triggerDownload(page, () =>
    exportMenu.getByTestId('toolbar-export-pdf').click()
  );

  result.desktop.pngExported = pngDownload
    ? (await pngDownload.suggestedFilename()).toLowerCase().endsWith('.png')
    : false;
  result.desktop.pdfExported = pdfDownload
    ? (await pdfDownload.suggestedFilename()).toLowerCase().endsWith('.pdf')
    : false;

  const metaStableChanges = await page.evaluate(async () => {
    const target = document.querySelector('[data-testid="node-meta-starter-sponsor"]');
    if (!target) return -1;

    let changes = 0;
    const observer = new MutationObserver(() => {
      changes += 1;
    });
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    await new Promise((resolve) => setTimeout(resolve, 900));
    observer.disconnect();
    return changes;
  });

  result.desktop.metaTextMutationsAtRest = metaStableChanges;
  await page.screenshot({ path: path.join(outDir, 'desktop-inspector.png'), fullPage: true });

  await page.close();
};

const mobileQa = async (browser, result) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await insertStarterTemplateIfMissing(page);

  await clickNodeByLabel(page, 'Sponsor Bank');
  const moreButton = page.getByTestId('bottom-more-actions');
  await moreButton.waitFor({ state: 'visible' });

  await moreButton.click();
  const sheet = page.getByTestId('bottom-overflow-sheet');
  await sheet.waitFor({ state: 'visible' });

  result.mobile.moreButtonVisibleOnSelection = true;
  result.mobile.overflowVisible = true;

  await page.screenshot({ path: path.join(outDir, 'mobile-overflow-open.png'), fullPage: true });

  await page.keyboard.press('Escape');
  await sleep(200);
  result.mobile.overflowClosedOnEscape = (await sheet.count()) === 0;

  await context.close();
};

const performanceQa = async (browser, result) => {
  const diagram = buildLargeDiagram();
  const snapshot = {
    schemaVersion: 2,
    nodes: diagram.nodes,
    edges: diagram.edges,
    drawings: diagram.drawings
  };
  const workspaceId = 'qa-perf-workspace';
  const nowIso = new Date().toISOString();
  const workspaceSummary = [
    {
      workspaceId,
      name: 'QA Perf Workspace',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastOpenedAt: nowIso
    }
  ];
  const layout = {
    showSwimlanes: true,
    swimlaneLabels: ['Funding', 'Authorization', 'Clearing', 'Settlement'],
    gridMode: 'dots',
    isDarkMode: false,
    showPorts: false
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ({
      WORKSPACE_INDEX_STORAGE_KEY: workspaceIndexKey,
      ACTIVE_WORKSPACE_STORAGE_KEY: activeWorkspaceKey,
      workspaceDiagramKey,
      workspaceLayoutKey,
      ONBOARDING_DISMISSED_STORAGE_KEY: qKey,
      workspaceSummary,
      workspaceId,
      snapshot,
      layout
    }) => {
      window.sessionStorage.setItem(workspaceIndexKey, JSON.stringify(workspaceSummary));
      window.sessionStorage.setItem(activeWorkspaceKey, workspaceId);
      window.sessionStorage.setItem(workspaceDiagramKey, JSON.stringify(snapshot));
      window.sessionStorage.setItem(workspaceLayoutKey, JSON.stringify(layout));
      window.sessionStorage.setItem(qKey, 'true');
    },
    {
      WORKSPACE_INDEX_STORAGE_KEY,
      ACTIVE_WORKSPACE_STORAGE_KEY,
      workspaceDiagramKey: getWorkspaceStorageKey(workspaceId),
      workspaceLayoutKey: getWorkspaceLayoutStorageKey(workspaceId),
      ONBOARDING_DISMISSED_STORAGE_KEY,
      workspaceSummary,
      workspaceId,
      snapshot,
      layout
    }
  );

  const page = await context.newPage();

  const tLoadStart = now();
  await page.goto(PERF_BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="canvas-dropzone"]').waitFor({ state: 'visible' });
  const tLoadEnd = now();

  const renderedNodeCount = await page.locator('[data-node-id]').count();
  const renderedEdgeCount = await page.locator('g[data-edge-id]').count();

  const worldLayer = page.locator('[data-testid="canvas-dropzone"] div.absolute.inset-0').first();
  const beforePan = await worldLayer.getAttribute('style');
  const canvas = page.locator('[data-testid="canvas-dropzone"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found for performance pass');
  await canvas.click({ position: { x: 24, y: 24 } });

  const tPanStart = now();
  await page.keyboard.down('Space');
  await page.mouse.move(box.x + 420, box.y + 270);
  await page.mouse.down();
  await page.mouse.move(box.x + 700, box.y + 420);
  await page.mouse.up();
  await page.keyboard.up('Space');
  await page.waitForFunction(
    ({ selector, expected }) => {
      const el = document.querySelector(selector);
      return !!el && el.getAttribute('style') !== expected;
    },
    { selector: '[data-testid="canvas-dropzone"] div.absolute.inset-0', expected: beforePan },
    { timeout: 12000 }
  );
  const tPanEnd = now();

  const zoomOut = page.locator('[data-testid="bottom-zoom-out"], button[title^="Zoom out"]').first();
  await zoomOut.waitFor({ state: 'visible' });
  const tZoomStart = now();
  for (let i = 0; i < 6; i += 1) {
    await zoomOut.click();
  }
  const tZoomEnd = now();

  const nodeLocator = page.locator('[data-node-id]').first();
  const visibleNodeCount = await page.locator('[data-node-id]').count();
  if (visibleNodeCount === 0) {
    result.performance = {
      ...(result.performance || {}),
      dataset: {
        ...((result.performance && result.performance.dataset) || {}),
        renderedNodes: renderedNodeCount,
        renderedEdges: renderedEdgeCount
      },
      error: 'No renderable nodes found for drag performance sample'
    };
    await context.close();
    return;
  }
  const nodeBox = await nodeLocator.boundingBox();
  if (!nodeBox) {
    result.performance = {
      ...(result.performance || {}),
      dataset: {
        ...((result.performance && result.performance.dataset) || {}),
        renderedNodes: renderedNodeCount,
        renderedEdges: renderedEdgeCount
      },
      error: 'Could not resolve visible node bounds for drag sample'
    };
    await context.close();
    return;
  }

  const tDragStart = now();
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(nodeBox.x + nodeBox.width / 2 + 120, nodeBox.y + nodeBox.height / 2 + 60);
  await page.mouse.up();
  const tDragEnd = now();

  const tMarqueeStart = now();
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + 220, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 520, box.y + 420);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const tMarqueeEnd = now();

  const trayVisible = await page.getByTestId('selection-action-tray').count();

  result.performance = {
    dataset: {
      nodes: diagram.nodes.length,
      edges: diagram.edges.length,
      renderedNodes: renderedNodeCount,
      renderedEdges: renderedEdgeCount
    },
    timingsMs: {
      initialLoadToInteractive: tLoadEnd - tLoadStart,
      panInteraction: tPanEnd - tPanStart,
      zoomClicksBatch: tZoomEnd - tZoomStart,
      nodeDrag: tDragEnd - tDragStart,
      marqueeMultiSelect: tMarqueeEnd - tMarqueeStart
    },
    trayVisibleAfterMarquee: trayVisible > 0
  };

  await page.screenshot({ path: path.join(outDir, 'performance-500nodes.png'), fullPage: true });

  await context.close();
};

const run = async () => {
  const result = {
    baseUrl: BASE_URL,
    artifacts: outDir,
    desktop: {},
    mobile: {},
    performance: {}
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });

  try {
    await desktopQa(context, result);
    await mobileQa(browser, result);
    await performanceQa(browser, result);
  } finally {
    await context.close();
    await browser.close();
  }

  saveJson('qa-summary.json', result);
  console.log(JSON.stringify(result, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
