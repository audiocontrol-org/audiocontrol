#!/usr/bin/env tsx

/**
 * Web Editor Automation - Phase 2 Playwright Automation for Novation Web Editor
 *
 * This class provides automated interaction with the Novation Launch Control XL 3 web editor
 * for systematic protocol reverse engineering.
 *
 * Features:
 * - Browser automation using Playwright
 * - Web MIDI API interaction
 * - Device connection handling
 * - Systematic action execution
 * - Integration with MIDI monitoring infrastructure
 *
 * Target URL: https://components.novationmusic.com/launch-control-xl-3/custom-modes
 */

import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { MidiMonitor } from './midi-monitor.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Configuration for web editor automation
export interface WebEditorConfig {
  readonly headless?: boolean;
  readonly timeout?: number;
  readonly slowMo?: number;
  readonly devtools?: boolean;
  readonly recordVideo?: boolean;
  readonly recordScreenshots?: boolean;
  readonly outputDir?: string;
}

// Device connection state
export interface DeviceConnectionState {
  readonly isConnected: boolean;
  readonly deviceName?: string;
  readonly deviceId?: string;
  readonly firmwareVersion?: string;
  readonly lastConnectionTime?: number;
}

// Web editor session data
export interface WebEditorSession {
  readonly sessionId: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly config: WebEditorConfig;
  readonly connectionState: DeviceConnectionState;
  readonly actionsExecuted: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Web Editor Automation Controller
 *
 * Handles browser automation for the Novation web editor with integrated MIDI monitoring
 */
export class WebEditorAutomation {
  private readonly config: WebEditorConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private midiMonitor: MidiMonitor | null = null;
  private sessionId: string;
  private startTime: number = 0;
  private connectionState: DeviceConnectionState = { isConnected: false };
  private actionsExecuted: string[] = [];
  private errors: string[] = [];

  // Web Editor Constants
  private static readonly WEB_EDITOR_URL = 'https://components.novationmusic.com/launch-control-xl-3/custom-modes';
  private static readonly DEVICE_CONNECTION_TIMEOUT = 30000; // 30 seconds
  private static readonly PAGE_LOAD_TIMEOUT = 60000; // 60 seconds

