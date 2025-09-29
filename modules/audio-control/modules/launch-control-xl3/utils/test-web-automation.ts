#!/usr/bin/env tsx

/**
 * Test Web Automation - Phase 2 Testing and Validation Script
 *
 * This script provides a test interface for the Playwright web editor automation,
 * allowing for manual testing and validation of the automation infrastructure
 * before running full protocol reverse engineering sessions.
 *
 * Usage:
 *   tsx utils/test-web-automation.ts [options]
 *
 * Options:
 *   --mode=<mode>           Test mode: 'basic', 'device', 'actions', 'full'
 *   --headless=<bool>       Run in headless mode (default: false)
 *   --slow-mo=<ms>          Slow motion delay (default: 100)
 *   --device=<name>         Device name filter (default: 'LCXL3')
 *   --actions=<names>       Comma-separated action names to test
 *   --screenshots           Take screenshots during testing
 *   --help                  Show help information
 */

import { WebEditorAutomation, createWebEditorAutomation } from './web-editor-automation.js';
import { ProtocolReverseEngineer, createProtocolReverseEngineer } from './protocol-reverse-engineer.js';
import {
  TestAction,
  getActionByName,
  getActionsByCategory,
  ALL_TEST_ACTIONS,
  TEST_ACTION_CATEGORIES
} from './playwright-test-actions.js';
import { existsSync } from 'fs';

// Command line argument parsing
interface TestConfig {
  mode: 'basic' | 'device' | 'actions' | 'full';
  headless: boolean;
  slowMo: number;
  deviceName: string;
  actions: string[];
  takeScreenshots: boolean;
  help: boolean;
}

// Test execution results
interface TestResults {
  mode: string;
  success: boolean;
  duration: number;
  errors: string[];
  webAutomation?: {
    editorLaunched: boolean;
    deviceConnected: boolean;
    connectionState: any;
  };
  actionsExecuted?: {
    name: string;
    success: boolean;
    duration: number;
    messagesCount: number;
  }[];
  protocolAnalysis?: {
    totalActions: number;
    totalMessages: number;
    recommendations: number;
  };
}

