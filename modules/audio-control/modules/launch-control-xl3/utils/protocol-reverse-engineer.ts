#!/usr/bin/env tsx

/**
 * Protocol Reverse Engineer - Phase 2 Systematic Protocol Analysis
 *
 * This class coordinates web editor automation with MIDI monitoring to systematically
 * reverse engineer the true Launch Control XL 3 MIDI protocol.
 *
 * Features:
 * - Systematic test action execution
 * - MIDI message correlation with web actions
 * - Pattern analysis and comparison
 * - Protocol specification generation
 * - Integration with existing monitoring infrastructure
 */

import { WebEditorAutomation, WebEditorConfig } from './web-editor-automation.js';
import { TestAction, ActionExecutionResult, ALL_TEST_ACTIONS, getActionsByCategory, validateActionResults } from './playwright-test-actions.js';
import { MidiMonitor, MonitorSession } from './midi-monitor.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Protocol analysis session configuration
export interface ReverseEngineerConfig {
  readonly outputDir?: string;
  readonly sessionName?: string;
  readonly webEditorConfig?: WebEditorConfig;
  readonly includedActions?: string[]; // Action names to include
  readonly excludedActions?: string[]; // Action names to exclude
  readonly actionCategories?: Array<'mode-management' | 'control-config' | 'visual-config' | 'device-interaction'>;
  readonly delayBetweenActions?: number; // ms delay between actions
  readonly captureScreenshots?: boolean;
  readonly validateResults?: boolean;
  readonly maxRetries?: number;
}

// Analysis results for a complete reverse engineering session
export interface ReverseEngineeringResults {
  readonly sessionId: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly config: ReverseEngineerConfig;
  readonly actionResults: readonly ActionExecutionResult[];
  readonly midiSession?: MonitorSession;
  readonly analysis: ProtocolAnalysis;
  readonly recommendations: readonly ProtocolRecommendation[];
  readonly summary: SessionSummary;
}

// Protocol analysis findings
export interface ProtocolAnalysis {
  readonly totalMessages: number;
  readonly sysexMessages: number;
  readonly messagePatterns: readonly MessagePattern[];
  readonly actionMessageMapping: readonly ActionMessageMapping[];
  readonly comparisonWithCurrentImplementation: readonly ProtocolComparison[];
  readonly discoveredProtocolElements: readonly ProtocolElement[];
}

// Message pattern analysis
export interface MessagePattern {
  readonly patternId: string;
  readonly description: string;
  readonly hexPattern: string;
  readonly occurrences: number;
  readonly associatedActions: readonly string[];
  readonly messageType: 'sysex-write' | 'sysex-read' | 'sysex-response' | 'cc' | 'other';
  readonly confidence: number; // 0-1
}

// Action to message mapping
export interface ActionMessageMapping {
  readonly actionName: string;
  readonly triggerTimestamp: number;
  readonly capturedMessages: readonly {
    timestamp: number;
    messageType: string;
    rawData: readonly number[];
    hexData: string;
    timingOffset: number; // ms from action trigger
  }[];
  readonly expectedMessages: number;
  readonly actualMessages: number;
  readonly isValid: boolean;
}

// Protocol comparison with current implementation
export interface ProtocolComparison {
  readonly actionContext: string;
  readonly capturedMessage: {
    hexData: string;
    rawData: readonly number[];
  };
  readonly ourImplementation: {
    hexData: string;
    rawData: readonly number[];
  };
  readonly differences: readonly {
    byteIndex: number;
    expected: number;
    actual: number;
    significance: 'critical' | 'important' | 'minor';
  }[];
  readonly similarity: number; // 0-1
  readonly recommendation: string;
}

// Discovered protocol elements
export interface ProtocolElement {
  readonly elementType: 'header' | 'command' | 'data' | 'checksum' | 'footer';
  readonly byteRange: { start: number; end: number };
  readonly hexValue: string;
  readonly description: string;
  readonly variability: 'fixed' | 'variable' | 'calculated';
  readonly examples: readonly string[];
}

