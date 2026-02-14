import { expect, test, type Locator, type Page } from '@playwright/test';

const EDGE_SELECTOR = '[data-testid^="edge-"]:not([data-testid^="edge-label-"])';
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

const clickEdgeForSelection = async (edge: Locator) => {
  const hitPath = edge.locator('path').first();
  const box = await hitPath.boundingBox();
  if (!box) {
    await edge.click({ force: true });
    return;
  }

  const ratios = [0.25, 0.4, 0.6, 0.75];
  for (const ratio of ratios) {
    try {
      await hitPath.click({
        position: { x: box.width * ratio, y: box.height * 0.5 },
        timeout: 1200
      });
      return;
    } catch {
      // Try the next path segment position.
    }
  }

  await hitPath.click({ force: true });
};

const dragPortToPort = async (page: Page, sourceTestId: string, targetTestId: string) => {
  const source = page.getByTestId(sourceTestId);
  const target = page.getByTestId(targetTestId);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('Could not resolve source/target port bounds for drag connect.');
  }

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();
};

const openFileMenu = async (page: Page) => {
  const strip = page.getByTestId('primary-actions-strip').first();
  const menu = strip.getByTestId('toolbar-file-menu');
  if (await menu.isVisible()) {
    return menu;
  }
  const trigger = strip.getByTestId('toolbar-file-trigger');
  await trigger.click();
  try {
    await expect(menu).toBeVisible({ timeout: 1000 });
  } catch {
    await trigger.click();
  }
  await expect(menu).toBeVisible();
  return menu;
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
  const currentEdgeCount = await countEdges(page);
  await expect.poll(async () => {
    return page.evaluate(() => {
      const parseJson = (raw: string | null) => {
        if (!raw) return null;
        try {
          return JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return null;
        }
      };

      const activeWorkspaceId = window.localStorage.getItem('fof:active-workspace-id') || '';
      const workspaceDiagramKey = activeWorkspaceId ? `fof:workspace:${activeWorkspaceId}` : '';
      const fallbackDiagramKeys = [workspaceDiagramKey, 'finflow-builder.diagram.v1'].filter(Boolean);

      for (const key of fallbackDiagramKeys) {
        const parsed = parseJson(window.localStorage.getItem(key));
        const edges = parsed?.edges;
        if (Array.isArray(edges)) return edges.length;
      }

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index) || '';
        if (!key.startsWith('fof:workspace:')) continue;
        if (key.includes(':layout') || key.includes(':recovery') || key.includes(':backup')) continue;
        const parsed = parseJson(window.localStorage.getItem(key));
        const edges = parsed?.edges;
        if (Array.isArray(edges)) return edges.length;
      }

      return -1;
    });
  }).toBe(currentEdgeCount);

  return page.evaluate(() => {
    const parseJson = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    const activeWorkspaceId = window.localStorage.getItem('fof:active-workspace-id') || '';
    const workspaceDiagramKey = activeWorkspaceId ? `fof:workspace:${activeWorkspaceId}` : '';
    const workspaceLayoutKey = activeWorkspaceId ? `fof:workspace:${activeWorkspaceId}:layout` : '';

    let diagram =
      parseJson(window.localStorage.getItem(workspaceDiagramKey)) ||
      parseJson(window.localStorage.getItem('finflow-builder.diagram.v1'));

    if (!diagram) {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index) || '';
        if (!key.startsWith('fof:workspace:')) continue;
        if (key.includes(':layout') || key.includes(':recovery') || key.includes(':backup')) continue;
        const parsed = parseJson(window.localStorage.getItem(key));
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          diagram = parsed;
          break;
        }
      }
    }

    const layout =
      parseJson(window.localStorage.getItem(workspaceLayoutKey)) ||
      parseJson(window.localStorage.getItem('finflow-builder.layout.v1')) ||
      {};

    const normalizedDiagram =
      diagram && Array.isArray(diagram.nodes) && Array.isArray(diagram.edges)
        ? diagram
        : { nodes: [], edges: [], drawings: [] };
    return JSON.stringify({ version: 2, diagram: normalizedDiagram, layout });
  });
};

const waitForEdgeNotesInStorage = async (page: Page, expectedNotes: string) => {
  await expect
    .poll(async () => {
      return page.evaluate((notes) => {
        const parseJson = (raw: string | null) => {
          if (!raw) return null;
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return null;
          }
        };

        const activeWorkspaceId = window.localStorage.getItem('fof:active-workspace-id') || '';
        const workspaceDiagramKey = activeWorkspaceId ? `fof:workspace:${activeWorkspaceId}` : '';
        const fallbackDiagramKeys = [workspaceDiagramKey, 'finflow-builder.diagram.v1'].filter(Boolean);

        const hasNotes = (parsed: Record<string, unknown> | null) => {
          if (!parsed) return false;
          const edges = parsed.edges;
          if (!Array.isArray(edges)) return false;
          return edges.some((edge) => {
            if (!edge || typeof edge !== 'object') return false;
            const data = (edge as { data?: unknown }).data;
            if (!data || typeof data !== 'object') return false;
            return (data as { notes?: unknown }).notes === notes;
          });
        };

        for (const key of fallbackDiagramKeys) {
          if (hasNotes(parseJson(window.localStorage.getItem(key)))) return true;
        }

        for (let index = 0; index < window.localStorage.length; index += 1) {
          const key = window.localStorage.key(index) || '';
          if (!key.startsWith('fof:workspace:')) continue;
          if (key.includes(':layout') || key.includes(':recovery') || key.includes(':backup')) continue;
          if (hasNotes(parseJson(window.localStorage.getItem(key)))) return true;
        }

        return false;
      }, expectedNotes);
    }, { timeout: 4000, intervals: [150, 200, 250] })
    .toBe(true);
};

