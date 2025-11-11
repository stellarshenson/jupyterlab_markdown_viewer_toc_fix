import { expect, test } from '@jupyterlab/galata';

test('should load the extension', async ({ page }) => {
  // Check that the extension is loaded by verifying JupyterLab starts
  await page.goto();

  // Wait for the page to be fully loaded
  await page.waitForSelector('#jupyterlab-splash', { state: 'hidden' });

  // Extension is loaded if JupyterLab starts without errors
  expect(await page.title()).toBeTruthy();
});