class WebAutomationTester {
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
  }

  /**
   * Main test execution entry point
   */
  async runTests(): Promise<TestResults> {
    console.log('🧪 Web Automation Test Runner');
    console.log('═'.repeat(60));
    console.log(`📋 Test Mode: ${this.config.mode}`);
    console.log(`🎛️  Device: ${this.config.deviceName}`);
    console.log(`🖥️  Headless: ${this.config.headless}`);
    console.log(`⏱️  Slow Motion: ${this.config.slowMo}ms`);

    const startTime = Date.now();
    const results: TestResults = {
      mode: this.config.mode,
      success: false,
      duration: 0,
      errors: [],
    };

    try {
      switch (this.config.mode) {
        case 'basic':
          await this.runBasicTest(results);
          break;
        case 'device':
          await this.runDeviceTest(results);
          break;
        case 'actions':
          await this.runActionsTest(results);
          break;
        case 'full':
          await this.runFullTest(results);
          break;
        default:
          throw new Error(`Unknown test mode: ${this.config.mode}`);
      }

      results.success = true;
      console.log('\n✅ All tests passed successfully!');

    } catch (error: any) {
      results.errors.push(error.message);
      console.error('\n❌ Test execution failed:', error.message);
    }

    results.duration = Date.now() - startTime;
    console.log(`⏱️  Total execution time: ${results.duration}ms`);

    return results;
  }

  /**
   * Basic test: Launch web editor and verify basic functionality
   */
  private async runBasicTest(results: TestResults): Promise<void> {
    console.log('\n🚀 Running Basic Test...');
    console.log('   Testing web editor launch and basic automation');

    const webAutomation = createWebEditorAutomation({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      recordScreenshots: this.config.takeScreenshots,
      outputDir: './test-results/basic',
    });

    try {
      // Launch web editor
      console.log('   📡 Launching web editor...');
      await webAutomation.launchEditor();

      // Take a screenshot to verify loading
      if (this.config.takeScreenshots) {
        await webAutomation.takeScreenshot('basic-test-loaded');
      }

      results.webAutomation = {
        editorLaunched: true,
        deviceConnected: false,
        connectionState: webAutomation.getConnectionState(),
      };

      console.log('   ✅ Basic test completed - web editor launched successfully');

    } finally {
      await webAutomation.close();
    }
  }

  /**
   * Device test: Test device connection and Web MIDI API interaction
   */
  private async runDeviceTest(results: TestResults): Promise<void> {
    console.log('\n🎛️  Running Device Connection Test...');
    console.log('   Testing device discovery and connection');

    const webAutomation = createWebEditorAutomation({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      recordScreenshots: this.config.takeScreenshots,
      outputDir: './test-results/device',
    });

    try {
      // Launch web editor
      console.log('   📡 Launching web editor...');
      await webAutomation.launchEditor();

      // Attempt device connection
      console.log(`   🔌 Connecting to device: ${this.config.deviceName}`);
      await webAutomation.connectToDevice(this.config.deviceName);

      // Wait for device ready
      console.log('   ⏳ Waiting for device to be ready...');
      await webAutomation.waitForDeviceReady();

      const connectionState = webAutomation.getConnectionState();
      console.log('   📊 Connection State:', JSON.stringify(connectionState, null, 2));

      if (this.config.takeScreenshots) {
        await webAutomation.takeScreenshot('device-test-connected');
      }

      results.webAutomation = {
        editorLaunched: true,
        deviceConnected: connectionState.isConnected,
        connectionState,
      };

      console.log('   ✅ Device test completed - connection established');

    } catch (error: any) {
      console.error('   ❌ Device connection failed:', error.message);
      console.log('   💡 Make sure the Launch Control XL 3 is connected and not in use by other applications');
      throw error;
    } finally {
      await webAutomation.close();
    }
  }

  /**
   * Actions test: Test specific test actions execution
   */
  private async runActionsTest(results: TestResults): Promise<void> {
    console.log('\n🎬 Running Actions Test...');
    console.log('   Testing individual action execution');

    const webAutomation = createWebEditorAutomation({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      recordScreenshots: this.config.takeScreenshots,
      outputDir: './test-results/actions',
    });

    try {
      // Setup
      await webAutomation.launchEditor();
      await webAutomation.connectToDevice(this.config.deviceName);
      await webAutomation.waitForDeviceReady();

      // Select actions to test
      const actionsToTest = this.selectActionsForTest();
      console.log(`   🎯 Selected ${actionsToTest.length} actions to test:`);
      actionsToTest.forEach(action => console.log(`      - ${action.name}: ${action.description}`));

      const actionResults = [];

      // Execute each action
      for (let i = 0; i < actionsToTest.length; i++) {
        const action = actionsToTest[i];
        console.log(`\n   [${i + 1}/${actionsToTest.length}] Testing: ${action.name}`);

        const actionStartTime = Date.now();
        let actionSuccess = false;
        let messagesCount = 0;

        try {
          await action.execute(webAutomation.getPage());
          actionSuccess = true;
          console.log(`      ✅ Action completed successfully`);

          if (this.config.takeScreenshots) {
            await webAutomation.takeScreenshot(`action-${action.name}-result`);
          }

        } catch (actionError: any) {
          console.log(`      ❌ Action failed: ${actionError.message}`);
        }

        const actionDuration = Date.now() - actionStartTime;
        actionResults.push({
          name: action.name,
          success: actionSuccess,
          duration: actionDuration,
          messagesCount,
        });

        // Small delay between actions
        if (i < actionsToTest.length - 1) {
          await this.sleep(2000);
        }
      }

      results.actionsExecuted = actionResults;

      const successfulActions = actionResults.filter(r => r.success).length;
      console.log(`\n   📊 Actions Summary: ${successfulActions}/${actionResults.length} successful`);

    } finally {
      await webAutomation.close();
    }
  }

  /**
   * Full test: Run complete protocol reverse engineering session
   */
  private async runFullTest(results: TestResults): Promise<void> {
    console.log('\n🔬 Running Full Protocol Reverse Engineering Test...');
    console.log('   Testing complete automation with MIDI monitoring');

    const reverseEngineer = createProtocolReverseEngineer({
      outputDir: './test-results/full',
      webEditorConfig: {
        headless: this.config.headless,
        slowMo: this.config.slowMo,
        recordScreenshots: this.config.takeScreenshots,
      },
      actionCategories: ['device-interaction', 'mode-management'], // Limited set for testing
      delayBetweenActions: 2000,
      validateResults: true,
    });

    try {
      console.log('   🚀 Starting reverse engineering session...');
      const sessionResults = await reverseEngineer.runReverseEngineeringSession();

      results.protocolAnalysis = {
        totalActions: sessionResults.summary.totalActions,
        totalMessages: sessionResults.analysis.totalMessages,
        recommendations: sessionResults.recommendations.length,
      };

      console.log('   📊 Session Results:');
      console.log(`      Actions: ${sessionResults.summary.totalActions} (${sessionResults.summary.successfulActions} successful)`);
      console.log(`      Messages: ${sessionResults.analysis.totalMessages}`);
      console.log(`      Recommendations: ${sessionResults.recommendations.length}`);
      console.log(`      Session ID: ${sessionResults.sessionId}`);

    } catch (error: any) {
      console.error('   ❌ Full test session failed:', error.message);
      throw error;
    }
  }

  /**
   * Select actions for testing based on configuration
   */
  private selectActionsForTest(): TestAction[] {
    if (this.config.actions.length > 0) {
      // Use specified actions
      const selectedActions = this.config.actions
        .map(name => getActionByName(name))
        .filter((action): action is TestAction => action !== undefined);

      if (selectedActions.length === 0) {
        console.log('   ⚠️  No valid actions found, using default set');
        return getActionsByCategory('device-interaction');
      }

      return selectedActions;
    }

    // Use a small default set for testing
    return getActionsByCategory('device-interaction');
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: TestConfig = {
    mode: 'basic',
    headless: false,
    slowMo: 100,
    deviceName: 'LCXL3',
    actions: [],
    takeScreenshots: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help') {
      config.help = true;
    } else if (arg.startsWith('--mode=')) {
      config.mode = arg.split('=')[1] as any;
    } else if (arg.startsWith('--headless=')) {
      config.headless = arg.split('=')[1] === 'true';
    } else if (arg.startsWith('--slow-mo=')) {
      config.slowMo = parseInt(arg.split('=')[1]) || 100;
    } else if (arg.startsWith('--device=')) {
      config.deviceName = arg.split('=')[1];
    } else if (arg.startsWith('--actions=')) {
      config.actions = arg.split('=')[1].split(',').map(name => name.trim());
    } else if (arg === '--screenshots') {
      config.takeScreenshots = true;
    }
  }

  return config;
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
🧪 Web Automation Test Runner