const importDiagramText = async (page: Page, jsonText: string) => {
  const fileInput = page.locator('input[type="file"][accept*="json"]').first();
  await fileInput.setInputFiles({
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

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');

  await expect.poll(async () => countEdges(page)).toBe(before + 1);
});

test('connect tool: port-click path creates an edge', async ({ page }) => {
  const before = await countEdges(page);

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await page.getByTestId('node-port-starter-sponsor-1').click();
  await page.getByTestId('node-port-starter-network-3').click();

  await expect.poll(async () => countEdges(page)).toBe(before + 1);
});

test('connect tool: handle drag path creates an edge', async ({ page }) => {
  const before = await countEdges(page);

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await dragPortToPort(page, 'node-port-starter-sponsor-1', 'node-port-starter-network-3');

  await expect.poll(async () => countEdges(page)).toBe(before + 1);
});

test('select tool: clicking nodes does not create edges', async ({ page }) => {
  const before = await countEdges(page);

  await page.getByTestId('bottom-tool-dock').getByLabel('Select tool').click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');

  await expect.poll(async () => countEdges(page)).toBe(before);
});

test('escape clears pending connect state', async ({ page }) => {
  const before = await countEdges(page);

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await clickNodeBody(page, 'starter-sponsor');
  await page.keyboard.press('Escape');
  await clickNodeBody(page, 'starter-network');

  await expect.poll(async () => countEdges(page)).toBe(before);
});

test('edge interactions remain reachable after reset, import, and pan', async ({ page }) => {
  const baseline = await countEdges(page);

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);

  const exportedText = await exportDiagramText(page);

  page.once('dialog', (dialog) => dialog.accept());
  const menu = await openFileMenu(page);
  await menu.getByTestId('toolbar-reset-canvas').click();
  await expect.poll(async () => countEdges(page)).toBe(baseline);

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await page.getByTestId('node-port-starter-sponsor-1').click();
  await page.getByTestId('node-port-starter-network-3').click();
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);

  await importDiagramText(page, exportedText);
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);

  await panCanvas(page);

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await page.getByTestId('node-port-starter-sponsor-1').click();
  await page.getByTestId('node-port-starter-network-3').click();
  await expect.poll(async () => countEdges(page)).toBe(baseline + 2);
});

test('undo reverts graph edit while preserving camera transform', async ({ page }) => {
  const baseline = await countEdges(page);

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);

  await panCanvas(page);

  const worldLayer = page.locator(`${CANVAS_SELECTOR} div.absolute.inset-0`).first();
  const transformBeforeUndo = await worldLayer.getAttribute('style');

  await page.locator('button[title="Undo"]').click();

  await expect.poll(async () => countEdges(page)).toBe(baseline);
  await expect(worldLayer).toHaveAttribute('style', transformBeforeUndo || '');

  await page.locator('button[title="Redo"]').click();
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);
});

test('selected edge can be deleted with keyboard', async ({ page }) => {
  const baseline = await countEdges(page);

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');
  await expect.poll(async () => countEdges(page)).toBe(baseline + 1);

  const newestEdge = page.locator('g[data-edge-id]').last();
  await clickEdgeForSelection(newestEdge);
  await page.keyboard.press('Delete');
  await expect.poll(async () => countEdges(page)).toBe(baseline);
});

test('export and import preserve edge metadata fields', async ({ page }) => {
  await page.getByTestId('bottom-tool-dock').getByLabel('Select tool').click();
  await clickEdgeForSelection(page.locator('g[data-edge-id]').first());

  await page.getByLabel('Label').fill('Funding leg one');
  await page.getByLabel('Type').selectOption('funding');
  await page.getByLabel('Timing').selectOption('T+1');
  await page.getByLabel('Rail / Instrument').selectOption('Wire');
  await page.getByLabel('Notes').fill('metadata check');
  await waitForEdgeNotesInStorage(page, 'metadata check');

  const exportedText = await exportDiagramText(page);

  page.once('dialog', (dialog) => dialog.accept());
  const menu = await openFileMenu(page);
  await menu.getByTestId('toolbar-reset-canvas').click();

  await importDiagramText(page, exportedText);
  await clickEdgeForSelection(page.locator('g[data-edge-id]').first());

  await expect(page.getByLabel('Label')).toHaveValue('Funding leg one');
  await expect(page.getByLabel('Type')).toHaveValue('funding');
  await expect(page.getByLabel('Timing')).toHaveValue('T+1');
  await expect(page.getByLabel('Rail / Instrument')).toHaveValue('Wire');
  await expect(page.getByLabel('Notes')).toHaveValue('metadata check');
});

test('edge style controls remain enabled for selected edge', async ({ page }) => {
  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await clickNodeBody(page, 'starter-sponsor');
  await clickNodeBody(page, 'starter-network');

  const dashedButton = page.locator('button[title="dashed line style"]');
  await expect(dashedButton).toHaveCount(0);

  await page.getByTestId('bottom-tool-dock').getByLabel('Select tool').click();
  await expect(dashedButton).toBeEnabled();

  await dashedButton.click();
  await expect(dashedButton).toHaveAttribute('aria-pressed', 'true');
});

test('connect workflow emits no console or page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  await page.getByTestId('bottom-tool-dock').getByLabel('Connect tool').click();
  await dragPortToPort(page, 'node-port-starter-sponsor-1', 'node-port-starter-network-3');
  await page.getByTestId('bottom-tool-dock').getByLabel('Select tool').click();
  await clickEdgeForSelection(page.locator('g[data-edge-id]').last());
  await page.keyboard.press('Delete');

  expect(errors, `Console/page errors captured: ${errors.join(' | ')}`).toEqual([]);
});
