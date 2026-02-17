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
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    menu.getByTestId('toolbar-export-json').click()
  ]);
  return readDownloadText(download);
};

const countEdges = async (page: Page) =>
  page.locator('[data-testid^="edge-"]:not([data-testid^="edge-label-"])').count();

const dragEdgeHandleToNode = async (page: Page, edgeHandleTestId: string, nodeId: string) => {
  const handle = page.getByTestId(edgeHandleTestId);
  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();
  if (!handleBox) {
    throw new Error('Could not resolve reconnect handle bounds.');
  }
  console.log('edge-reconnect-handle-box', handleBox);
  const targetNode = page.locator(`[data-node-id="${nodeId}"]`).first();
  await expect(targetNode).toBeVisible();
  const nodeBox = await targetNode.boundingBox();
  if (!nodeBox) {
    throw new Error('Could not resolve reconnect target node bounds.');
  }
  console.log('edge-reconnect-target-node-box', nodeBox);

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('cancel-pending-connection')).toBeVisible();
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2, { steps: 14 });
  await page.mouse.up();
};

const getSelectedEdgeIdFromReconnectHandles = async (page: Page) =>
  page.evaluate(() => {
    const handle = document.querySelector(
      '[data-testid^="edgepoint-source-"], [data-testid^="edgepoint-target-"]'
    ) as HTMLElement | null;
    if (!handle) return null;
    const testId = handle.getAttribute('data-testid') || '';
    const match = /^edgepoint-(?:source|target)-(.+)$/.exec(testId);
    return match ? match[1] : null;
  });

const getEdgeScreenPoint = async (page: Page, edgeId: string, ratio = 0.5) =>
  page.evaluate(
    ({ edgeId: targetEdgeId, ratio: targetRatio }) => {
      const host = document.querySelector(`[data-edge-id="${targetEdgeId}"]`);
      if (!host) return null;
      const path = host.querySelector('path');
      if (!(path instanceof SVGPathElement)) return null;
      const length = path.getTotalLength();
      if (!Number.isFinite(length) || length <= 0) return null;
      const clampedRatio = Math.max(0, Math.min(1, targetRatio));
      const localPoint = path.getPointAtLength(length * clampedRatio);
      const screenMatrix = path.getScreenCTM();
      if (!screenMatrix) return null;
      const screenPoint = new DOMPoint(localPoint.x, localPoint.y).matrixTransform(screenMatrix);
      return { x: screenPoint.x, y: screenPoint.y };
    },
    { edgeId, ratio }
  );

test('selected edge endpoint can be reconnected to a new target port', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await insertStarterTemplate(page);

  await page.getByTestId('edge-starter-edge-1').click();
  await dragEdgeHandleToNode(page, 'edgepoint-target-starter-edge-1', 'starter-network');

  const payloadText = await exportDiagramText(page);
  const payload = JSON.parse(payloadText) as {
    diagram?: { edges?: Array<{ id?: string; sourceId?: string; targetId?: string }> };
  };

  const edge = payload.diagram?.edges?.find((candidate) => candidate.id === 'starter-edge-1');
  expect(edge?.sourceId).toBe('starter-sponsor');
  expect(edge?.targetId).toBe('starter-network');
});

test('clicking overlapping edge area keeps reconnect selection actionable', async ({ page }) => {
  const workspaceId = 'ws-overlap-reconnect';
  const nowIso = new Date().toISOString();
  await page.addInitScript(
    ({ wsId, timestamp }) => {
      window.localStorage.clear();
      const snapshot = {
        schemaVersion: 2,
        nodes: [
          {
            id: 'starter-sponsor',
            type: 'Sponsor Bank',
            label: 'Sponsor Bank',
            shape: 'rectangle',
            position: { x: 240, y: 320 },
            swimlaneId: 2
          },
          {
            id: 'starter-processor',
            type: 'Processor',
            label: 'Processor',
            shape: 'rectangle',
            position: { x: 520, y: 320 },
            swimlaneId: 2
          }
        ],
        edges: [
          {
            id: 'overlap-a',
            sourceId: 'starter-sponsor',
            targetId: 'starter-processor',
            sourcePortIdx: 1,
            targetPortIdx: 3,
            rail: 'ACH',
            direction: 'Push (Credit)',
            label: 'Funding A',
            isFX: false,
            thickness: 2,
            style: 'solid',
            showArrowHead: true,
            showMidArrow: false,
            pathType: 'bezier'
          },
          {
            id: 'overlap-b',
            sourceId: 'starter-sponsor',
            targetId: 'starter-processor',
            sourcePortIdx: 1,
            targetPortIdx: 3,
            rail: 'ACH',
            direction: 'Push (Credit)',
            label: 'Funding B',
            isFX: false,
            thickness: 2,
            style: 'dashed',
            showArrowHead: true,
            showMidArrow: false,
            pathType: 'bezier'
          }
        ],
        drawings: []
      };
      const layout = {
        showSwimlanes: true,
        swimlaneLabels: ['Funding', 'Authorization', 'Clearing', 'Settlement'],
        gridMode: 'dots',
        isDarkMode: false,
        showPorts: false
      };
      const workspaceSummary = [
        {
          workspaceId: wsId,
          name: 'Overlap QA',
          createdAt: timestamp,
          updatedAt: timestamp,
          lastOpenedAt: timestamp
        }
      ];
      window.localStorage.setItem('fof:workspaces:index', JSON.stringify(workspaceSummary));
      window.localStorage.setItem('fof:active-workspace-id', wsId);
      window.localStorage.setItem(`fof:workspace:${wsId}`, JSON.stringify(snapshot));
      window.localStorage.setItem(`fof:workspace:${wsId}:layout`, JSON.stringify(layout));
      window.localStorage.setItem('finflow-builder.quickstart.dismissed.v1', 'true');
    },
    { wsId: workspaceId, timestamp: nowIso }
  );
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect.poll(async () => countEdges(page)).toBe(2);

  const overlapPoint = await getEdgeScreenPoint(page, 'overlap-a', 0.5);
  expect(overlapPoint).not.toBeNull();
  if (!overlapPoint) {
    return;
  }

  await page.mouse.click(overlapPoint.x, overlapPoint.y);
  await expect.poll(async () => getSelectedEdgeIdFromReconnectHandles(page), { timeout: 3000 }).not.toBeNull();
  const firstSelection = await getSelectedEdgeIdFromReconnectHandles(page);
  expect(firstSelection).not.toBeNull();
  expect(['overlap-a', 'overlap-b']).toContain(firstSelection);

  await page.mouse.click(overlapPoint.x, overlapPoint.y);
  await expect.poll(async () => getSelectedEdgeIdFromReconnectHandles(page), { timeout: 3000 }).not.toBeNull();
  const secondSelection = await getSelectedEdgeIdFromReconnectHandles(page);
  expect(secondSelection).not.toBeNull();
  expect(['overlap-a', 'overlap-b']).toContain(secondSelection);
});
