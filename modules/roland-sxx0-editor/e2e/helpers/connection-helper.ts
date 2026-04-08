/**
 * Connection helper for E2E tests.
 *
 * Provides robust MIDI port selection with:
 * - Logging of available ports for debugging
 * - Fallback to first available port if specified port not found
 * - Clear error messages when no ports available
 */

import { type Page, expect } from '@playwright/test';

// Environment variables set by run-http-midi-e2e.sh
const MIDI_INPUT_PORT = process.env.E2E_MIDI_INPUT_PORT;
const MIDI_OUTPUT_PORT = process.env.E2E_MIDI_OUTPUT_PORT;

// Timeouts — HTTP MIDI transport needs time to query the midi-server
// for available ports before dropdowns populate
const UI_TIMEOUT_MS = 10_000;
const CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Result of port selection attempt.
 */
interface PortSelectionResult {
  selected: boolean;
  selectedValue: string | null;
  availablePorts: string[];
  requestedPort: string | null;
  fallbackUsed: boolean;
}

/**
 * Select a port from a dropdown, with fallback logic.
 *
 * Selection priority:
 * 1. If a specific port is requested (via env var), try to find and select it
 * 2. If requested port not found, fall back to first available port
 * 3. If no ports available, throw an error
 *
 * @param page - Playwright page
 * @param selectTestId - data-testid of the select element
 * @param requestedPortName - optional port name to prefer
 * @param portType - 'input' or 'output' for error messages
 * @returns Result of port selection
 */
async function selectPort(
  page: Page,
  selectTestId: string,
  requestedPortName: string | undefined,
  portType: 'input' | 'output'
): Promise<PortSelectionResult> {
  const select = page.locator(`[data-testid="${selectTestId}"]`);
  const options = await select.locator('option').all();

  // Collect available ports (excluding empty placeholder)
  const availablePorts: string[] = [];
  const portValues: Map<string, string> = new Map();

  for (const option of options) {
    const value = await option.getAttribute('value');
    const text = await option.textContent();
    if (value && value !== '' && text) {
      availablePorts.push(text.trim());
      portValues.set(text.trim(), value);
    }
  }

  // Log available ports for debugging
  console.log(`Available ${portType} ports:`, availablePorts);
  if (requestedPortName) {
    console.log(`Requested ${portType} port: ${requestedPortName}`);
  }

  // No ports available - throw error
  if (availablePorts.length === 0) {
    throw new Error(
      `No MIDI ${portType} ports available. ` +
        `Ensure midi-server is running and has access to MIDI devices.`
    );
  }

  // Try to find and select the requested port
  if (requestedPortName) {
    for (const [portText, portValue] of portValues) {
      if (portText.includes(requestedPortName) || requestedPortName.includes(portText)) {
        console.log(`Found matching ${portType} port: "${portText}"`);
        await select.selectOption(portValue);
        return {
          selected: true,
          selectedValue: portValue,
          availablePorts,
          requestedPort: requestedPortName,
          fallbackUsed: false,
        };
      }
    }

    // Requested port not found - log warning and fall back
    console.warn(
      `Requested ${portType} port "${requestedPortName}" not found in available ports: [${availablePorts.join(', ')}]. ` +
        `Falling back to first available port.`
    );
  }

  // Fall back to first available port
  const firstPort = availablePorts[0];
  const firstValue = portValues.get(firstPort);
  if (firstValue) {
    console.log(`Selecting first available ${portType} port: "${firstPort}"`);
    await select.selectOption(firstValue);
    return {
      selected: true,
      selectedValue: firstValue,
      availablePorts,
      requestedPort: requestedPortName ?? null,
      fallbackUsed: requestedPortName !== undefined,
    };
  }

  // Should not reach here, but handle edge case
  throw new Error(
    `Failed to select ${portType} port. Available ports: [${availablePorts.join(', ')}]`
  );
}

/**
 * Connect to device via the app's UI.
 *
 * Selects the discovered port pair (from device validation) or first available.
 * Provides detailed logging and clear error messages for debugging.
 *
 * @param page - Playwright page
 * @throws Error if no ports available or connection fails
 */
