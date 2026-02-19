import { expect, test } from '@playwright/test';
import { insertStarterTemplate } from './helpers/diagramSetup';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await insertStarterTemplate(page);
});

test('diamond node label stays within bounds at high zoom', async ({ page }) => {
  const sponsorNode = page.locator('[data-node-id="starter-sponsor"]').first();
  await expect(sponsorNode).toBeVisible();
  await sponsorNode.click();

  const typeSelect = page.locator('#node-field-type');
  await typeSelect.selectOption('Compliance Gate');

  const nameInput = page.locator('#node-field-label');
  const longLabel = 'Compliance Gate Risk Controls and Policy Checks';
  await nameInput.fill(longLabel);
  await nameInput.blur();

  const appearanceToggle = page.getByText('Appearance', { exact: true }).first();
  if ((await appearanceToggle.count()) > 0) {
    await appearanceToggle.click();
  }
  const diamondShapeButton = page.getByRole('button', { name: /Diamond/i }).first();
  await expect(diamondShapeButton).toBeVisible();
  await diamondShapeButton.click();

  const zoomTrigger = page.getByTestId('bottom-zoom-menu-trigger');
  await zoomTrigger.click();
  const zoom200 = page.getByTestId('bottom-zoom-set-200');
  const zoom150 = page.getByTestId('bottom-zoom-set-150');
  if ((await zoom200.count()) > 0) {
    await zoom200.click();
  } else if ((await zoom150.count()) > 0) {
    await zoom150.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await sponsorNode.click();

  const title = sponsorNode.getByTestId('node-title-starter-sponsor').first();
  await expect(title).toBeVisible();

  const nodeBox = await sponsorNode.boundingBox();
  const titleBox = await title.boundingBox();
  expect(nodeBox).toBeTruthy();
  expect(titleBox).toBeTruthy();
  if (!nodeBox || !titleBox) {
    throw new Error('Missing node/title geometry for diamond text-fit assertion.');
  }

  const lineCount = await title.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight || '0') || 14;
    return Math.round((element as HTMLElement).clientHeight / lineHeight);
  });

  const notOverflowing = await title.evaluate(
    (element) => (element as HTMLElement).scrollWidth <= (element as HTMLElement).clientWidth + 2
  );

  const insideNode =
    titleBox.x >= nodeBox.x + 2 &&
    titleBox.x + titleBox.width <= nodeBox.x + nodeBox.width - 2 &&
    titleBox.y >= nodeBox.y + 2 &&
    titleBox.y + titleBox.height <= nodeBox.y + nodeBox.height - 2;

  const withinBounds = insideNode && notOverflowing && lineCount <= 2;

  expect(withinBounds).toBe(true);
});