  constructor(config: WebEditorConfig = {}) {
    this.config = {
      headless: false, // Default to visible for debugging
      timeout: 30000,
      slowMo: 100, // Slow down actions for better observation
      devtools: false,
      recordVideo: false,
      recordScreenshots: true,
      outputDir: './playwright-sessions',
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.ensureOutputDirectory();
  }

  /**
   * Launch the web editor in a browser
   */
  async launchEditor(): Promise<void> {
    try {
      console.log('🚀 Launching Web Editor Automation');
      console.log('═'.repeat(60));

      this.startTime = Date.now();

      // Launch browser with Web MIDI API support
      this.browser = await chromium.launch({
        headless: this.config.headless,
        slowMo: this.config.slowMo,
        devtools: this.config.devtools,
        args: [
          '--enable-web-midi', // Enable Web MIDI API
          '--disable-web-security', // Allow MIDI access
          '--allow-running-insecure-content',
          '--disable-features=VizDisplayCompositor',
        ],
      });

      // Create browser context with permissions
      this.context = await this.browser.newContext({
        permissions: ['midi', 'midi-sysex'], // Grant MIDI permissions
        recordVideo: this.config.recordVideo ? {
          dir: join(this.config.outputDir!, 'videos'),
          size: { width: 1280, height: 720 }
        } : undefined,
      });

      // Create new page
      this.page = await this.context.newPage();

      // Set timeouts
      this.page.setDefaultTimeout(this.config.timeout!);
      this.page.setDefaultNavigationTimeout(WebEditorAutomation.PAGE_LOAD_TIMEOUT);

      // Add console logging for debugging
      this.page.on('console', (msg) => {
        console.log(`🌐 Browser Console [${msg.type()}]: ${msg.text()}`);
      });

      // Handle dialog boxes
      this.page.on('dialog', async (dialog) => {
        console.log(`🗨️  Dialog: ${dialog.message()}`);
        await dialog.accept();
      });

      // Navigate to web editor
      console.log(`🌐 Navigating to: ${WebEditorAutomation.WEB_EDITOR_URL}`);
      await this.page.goto(WebEditorAutomation.WEB_EDITOR_URL, {
        waitUntil: 'networkidle',
        timeout: WebEditorAutomation.PAGE_LOAD_TIMEOUT
      });

      // Wait for page to be fully loaded
      await this.waitForEditorReady();

      this.actionsExecuted.push('launch_editor');
      console.log('✅ Web editor launched successfully');

    } catch (error: any) {
      const errorMsg = `Failed to launch web editor: ${error.message}`;
      this.errors.push(errorMsg);
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Connect to the Launch Control XL 3 device through Web MIDI API
   */
  async connectToDevice(deviceName: string = 'LCXL3'): Promise<void> {
    if (!this.page) {
      throw new Error('Web editor not launched. Call launchEditor() first.');
    }

    try {
      console.log(`🎛️  Attempting to connect to device: ${deviceName}`);

      // Execute Web MIDI connection script in browser
      const connectionResult = await this.page.evaluate(async (targetDeviceName) => {
        try {
          // Request MIDI access with SysEx support
          const midiAccess = await (navigator as any).requestMIDIAccess({ sysex: true });

          // Find the target device
          let targetInput: any = null;
          let targetOutput: any = null;

          // Check inputs
          for (const [id, input] of midiAccess.inputs) {
            console.log(`Found MIDI input: ${input.name}`);
            if (input.name?.includes(targetDeviceName)) {
              targetInput = input;
              break;
            }
          }

          // Check outputs
          for (const [id, output] of midiAccess.outputs) {
            console.log(`Found MIDI output: ${output.name}`);
            if (output.name?.includes(targetDeviceName)) {
              targetOutput = output;
              break;
            }
          }

          if (!targetInput || !targetOutput) {
            const availableDevices = {
              inputs: Array.from(midiAccess.inputs.values()).map((input: any) => input.name),
              outputs: Array.from(midiAccess.outputs.values()).map((output: any) => output.name),
            };
            return {
              success: false,
              error: `Device "${targetDeviceName}" not found`,
              availableDevices,
            };
          }

          // Store references globally for the web editor to use
          (window as any).__lcxl3_midi_input = targetInput;
          (window as any).__lcxl3_midi_output = targetOutput;

          return {
            success: true,
            deviceName: targetInput.name,
            deviceId: targetInput.id,
          };

        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      }, deviceName);

      if (!connectionResult.success) {
        const errorMsg = `Device connection failed: ${connectionResult.error}`;
        this.errors.push(errorMsg);

        if (connectionResult.availableDevices) {
          console.log('📱 Available MIDI devices:');
          console.log('   Inputs:', connectionResult.availableDevices.inputs);
          console.log('   Outputs:', connectionResult.availableDevices.outputs);
        }

        throw new Error(errorMsg);
      }

      // Update connection state
      this.connectionState = {
        isConnected: true,
        deviceName: connectionResult.deviceName,
        deviceId: connectionResult.deviceId,
        lastConnectionTime: Date.now(),
      };

      this.actionsExecuted.push('connect_device');
      console.log(`✅ Connected to device: ${connectionResult.deviceName}`);

    } catch (error: any) {
      const errorMsg = `Failed to connect to device: ${error.message}`;
      this.errors.push(errorMsg);
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Start MIDI monitoring in parallel with web actions
   */
  async startMidiMonitoring(): Promise<void> {
    try {
      console.log('🎵 Starting integrated MIDI monitoring');

      // Create MIDI monitor with session-specific configuration
      this.midiMonitor = new MidiMonitor({
        deviceFilter: 'LCXL3',
        outputDir: this.config.outputDir,
        sessionName: `web-automation-${this.sessionId}`,
        verboseLogging: true,
        bufferMessages: true,
      });

      await this.midiMonitor.startMonitoring();
      console.log('✅ MIDI monitoring started');

    } catch (error: any) {
      const errorMsg = `Failed to start MIDI monitoring: ${error.message}`;
      this.errors.push(errorMsg);
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Stop MIDI monitoring and save session data
   */
  async stopMidiMonitoring(): Promise<void> {
    if (this.midiMonitor) {
      try {
        const session = await this.midiMonitor.stopMonitoring();
        console.log(`✅ MIDI monitoring stopped. Captured ${session.messages.length} messages`);
      } catch (error: any) {
        console.error('❌ Error stopping MIDI monitoring:', error.message);
      }
    }
  }

  /**
   * Wait for device to be ready and responsive
   */
  async waitForDeviceReady(): Promise<void> {
    if (!this.connectionState.isConnected) {
      throw new Error('Device not connected. Call connectToDevice() first.');
    }

    console.log('⏳ Waiting for device to be ready...');

    // Add a reasonable delay for device initialization
    await this.page!.waitForTimeout(2000);

    // TODO: Add device ping/handshake if needed
    console.log('✅ Device ready');
  }

  /**
   * Take a screenshot of the current state
   */
  async takeScreenshot(name?: string): Promise<string> {
    if (!this.page) {
      throw new Error('Page not available');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name || 'screenshot'}-${timestamp}.png`;
    const filepath = join(this.config.outputDir!, 'screenshots', filename);

    // Ensure screenshots directory exists
    const screenshotsDir = join(this.config.outputDir!, 'screenshots');
    if (!existsSync(screenshotsDir)) {
      mkdirSync(screenshotsDir, { recursive: true });
    }

    await this.page.screenshot({
      path: filepath,
      fullPage: true
    });

    console.log(`📸 Screenshot saved: ${filepath}`);
    return filepath;
  }

  /**
   * Get current page instance for external action execution
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Web editor not launched. Call launchEditor() first.');
    }
    return this.page;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): DeviceConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Clean up and close browser resources
   */
  async close(): Promise<WebEditorSession> {
    try {
      // Stop MIDI monitoring
      await this.stopMidiMonitoring();

      // Save session data
      const session: WebEditorSession = {
        sessionId: this.sessionId,
        startTime: this.startTime,
        endTime: Date.now(),
        config: this.config,
        connectionState: this.connectionState,
        actionsExecuted: [...this.actionsExecuted],
        errors: [...this.errors],
      };

      // Save session metadata
      const sessionFile = join(this.config.outputDir!, `session-${this.sessionId}.json`);
      writeFileSync(sessionFile, JSON.stringify(session, null, 2));

      // Close browser
      if (this.browser) {
        await this.browser.close();
        console.log('🔒 Browser closed');
      }

      console.log(`📊 Session completed: ${session.actionsExecuted.length} actions, ${session.errors.length} errors`);
      console.log(`💾 Session data saved: ${sessionFile}`);

      return session;

    } catch (error: any) {
      console.error('❌ Error during cleanup:', error.message);
      throw error;
    }
  }

  /**
   * Wait for the web editor to be fully loaded and ready
   */
  private async waitForEditorReady(): Promise<void> {
    if (!this.page) return;

    try {
      // Wait for common web editor elements to be present
      // These selectors may need to be updated based on actual web editor structure
      await Promise.race([
        this.page.waitForSelector('body', { timeout: 10000 }),
        this.page.waitForLoadState('networkidle', { timeout: 10000 }),
      ]);

      // Additional wait for potential JavaScript initialization
      await this.page.waitForTimeout(2000);

    } catch (error: any) {
      console.warn('⚠️  Editor ready check timed out, proceeding anyway');
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `web-automation-${timestamp}-${random}`;
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!existsSync(this.config.outputDir!)) {
      mkdirSync(this.config.outputDir!, { recursive: true });
    }
  }
}

/**
 * Factory function for creating WebEditorAutomation instances
 */
export function createWebEditorAutomation(config?: WebEditorConfig): WebEditorAutomation {
  return new WebEditorAutomation(config);
}