export async function connectToDevice(page: Page): Promise<void> {
  const midiServerPort = process.env.E2E_MIDI_SERVER_PORT;

  if (midiServerPort) {
    // HTTP MIDI transport: the app auto-connects when loaded with
    // ?midi=http&midiServerPort=... query params. No port selection UI needed.
    // Just wait for the connection to be established.
    console.log(`HTTP MIDI transport: waiting for auto-connection to midi-server on port ${midiServerPort}`);
    await page.waitForFunction(
      () => {
        const store = (window as unknown as Record<string, unknown>).__midiStore as
          | { getState: () => { status: string } }
          | undefined;
        return store?.getState().status === 'connected';
      },
      { timeout: CONNECTION_TIMEOUT_MS },
    );
    console.log('Successfully connected to device via HTTP MIDI');
    return;
  }

  // WebMIDI transport: select ports manually via dropdowns.
  // This path is not usable in automated tests (browser permission prompt
  // blocks automation), but kept for completeness.
  const inputSelect = page.locator('[data-testid="midi-input-select"]');
  await inputSelect.waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });

  await page.waitForFunction(
    () => {
      const select = document.querySelector(
        '[data-testid="midi-input-select"]'
      ) as HTMLSelectElement | null;
      return select && select.options.length > 1;
    },
    { timeout: UI_TIMEOUT_MS }
  );

  const inputResult = await selectPort(page, 'midi-input-select', MIDI_INPUT_PORT, 'input');
  const outputResult = await selectPort(page, 'midi-output-select', MIDI_OUTPUT_PORT, 'output');

  console.log('Port selection complete:', {
    input: { selected: inputResult.selectedValue, requested: inputResult.requestedPort },
    output: { selected: outputResult.selectedValue, requested: outputResult.requestedPort },
  });

  const connectButton = page.locator('[data-testid="connect-button"]');
  await connectButton.click();

  await page.waitForFunction(
    () => {
      const store = (window as unknown as Record<string, unknown>).__midiStore as
        | { getState: () => { status: string } }
        | undefined;
      return store?.getState().status === 'connected';
    },
    { timeout: CONNECTION_TIMEOUT_MS }
  );

  console.log('Successfully connected to device');
}

/**
 * Navigate to the Library page.
 *
 * This is separated from connectToOPFS so that test data can be written
 * to OPFS BEFORE connecting. The app loads library contents when connecting,
 * so data must exist before the connect button is clicked.
 *
 * @param page - Playwright page
 */
export async function navigateToLibrary(page: Page): Promise<void> {
  const libraryLink = page.locator('[data-testid="library-nav-link"]');
  await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await libraryLink.click();
  await page.waitForURL('**/library**');
  console.log('Navigated to Library page');
}

/**
 * Connect to OPFS library backend via the UI.
 *
 * Clicks the "Browser Storage" button to connect to OPFS.
 * The app will then read/write from the same OPFS storage that
 * test code accesses via navigator.storage.getDirectory().
 *
 * IMPORTANT: The app loads library contents when this button is clicked.
 * If you need test data to be visible to the app, write it to OPFS BEFORE
 * calling this function.
 *
 * @param page - Playwright page
 * @throws Error if connection fails or timeout
 */
export async function connectToOPFS(page: Page): Promise<void> {
  const opfsButton = page.locator('[data-testid="library-backend-opfs"]');
  await expect(opfsButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await opfsButton.click();

  // Wait for connection status indicator to show connected state
  await expect(page.locator('.ac-library-connection-status')).toBeVisible({
    timeout: UI_TIMEOUT_MS,
  });

  console.log('Successfully connected to OPFS library backend');
}

/**
 * Helper to wait for the app to be ready (MIDI store initialized)
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__midiStore !== undefined,
    { timeout: UI_TIMEOUT_MS }
  );
}

/**
 * Helper to get MIDI connection status from the app's store
 */
export async function getMidiStatus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as unknown as Record<string, unknown>).__midiStore as {
      getState: () => { status: string };
    };
    return store.getState().status;
  });
}

/**
 * Helper to check if connection UI is available
 */
export async function hasConnectionUI(page: Page): Promise<boolean> {
  const inputSelect = page.locator('[data-testid="midi-input-select"]');
  return (await inputSelect.count()) > 0;
}
