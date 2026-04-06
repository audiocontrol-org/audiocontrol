/**
 * Shared connection helper for E2E tests.
 *
 * Provides robust MIDI port selection with:
 * - Logging of available ports for debugging
 * - Fallback to first available port if specified port not found
 * - Clear error messages when no ports available
 * - Configurable store key for different editor implementations
 */

import { type Page, expect } from '@playwright/test';

// Environment variables set by run-http-midi-e2e.sh
const MIDI_INPUT_PORT = process.env.E2E_MIDI_INPUT_PORT;
const MIDI_OUTPUT_PORT = process.env.E2E_MIDI_OUTPUT_PORT;

// Timeouts
const UI_TIMEOUT_MS = 2000;
const CONNECTION_TIMEOUT_MS = 5000;

/** Default window property where editors expose their MIDI store. */
const DEFAULT_STORE_KEY = '__midiStore';

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
 * Build a URL for an editor page, optionally appending HTTP MIDI parameters.
 *
 * @param basePath - Editor base path (e.g., '/akai/s3000xl/editor')
 * @param subpath - Optional subpath within the editor (e.g., 'programs')
 * @param midiServerPort - If set, appends midi=http&midiServerPort= query params
 */
export function buildUrl(basePath: string, subpath: string = '', midiServerPort?: string): string {
  const normalized = subpath === '/' ? '' : subpath;
  const fullPath = normalized ? `${basePath}/${normalized}` : basePath;
  if (!midiServerPort) return fullPath;
  const separator = fullPath.includes('?') ? '&' : '?';
  return `${fullPath}${separator}midi=http&midiServerPort=${midiServerPort}`;
}

/**
 * Build a URL for an editor page with SCSI MIDI bridge parameters.
 *
 * @param basePath - Editor base path (e.g., '/akai/s3000xl/editor')
 * @param subpath - Optional subpath within the editor
 * @param bridgeUrl - SCSI bridge URL (e.g., 'http://s3k.local:7033')
 */
export function buildScsiUrl(basePath: string, subpath: string = '', bridgeUrl?: string): string {
  const normalized = subpath === '/' ? '' : subpath;
  const fullPath = normalized ? `${basePath}/${normalized}` : basePath;
  if (!bridgeUrl) return fullPath;
  const separator = fullPath.includes('?') ? '&' : '?';
  return `${fullPath}${separator}midi=scsi&scsiBridgeUrl=${encodeURIComponent(bridgeUrl)}`;
}

/**
 * Select a port from a dropdown, with fallback logic.
 *
 * Selection priority:
 * 1. If a specific port is requested (via env var), try to find and select it
 * 2. If requested port not found, fall back to first available port
 * 3. If no ports available, throw an error
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
 * @param storeKey - Window property name for the MIDI store (default: '__midiStore')
 * @throws Error if no ports available or connection fails
 */
export async function connectToDevice(page: Page, storeKey: string = DEFAULT_STORE_KEY): Promise<void> {
  // Wait for port selectors to have options loaded
  const inputSelect = page.locator('[data-testid="midi-input-select"]');
  await inputSelect.waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });

  // Wait for options to be populated (more than just the placeholder)
  await page.waitForFunction(
    () => {
      const select = document.querySelector(
        '[data-testid="midi-input-select"]'
      ) as HTMLSelectElement | null;
      return select && select.options.length > 1;
    },
    { timeout: UI_TIMEOUT_MS }
  );

  // Select input port
  const inputResult = await selectPort(page, 'midi-input-select', MIDI_INPUT_PORT, 'input');

  // Select output port
  const outputResult = await selectPort(page, 'midi-output-select', MIDI_OUTPUT_PORT, 'output');

  // Log selection summary
  console.log('Port selection complete:', {
    input: {
      selected: inputResult.selectedValue,
      requested: inputResult.requestedPort,
      fallbackUsed: inputResult.fallbackUsed,
    },
    output: {
      selected: outputResult.selectedValue,
      requested: outputResult.requestedPort,
      fallbackUsed: outputResult.fallbackUsed,
    },
  });

  // Click connect button
  const connectButton = page.locator('[data-testid="connect-button"]');
  await connectButton.click();

  // Wait for connection to complete
  await page.waitForFunction(
    (key: string) => {
      const store = (window as unknown as Record<string, unknown>)[key] as
        | {
            getState: () => { status: string };
          }
        | undefined;
      return store?.getState().status === 'connected';
    },
    storeKey,
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
 * Helper to wait for the app to be ready (MIDI store initialized).
 *
 * @param page - Playwright page
 * @param storeKey - Window property name for the MIDI store (default: '__midiStore')
 */
export async function waitForAppReady(page: Page, storeKey: string = DEFAULT_STORE_KEY): Promise<void> {
  await page.waitForFunction(
    (key: string) => (window as unknown as Record<string, unknown>)[key] !== undefined,
    storeKey,
    { timeout: UI_TIMEOUT_MS }
  );
}

/**
 * Helper to get MIDI connection status from the app's store.
 *
 * @param page - Playwright page
 * @param storeKey - Window property name for the MIDI store (default: '__midiStore')
 */
export async function getMidiStatus(page: Page, storeKey: string = DEFAULT_STORE_KEY): Promise<string> {
  return page.evaluate((key: string) => {
    const store = (window as unknown as Record<string, unknown>)[key] as {
      getState: () => { status: string };
    };
    return store.getState().status;
  }, storeKey);
}

/**
 * Helper to check if connection UI is available.
 */
export async function hasConnectionUI(page: Page): Promise<boolean> {
  const inputSelect = page.locator('[data-testid="midi-input-select"]');
  return (await inputSelect.count()) > 0;
}