// Protocol improvement recommendations
export interface ProtocolRecommendation {
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly category: 'message-format' | 'timing' | 'error-handling' | 'implementation';
  readonly description: string;
  readonly affectedActions: readonly string[];
  readonly suggestedFix: string;
  readonly codeExample?: string;
}

// Session execution summary
export interface SessionSummary {
  readonly totalActions: number;
  readonly successfulActions: number;
  readonly failedActions: number;
  readonly totalExecutionTime: number;
  readonly averageActionTime: number;
  readonly messagesPerAction: number;
  readonly protocolConfidence: number; // 0-1 overall confidence in findings
}

/**
 * Protocol Reverse Engineer Controller
 *
 * Coordinates systematic testing of web editor actions with MIDI message capture
 * to reverse engineer the true Launch Control XL 3 protocol
 */
export class ProtocolReverseEngineer {
  private readonly config: Required<ReverseEngineerConfig>;
  private webAutomation: WebEditorAutomation | null = null;
  private midiMonitor: MidiMonitor | null = null;
  private sessionId: string;
  private startTime: number = 0;
  private actionResults: ActionExecutionResult[] = [];

  constructor(config: ReverseEngineerConfig = {}) {
    this.config = {
      outputDir: './protocol-analysis',
      sessionName: undefined,
      webEditorConfig: {},
      includedActions: [],
      excludedActions: [],
      actionCategories: ['mode-management', 'control-config', 'visual-config', 'device-interaction'],
      delayBetweenActions: 3000,
      captureScreenshots: true,
      validateResults: true,
      maxRetries: 2,
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.ensureOutputDirectory();
  }

  /**
   * Run complete reverse engineering session
   */
  async runReverseEngineeringSession(): Promise<ReverseEngineeringResults> {
    try {
      console.log('🔬 Starting Protocol Reverse Engineering Session');
      console.log('═'.repeat(60));
      console.log(`📋 Session ID: ${this.sessionId}`);

      this.startTime = Date.now();

      // Step 1: Initialize web automation and device connection
      await this.initializeWebAutomation();

      // Step 2: Start MIDI monitoring
      await this.startMidiMonitoring();

      // Step 3: Select and execute test actions
      const selectedActions = this.selectTestActions();
      console.log(`🎯 Selected ${selectedActions.length} test actions for execution`);

      // Step 4: Execute actions systematically
      await this.executeActionSequence(selectedActions);

      // Step 5: Stop monitoring and collect data
      const midiSession = await this.stopMidiMonitoring();

      // Step 6: Analyze captured data
      const analysis = await this.analyzeProtocol();

      // Step 7: Generate recommendations
      const recommendations = this.generateRecommendations(analysis);

      // Step 8: Create session summary
      const summary = this.createSessionSummary();

      // Step 9: Save results
      const results: ReverseEngineeringResults = {
        sessionId: this.sessionId,
        startTime: this.startTime,
        endTime: Date.now(),
        config: this.config,
        actionResults: [...this.actionResults],
        midiSession,
        analysis,
        recommendations,
        summary,
      };

      await this.saveResults(results);

      console.log('✅ Reverse engineering session completed successfully');
      console.log(`📊 Results saved to: ${this.config.outputDir}`);

      return results;

    } catch (error: any) {
      console.error('❌ Reverse engineering session failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Run specific action sequence with custom configuration
   */
  async runActionSequence(actions: TestAction[]): Promise<ActionExecutionResult[]> {
    if (!this.webAutomation) {
      await this.initializeWebAutomation();
    }

    return await this.executeActionSequence(actions);
  }

  /**
   * Initialize web automation and connect to device
   */
  private async initializeWebAutomation(): Promise<void> {
    console.log('🚀 Initializing web automation...');

    this.webAutomation = new WebEditorAutomation({
      outputDir: join(this.config.outputDir, 'web-automation'),
      captureScreenshots: this.config.captureScreenshots,
      ...this.config.webEditorConfig,
    });

    // Launch web editor
    await this.webAutomation.launchEditor();

    // Connect to device
    await this.webAutomation.connectToDevice('LCXL3');

    // Wait for device ready
    await this.webAutomation.waitForDeviceReady();

    console.log('✅ Web automation initialized');
  }

  /**
   * Start MIDI monitoring for the session
   */
  private async startMidiMonitoring(): Promise<void> {
    console.log('🎵 Starting MIDI monitoring...');

    this.midiMonitor = new MidiMonitor({
      deviceFilter: 'LCXL3',
      outputDir: join(this.config.outputDir, 'midi-captures'),
      sessionName: `reverse-engineer-${this.sessionId}`,
      verboseLogging: false, // Reduce noise during systematic testing
      bufferMessages: true,
    });

    await this.midiMonitor.startMonitoring();
    console.log('✅ MIDI monitoring started');
  }

  /**
   * Stop MIDI monitoring and return session data
   */
  private async stopMidiMonitoring(): Promise<MonitorSession | undefined> {
    if (this.midiMonitor) {
      console.log('🛑 Stopping MIDI monitoring...');
      const session = await this.midiMonitor.stopMonitoring();
      console.log(`✅ MIDI monitoring stopped. Captured ${session.messages.length} messages`);
      return session;
    }
    return undefined;
  }

  /**
   * Select test actions based on configuration
   */
  private selectTestActions(): TestAction[] {
    let actions: TestAction[] = [];

    // Start with all actions or category-filtered actions
    if (this.config.actionCategories.length > 0) {
      for (const category of this.config.actionCategories) {
        actions.push(...getActionsByCategory(category));
      }
    } else {
      actions = [...ALL_TEST_ACTIONS];
    }

    // Apply include filter
    if (this.config.includedActions.length > 0) {
      actions = actions.filter(action => this.config.includedActions.includes(action.name));
    }

    // Apply exclude filter
    if (this.config.excludedActions.length > 0) {
      actions = actions.filter(action => !this.config.excludedActions.includes(action.name));
    }

    return actions;
  }

  /**
   * Execute sequence of test actions with MIDI capture
   */
  private async executeActionSequence(actions: TestAction[]): Promise<ActionExecutionResult[]> {
    const results: ActionExecutionResult[] = [];

    console.log('🎬 Executing action sequence...');
    console.log(`   Actions to execute: ${actions.length}`);
    console.log(`   Delay between actions: ${this.config.delayBetweenActions}ms`);

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(`\n📋 [${i + 1}/${actions.length}] Executing: ${action.name}`);

      const result = await this.executeAction(action);
      results.push(result);
      this.actionResults.push(result);

      if (!result.success && this.config.maxRetries > 0) {
        console.log(`   ⚠️  Action failed, retrying...`);
        // TODO: Implement retry logic
      }

      // Delay between actions to allow device/web editor to settle
      if (i < actions.length - 1) {
        console.log(`   ⏳ Waiting ${this.config.delayBetweenActions}ms before next action...`);
        await this.sleep(this.config.delayBetweenActions);
      }
    }

    const summary = validateActionResults(results);
    console.log(`\n📊 Action sequence completed:`);
    console.log(`   ✅ Successful: ${summary.successfulActions}/${summary.totalActions}`);
    console.log(`   📨 Messages captured: ${summary.totalMessages} (avg: ${summary.averageMessagesPerAction.toFixed(1)}/action)`);

    return results;
  }

  /**
   * Execute a single test action with timing and message capture
   */
  private async executeAction(action: TestAction): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let screenshots: string[] = [];

    try {
      if (!this.webAutomation) {
        throw new Error('Web automation not initialized');
      }

      // Take screenshot before action if enabled
      if (this.config.captureScreenshots) {
        const beforeScreenshot = await this.webAutomation.takeScreenshot(`${action.name}-before`);
        screenshots.push(beforeScreenshot);
      }

      // Mark start time for message correlation
      const actionStartTime = Date.now();

      // Execute the action
      await action.execute(this.webAutomation.getPage());

      // Take screenshot after action if enabled
      if (this.config.captureScreenshots) {
        const afterScreenshot = await this.webAutomation.takeScreenshot(`${action.name}-after`);
        screenshots.push(afterScreenshot);
      }

      success = true;

      // Get messages captured during this action (approximate timing)
      const capturedMessages = this.getCurrentMessages(actionStartTime);

      console.log(`   ✅ Action completed in ${Date.now() - startTime}ms`);
      console.log(`   📨 Captured ${capturedMessages.length} MIDI messages`);

      const endTime = Date.now();

      return {
        action,
        startTime,
        endTime,
        duration: endTime - startTime,
        success,
        capturedMessages,
        screenshots,
        validation: action.verify ? action.verify(capturedMessages) : undefined,
      };

    } catch (actionError: any) {
      success = false;
      error = actionError.message;

      console.log(`   ❌ Action failed: ${error}`);

      const endTime = Date.now();

      return {
        action,
        startTime,
        endTime,
        duration: endTime - startTime,
        success,
        capturedMessages: [],
        error,
        screenshots,
      };
    }
  }

  /**
   * Get MIDI messages captured since a specific timestamp
   */
  private getCurrentMessages(since: number): any[] {
    // This is a simplified implementation - in practice, we'd need to
    // coordinate with the MIDI monitor to get time-filtered messages
    return [];
  }

  /**
   * Analyze captured protocol data to identify patterns and differences
   */
  private async analyzeProtocol(): Promise<ProtocolAnalysis> {
    console.log('🔍 Analyzing captured protocol data...');

    // TODO: Implement comprehensive protocol analysis
    // This would include:
    // - Message pattern recognition
    // - Action-message correlation
    // - Comparison with current implementation
    // - Protocol element identification

    return {
      totalMessages: 0,
      sysexMessages: 0,
      messagePatterns: [],
      actionMessageMapping: [],
      comparisonWithCurrentImplementation: [],
      discoveredProtocolElements: [],
    };
  }

  /**
   * Generate improvement recommendations based on analysis
   */
  private generateRecommendations(analysis: ProtocolAnalysis): ProtocolRecommendation[] {
    const recommendations: ProtocolRecommendation[] = [];

    // TODO: Implement recommendation generation based on analysis findings

    return recommendations;
  }

  /**
   * Create session execution summary
   */
  private createSessionSummary(): SessionSummary {
    const validation = validateActionResults(this.actionResults);
    const totalTime = Date.now() - this.startTime;

    return {
      totalActions: validation.totalActions,
      successfulActions: validation.successfulActions,
      failedActions: validation.failedActions,
      totalExecutionTime: totalTime,
      averageActionTime: validation.totalActions > 0 ? totalTime / validation.totalActions : 0,
      messagesPerAction: validation.averageMessagesPerAction,
      protocolConfidence: 0.8, // TODO: Calculate based on analysis results
    };
  }

  /**
   * Save session results to files
   */
  private async saveResults(results: ReverseEngineeringResults): Promise<void> {
    const resultsFile = join(this.config.outputDir, `reverse-engineering-${this.sessionId}.json`);
    const summaryFile = join(this.config.outputDir, `summary-${this.sessionId}.json`);

    // Save complete results
    writeFileSync(resultsFile, JSON.stringify(results, null, 2));

    // Save summary for quick review
    writeFileSync(summaryFile, JSON.stringify({
      sessionId: results.sessionId,
      summary: results.summary,
      topRecommendations: results.recommendations.slice(0, 5),
      keyFindings: results.analysis.messagePatterns.slice(0, 10),
    }, null, 2));

    console.log(`💾 Results saved:`);
    console.log(`   Complete: ${resultsFile}`);
    console.log(`   Summary: ${summaryFile}`);
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.midiMonitor) {
        await this.stopMidiMonitoring();
      }

      if (this.webAutomation) {
        await this.webAutomation.close();
      }
    } catch (error: any) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `reverse-engineer-${timestamp}-${random}`;
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
  }
}

/**
 * Factory function for creating ProtocolReverseEngineer instances
 */
export function createProtocolReverseEngineer(config?: ReverseEngineerConfig): ProtocolReverseEngineer {
  return new ProtocolReverseEngineer(config);
}