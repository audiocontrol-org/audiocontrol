#!/usr/bin/env tsx

/**
 * MIDI Monitor - Phase 1 Passive MIDI Monitoring Tool
 *
 * This tool implements passive MIDI monitoring to capture all MIDI traffic
 * for reverse-engineering the Launch Control XL 3 protocol.
 *
 * Features:
 * - Monitors all available MIDI input ports simultaneously
 * - Focuses on SysEx messages but captures all MIDI data
 * - Supports device filtering (e.g., "LCXL3")
 * - Saves captured sessions to JSON for analysis
 * - Real-time console output with hex formatting
 * - Non-intrusive passive monitoring
 */

import * as easymidi from 'easymidi';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
// Using local type definitions to avoid import issues

// Configuration interface
interface MonitorConfig {
  readonly deviceFilter?: string;
  readonly outputDir?: string;
  readonly sessionName?: string;
  readonly captureAllPorts?: boolean;
  readonly verboseLogging?: boolean;
  readonly bufferMessages?: boolean;
}

// Captured message with metadata
interface CapturedMessage {
  readonly timestamp: number;
  readonly portName: string;
  readonly messageType: string;
  readonly rawData: readonly number[];
  readonly hexData: string;
  readonly parsedData?: any;
}

// Monitor session data
interface MonitorSession {
  readonly sessionId: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly config: MonitorConfig;
  readonly messages: readonly CapturedMessage[];
  readonly portsCaptured: readonly string[];
  readonly statistics: {
    readonly totalMessages: number;
    readonly sysexMessages: number;
    readonly ccMessages: number;
    readonly noteMessages: number;
    readonly otherMessages: number;
  };
}

export class MidiMonitor {
  private readonly config: MonitorConfig;
  private readonly inputs: Map<string, easymidi.Input> = new Map();
  private readonly capturedMessages: CapturedMessage[] = [];
  private sessionId: string;
  private startTime: number = 0;
  private isRunning = false;
  // Virtual port interception
  private virtualIn?: easymidi.Input;
  private virtualOut?: easymidi.Output;
  private realIn?: easymidi.Input;
  private realOut?: easymidi.Output;

  constructor(config: MonitorConfig = {}) {
    this.config = {
      deviceFilter: undefined,
      outputDir: './midi-captures',
      sessionName: undefined,
      captureAllPorts: true,
      verboseLogging: false,
      bufferMessages: true,
      ...config,
    };

    this.sessionId = this.generateSessionId();
  }

  /**
   * Start virtual port interception mode
   * This creates virtual ports that intercept traffic between web editor and device
   */
  async startInterceptionMode(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Monitor is already running');
    }

    console.log('🎵 Starting MIDI Monitor - Interception Mode');
    console.log('═'.repeat(60));

    // Create virtual ports
    this.virtualIn = new easymidi.Input();
    this.virtualOut = new easymidi.Output();

    // Open virtual ports with names that web editor will connect to
    this.virtualIn.openVirtualPort('LCXL3 Virtual MIDI In');
    this.virtualOut.openVirtualPort('LCXL3 Virtual MIDI Out');

    console.log('✅ Created virtual ports:');
    console.log('   - LCXL3 Virtual MIDI In (web editor sends here)');
    console.log('   - LCXL3 Virtual MIDI Out (web editor reads from here)');

    // Connect to real device ports
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    const realInIdx = inputs.findIndex(p => p.includes('LCXL3 1 MIDI Out'));
    const realOutIdx = outputs.findIndex(p => p.includes('LCXL3 1 MIDI In'));

    if (realInIdx >= 0 && realOutIdx >= 0) {
      this.realIn = new easymidi.Input();
      this.realIn.openPort(realInIdx);
      this.realOut = new easymidi.Output();
      this.realOut.openPort(realOutIdx);

      console.log('✅ Connected to real device:');
      console.log(`   - ${inputs[realInIdx]}`);
      console.log(`   - ${outputs[realOutIdx]}`);
    } else {
      throw new Error('Could not find real LCXL3 device ports');
    }

    this.startTime = Date.now();
    this.isRunning = true;

    // Set up message forwarding and capture
    this.setupInterception();

    console.log('\n🔍 Interception active!');
    console.log('⚠️  Configure web editor to use:');
    console.log('   Input: LCXL3 Virtual MIDI Out');
    console.log('   Output: LCXL3 Virtual MIDI In');
    console.log('\n⏹️  Press Ctrl+C to stop and save session');
    console.log('─'.repeat(60));