Usage: tsx utils/test-web-automation.ts [options]

Test Modes:
  basic     - Launch web editor and verify basic functionality
  device    - Test device connection through Web MIDI API
  actions   - Test execution of specific test actions
  full      - Run complete protocol reverse engineering session

Options:
  --mode=<mode>           Test mode (default: basic)
  --headless=<bool>       Run browser in headless mode (default: false)
  --slow-mo=<ms>          Add delay between actions (default: 100)
  --device=<name>         Device name to connect to (default: LCXL3)
  --actions=<names>       Comma-separated action names to test
  --screenshots           Take screenshots during execution
  --help                  Show this help message

Examples:
  tsx utils/test-web-automation.ts --mode=basic --screenshots
  tsx utils/test-web-automation.ts --mode=device --device=LCXL3
  tsx utils/test-web-automation.ts --mode=actions --actions=device_handshake,create_simple_mode
  tsx utils/test-web-automation.ts --mode=full --slow-mo=200

Available Actions:
${Object.entries(TEST_ACTION_CATEGORIES).map(([category, actions]) =>
  `  ${category}:\n${actions.map(action => `    - ${action.name}: ${action.description}`).join('\n')}`
).join('\n\n')}

Prerequisites:
  - Launch Control XL 3 connected and not in use by other applications
  - Chrome/Chromium browser available
  - MIDI permissions granted (will be requested automatically)

Output:
  Test results and screenshots are saved to ./test-results/
`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const config = parseArgs();

  if (config.help) {
    showHelp();
    return;
  }

  // Validate mode
  if (!['basic', 'device', 'actions', 'full'].includes(config.mode)) {
    console.error('❌ Invalid mode. Use --help for available options.');
    process.exit(1);
  }

  console.log('🧪 Launch Control XL 3 - Web Automation Test');
  console.log('═'.repeat(60));

  try {
    const tester = new WebAutomationTester(config);
    const results = await tester.runTests();

    if (results.success) {
      console.log('\n🎉 All tests completed successfully!');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed. Check the output above for details.');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n💥 Test execution crashed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main().catch(console.error);
}

export { WebAutomationTester, parseArgs, showHelp };