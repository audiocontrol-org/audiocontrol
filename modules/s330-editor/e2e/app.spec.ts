import { test, expect } from '@playwright/test';

test.describe('S-330 Editor App', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle('Roland S-330 Editor');

    // Check header is visible - use specific selector for the logo
    await expect(page.locator('h1 >> text=S-330')).toBeVisible();
    await expect(page.locator('h1 >> text=Editor')).toBeVisible();
  });

  test('should show navigation tabs', async ({ page }) => {
    await page.goto('/');

    // Check all navigation items are present
    await expect(page.locator('nav >> text=Connect')).toBeVisible();
    await expect(page.locator('nav >> text=Patches')).toBeVisible();
    await expect(page.locator('nav >> text=Tones')).toBeVisible();
    await expect(page.locator('nav >> text=Sampling')).toBeVisible();
    await expect(page.locator('nav >> text=Library')).toBeVisible();
  });

  test('should show MIDI connection card on home page', async ({ page }) => {
    await page.goto('/');

    // Check for connection UI elements
    await expect(page.locator('text=Connect to S-330')).toBeVisible();
    await expect(page.locator('text=MIDI Input')).toBeVisible();
    await expect(page.locator('text=MIDI Output')).toBeVisible();
  });

  test('should show device ID selector', async ({ page }) => {
    await page.goto('/');

    // Check for device ID section - use heading selector
    await expect(page.getByRole('heading', { name: 'Device ID' })).toBeVisible();

    // Check for device ID input - displays 1-17 (S-330 screen values)
    // Default is 1 (display), which maps to protocol value 0
    const deviceIdInput = page.locator('input[type="number"]');
    await expect(deviceIdInput).toBeVisible();
    await expect(deviceIdInput).toHaveValue('1');
  });

  test('should show connection help section', async ({ page }) => {
    await page.goto('/');

    // Check help section - use heading selector
    await expect(page.getByRole('heading', { name: 'Connection Help' })).toBeVisible();
    await expect(page.getByText('MIDI Interface:', { exact: true })).toBeVisible();
  });

  test('should navigate to Patches page', async ({ page }) => {
    await page.goto('/');

    // Click Patches nav link
    await page.click('nav >> text=Patches');

    // Should show not connected message
    await expect(page.locator('text=Not Connected')).toBeVisible();
    await expect(page.locator('text=Connect to your S-330')).toBeVisible();
  });

  test('should navigate to Tones page', async ({ page }) => {
    await page.goto('/');

    // Click Tones nav link
    await page.click('nav >> text=Tones');

    // Should show not connected message
    await expect(page.locator('text=Not Connected')).toBeVisible();
  });

  test('should navigate to Sampling page', async ({ page }) => {
    await page.goto('/');

    // Click Sampling nav link
    await page.click('nav >> text=Sampling');

    // Should show not connected message
    await expect(page.locator('text=Not Connected')).toBeVisible();
  });

  test('should navigate to Library page', async ({ page }) => {
    await page.goto('/');

    // Click Library nav link
    await page.click('nav >> text=Library');

    // Should show library content - use heading selectors
    await expect(page.locator('h2 >> text=Library')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Saved Patches' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Import / Export' })).toBeVisible();
  });

  test('should show MIDI status indicator', async ({ page }) => {
    await page.goto('/');

    // Check for status indicator - should show Disconnected
    await expect(page.locator('text=Disconnected')).toBeVisible();
  });

  test('should have working Refresh Ports button', async ({ page }) => {
    await page.goto('/');

    // Find and click the Refresh Ports button
    const refreshButton = page.locator('button >> text=Refresh');
    await expect(refreshButton).toBeVisible();

    // Click should not throw errors
    await refreshButton.click();

    // Page should still be functional
    await expect(page.locator('text=Connect to S-330')).toBeVisible();
  });

  test('should allow changing device ID', async ({ page }) => {
    await page.goto('/');

    const deviceIdInput = page.locator('input[type="number"]');

    // Clear and type new value (display values are 1-17)
    await deviceIdInput.fill('5');

    // Verify the value changed
    await expect(deviceIdInput).toHaveValue('5');
  });

  test('should show footer with browser info', async ({ page }) => {
    await page.goto('/');

    // Check footer content
    await expect(page.locator('text=Web MIDI API')).toBeVisible();
    await expect(page.locator('text=Chrome, Edge, or Opera')).toBeVisible();
  });

  test('should redirect unknown routes to home', async ({ page }) => {
    await page.goto('/unknown-route');

    // Should redirect to home page
    await expect(page.locator('text=Connect to S-330')).toBeVisible();
  });
});

test.describe('Patches Page', () => {
  test('should show link back to connection when not connected', async ({ page }) => {
    await page.goto('/patches');

    // Check for the link to go back to connection
    const connectLink = page.locator('a >> text=Go to Connection');
    await expect(connectLink).toBeVisible();

    // Click should navigate to home
    await connectLink.click();
    await expect(page.locator('text=Connect to S-330')).toBeVisible();
  });
});

test.describe('Tones Page', () => {
  test('should show link back to connection when not connected', async ({ page }) => {
    await page.goto('/tones');

    const connectLink = page.locator('a >> text=Go to Connection');
    await expect(connectLink).toBeVisible();
  });
});

test.describe('Library Page', () => {
  test('should show empty state for saved patches', async ({ page }) => {
    await page.goto('/library');

    await expect(page.locator('text=No saved patches yet')).toBeVisible();
  });

  test('should show import/export section', async ({ page }) => {
    await page.goto('/library');

    await expect(page.locator('button >> text=Import JSON')).toBeVisible();
    await expect(page.locator('button >> text=Export All')).toBeVisible();
  });

  test('should show storage info', async ({ page }) => {
    await page.goto('/library');

    await expect(page.getByRole('heading', { name: 'Storage Info' })).toBeVisible();
    await expect(page.getByText('Storage Type:', { exact: true })).toBeVisible();
  });
});

test.describe('Sampling Page', () => {
  test('should show recording section placeholder', async ({ page }) => {
    // First need to be "connected" - but since we can't mock MIDI,
    // we'll just verify the page redirects to connection
    await page.goto('/sampling');

    await expect(page.locator('text=Not Connected')).toBeVisible();
  });
});