    this.setupGracefulShutdown();
  }

  /**
   * Set up message interception and forwarding
   */
  private setupInterception(): void {
    // Intercept messages FROM web editor TO device
    this.virtualIn!.on('message', (deltaTime: number, message: number[]) => {
      this.captureMessage('WEB→DEVICE', 'message', message, { direction: 'TO_DEVICE' });
      // Forward to real device
      if (this.realOut) {
        this.realOut.sendMessage(message);
      }
    });

    this.virtualIn!.on('sysex', (msg: any) => {
      const data = msg.bytes || msg.data || [];
      this.captureMessage('WEB→DEVICE', 'sysex', data, { direction: 'TO_DEVICE' });
      // Forward to real device
      if (this.realOut && data.length > 0) {
        this.realOut.sendMessage(data);
      }
    });

    // Intercept messages FROM device TO web editor
    this.realIn!.on('message', (deltaTime: number, message: number[]) => {
      this.captureMessage('DEVICE→WEB', 'message', message, { direction: 'FROM_DEVICE' });
      // Forward to web editor
      if (this.virtualOut) {
        this.virtualOut.sendMessage(message);
      }
    });

    this.realIn!.on('sysex', (msg: any) => {
      const data = msg.bytes || msg.data || [];
      this.captureMessage('DEVICE→WEB', 'sysex', data, { direction: 'FROM_DEVICE' });
      // Forward to web editor
      if (this.virtualOut && data.length > 0) {
        this.virtualOut.sendMessage(data);
      }
    });
  }

  /**
   * Start passive monitoring of MIDI ports
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Monitor is already running');
    }

    console.log('🎵 Starting MIDI Monitor - Phase 1 Passive Monitoring');
    console.log('═'.repeat(60));

    // Get available input ports
    const availablePorts = easymidi.getInputs();
    console.log(`📡 Available MIDI input ports: ${availablePorts.length}`);

    if (availablePorts.length === 0) {
      throw new Error('No MIDI input ports available');
    }

    // Show ALL available ports for transparency
    console.log('📋 All available ports:');
    availablePorts.forEach((port, i) => {
      const portType = port.includes('DAW') ? ' (DAW Port)' :
                       port.includes('MIDI In') ? ' (MIDI Input)' :
                       port.includes('MIDI Out') ? ' (MIDI Output)' : '';
      console.log(`   ${i + 1}. ${port}${portType}`);
    });

    // Filter ports if device filter is specified
    const portsToMonitor = this.config.deviceFilter
      ? availablePorts.filter(port =>
          port.toLowerCase().includes(this.config.deviceFilter!.toLowerCase())
        )
      : availablePorts;

    if (portsToMonitor.length === 0) {
      const filterMsg = this.config.deviceFilter
        ? ` matching filter "${this.config.deviceFilter}"`
        : '';
      throw new Error(`No MIDI input ports found${filterMsg}`);
    }

    console.log(`\n🎯 Monitoring ${portsToMonitor.length} port(s) (including DAW ports):`);
    portsToMonitor.forEach((port, i) => {
      console.log(`   ${i + 1}. ${port}`);
    });

    // Start monitoring each port
    this.startTime = Date.now();
    this.isRunning = true;

    for (const portName of portsToMonitor) {
      await this.monitorPort(portName);
    }

    console.log('\n🔍 Passive monitoring active...');
    console.log('💡 Use Novation web editor to generate traffic');
    console.log('⏹️  Press Ctrl+C to stop and save session');
    console.log('─'.repeat(60));

    // Set up graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Monitor a specific MIDI port
   */
  private async monitorPort(portName: string): Promise<void> {
    try {
      const input = new easymidi.Input(portName);
      this.inputs.set(portName, input);

      // Monitor all MIDI message types
      this.setupMessageHandlers(input, portName);

      if (this.config.verboseLogging) {
        console.log(`✅ Started monitoring: ${portName}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to monitor port ${portName}: ${error.message}`);
    }
  }

  /**
   * Set up message handlers for all MIDI message types
   */
  private setupMessageHandlers(input: easymidi.Input, portName: string): void {
    // SysEx messages (most important for protocol reverse-engineering)
    input.on('sysex', (msg: any) => {
      this.captureMessage(portName, 'sysex', msg.bytes || msg.data || [], msg);
    });

    // Control Change messages
    input.on('cc', (msg: any) => {
      const data = [0xB0 | (msg.channel || 0), msg.controller || 0, msg.value || 0];
      this.captureMessage(portName, 'cc', data, msg);
    });

    // Note On/Off messages
    input.on('noteon', (msg: any) => {
      const data = [0x90 | (msg.channel || 0), msg.note || 0, msg.velocity || 0];
      this.captureMessage(portName, 'noteon', data, msg);
    });

    input.on('noteoff', (msg: any) => {
      const data = [0x80 | (msg.channel || 0), msg.note || 0, msg.velocity || 0];
      this.captureMessage(portName, 'noteoff', data, msg);
    });

    // Program Change messages
    input.on('program', (msg: any) => {
      const data = [0xC0 | (msg.channel || 0), msg.number || 0];
      this.captureMessage(portName, 'program', data, msg);
    });

    // Pitch Bend messages
    input.on('pitch', (msg: any) => {
      const lsb = (msg.value || 0) & 0x7F;
      const msb = ((msg.value || 0) >> 7) & 0x7F;
      const data = [0xE0 | (msg.channel || 0), lsb, msb];
      this.captureMessage(portName, 'pitch', data, msg);
    });

    // Aftertouch messages
    // Aftertouch messages (not all MIDI libraries support these events)
    try {
      input.on('poly aftertouch' as any, (msg: any) => {
        const data = [0xA0 | (msg.channel || 0), msg.note || 0, msg.pressure || 0];
        this.captureMessage(portName, 'poly_aftertouch', data, msg);
      });
    } catch (e) {
      // Ignore if not supported
    }

    try {
      input.on('channel aftertouch' as any, (msg: any) => {
        const data = [0xD0 | (msg.channel || 0), msg.pressure || 0];
        this.captureMessage(portName, 'channel_aftertouch', data, msg);
      });
    } catch (e) {
      // Ignore if not supported
    }
  }

  /**
   * Capture and process a MIDI message
   */
  private captureMessage(
    portName: string,
    messageType: string,
    rawData: number[],
    parsedData: any
  ): void {
    const timestamp = Date.now();
    const hexData = rawData.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');

    const capturedMessage: CapturedMessage = {
      timestamp,
      portName,
      messageType,
      rawData: Object.freeze([...rawData]),
      hexData,
      parsedData: { ...parsedData },
    };

    // Buffer message if enabled
    if (this.config.bufferMessages) {
      this.capturedMessages.push(capturedMessage);
    }

    // Real-time console output
    this.logMessage(capturedMessage);
  }

  /**
   * Log message to console with formatting
   */
  private logMessage(message: CapturedMessage): void {
    const timeStr = new Date(message.timestamp).toISOString().split('T')[1]?.split('.')[0] || '';
    const portStr = message.portName.padEnd(25);
    const typeStr = message.messageType.padEnd(12);

    // Determine port type for special highlighting
    const isDawPort = message.portName.includes('DAW');
    const portIcon = isDawPort ? '🎹' : '  ';

    if (message.messageType === 'sysex') {
      // Highlight SysEx messages - these are critical for protocol analysis
      console.log(`🔥 ${timeStr} [${portStr}] ${typeStr} ${message.hexData}`);

      // Additional SysEx analysis
      if (message.rawData.length >= 3) {
        const manufacturerId = message.rawData.slice(1, 3);
        const manIdHex = manufacturerId.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        console.log(`   └─ Manufacturer ID: ${manIdHex} | Length: ${message.rawData.length} bytes`);
      }
    } else if (isDawPort) {
      // Highlight DAW port messages
      console.log(`${portIcon} ${timeStr} [${portStr}] ${typeStr} ${message.hexData}`);
    } else {
      console.log(`   ${timeStr} [${portStr}] ${typeStr} ${message.hexData}`);
    }
  }

  /**
   * Stop monitoring and save session
   */
  async stopMonitoring(): Promise<MonitorSession> {
    if (!this.isRunning) {
      throw new Error('Monitor is not running');
    }

    console.log('\n⏹️  Stopping MIDI monitor...');

    // Close virtual ports if in interception mode
    if (this.virtualIn) {
      this.virtualIn.closePort();
      console.log('✅ Closed virtual input port');
    }
    if (this.virtualOut) {
      this.virtualOut.closePort();
      console.log('✅ Closed virtual output port');
    }
    if (this.realIn) {
      this.realIn.closePort();
      console.log('✅ Closed real input connection');
    }
    if (this.realOut) {
      this.realOut.closePort();
      console.log('✅ Closed real output connection');
    }

    // Close all regular input ports
    for (const [portName, input] of Array.from(this.inputs.entries())) {
      try {
        input.close();
        if (this.config.verboseLogging) {
          console.log(`✅ Closed port: ${portName}`);
        }
      } catch (error: any) {
        console.error(`❌ Error closing port ${portName}: ${error.message}`);
      }
    }

    this.inputs.clear();
    this.isRunning = false;

    // Create session data
    const session = this.createSession();

    // Save session to file
    await this.saveSession(session);

    console.log(`💾 Session saved: ${session.sessionId}`);
    console.log(`📊 Captured ${session.messages.length} messages total`);
    console.log(`   SysEx: ${session.statistics.sysexMessages}`);
    console.log(`   CC: ${session.statistics.ccMessages}`);
    console.log(`   Notes: ${session.statistics.noteMessages}`);
    console.log(`   Other: ${session.statistics.otherMessages}`);

    return session;
  }

  /**
   * Create session data structure
   */
  private createSession(): MonitorSession {
    const endTime = Date.now();
    const portsCaptured = Array.from(new Set(this.capturedMessages.map(m => m.portName)));

    // Calculate statistics
    const sysexMessages = this.capturedMessages.filter(m => m.messageType === 'sysex').length;
    const ccMessages = this.capturedMessages.filter(m => m.messageType === 'cc').length;
    const noteMessages = this.capturedMessages.filter(m =>
      m.messageType === 'noteon' || m.messageType === 'noteoff'
    ).length;
    const otherMessages = this.capturedMessages.length - sysexMessages - ccMessages - noteMessages;

    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime,
      config: this.config,
      messages: Object.freeze([...this.capturedMessages]),
      portsCaptured: Object.freeze([...portsCaptured]),
      statistics: {
        totalMessages: this.capturedMessages.length,
        sysexMessages,
        ccMessages,
        noteMessages,
        otherMessages,
      },
    };
  }

  /**
   * Save session to JSON file
   */
  private async saveSession(session: MonitorSession): Promise<void> {
    const outputDir = this.config.outputDir || './midi-captures';

    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const sessionName = this.config.sessionName || `midi-session-${session.sessionId}`;
    const filename = `${sessionName}.json`;
    const filePath = join(outputDir, filename);

    try {
      const json = JSON.stringify(session, null, 2);
      writeFileSync(filePath, json, 'utf8');
      console.log(`💾 Session saved to: ${filePath}`);
    } catch (error: any) {
      console.error(`❌ Failed to save session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Set up graceful shutdown on Ctrl+C
   */
  private setupGracefulShutdown(): void {
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received shutdown signal...');
      try {
        await this.stopMonitoring();
        process.exit(0);
      } catch (error: any) {
        console.error(`❌ Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    });
  }

  /**
   * Get current capture statistics
   */
  getCurrentStats(): { messageCount: number; portCount: number; isRunning: boolean } {
    return {
      messageCount: this.capturedMessages.length,
      portCount: this.inputs.size,
      isRunning: this.isRunning,
    };
  }
}

// CLI interface when run directly
if (process.argv[1] && process.argv[1].endsWith('midi-monitor.ts')) {
  const args = process.argv.slice(2);
  const deviceFilter = args.find(arg => arg.startsWith('--device='))?.split('=')[1];
  const outputDir = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
  const sessionName = args.find(arg => arg.startsWith('--session='))?.split('=')[1];
  const verbose = args.includes('--verbose');
  const intercept = args.includes('--intercept');

  if (args.includes('--help')) {
    console.log('MIDI Monitor - Capture MIDI traffic for analysis');
    console.log('\nUsage:');
    console.log('  npx tsx utils/midi-monitor.ts [options]');
    console.log('\nOptions:');
    console.log('  --intercept        Enable interception mode (creates virtual ports)');
    console.log('  --device=NAME      Filter to specific device name');
    console.log('  --output=DIR       Output directory for captures');
    console.log('  --session=NAME     Session name for capture file');
    console.log('  --verbose          Enable verbose logging');
    console.log('  --help             Show this help message');
    console.log('\nInterception mode:');
    console.log('  Creates virtual MIDI ports to intercept traffic between');
    console.log('  web editor and device. Configure web editor to use:');
    console.log('  - Input: LCXL3 Virtual MIDI Out');
    console.log('  - Output: LCXL3 Virtual MIDI In');
    process.exit(0);
  }

  const config: MonitorConfig = {
    deviceFilter,
    outputDir,
    sessionName,
    verboseLogging: verbose,
  };

  const monitor = new MidiMonitor(config);

  if (intercept) {
    monitor.startInterceptionMode().catch((error: any) => {
      console.error(`❌ Failed to start interception: ${error.message}`);
      process.exit(1);
    });
  } else {
    monitor.startMonitoring().catch((error: any) => {
      console.error(`❌ Failed to start monitor: ${error.message}`);
      process.exit(1);
    });
  }
}