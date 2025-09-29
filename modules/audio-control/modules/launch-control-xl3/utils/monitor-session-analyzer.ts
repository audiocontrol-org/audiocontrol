#!/usr/bin/env tsx

/**
 * MIDI Monitor Session Analyzer
 *
 * Analyzes captured MIDI sessions to extract protocol patterns,
 * identify SysEx message structures, and help reverse-engineer
 * the Launch Control XL 3 communication protocol.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { basename, extname, join } from 'path';

// Type definitions for captured session data
interface CapturedMessage {
  readonly timestamp: number;
  readonly portName: string;
  readonly messageType: string;
  readonly rawData: readonly number[];
  readonly hexData: string;
  readonly parsedData?: any;
}

interface MonitorSession {
  readonly sessionId: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly config?: any;
  readonly messages: readonly CapturedMessage[];
  readonly portsCaptured: readonly string[];
  readonly statistics?: any;
}

// Analysis result types
interface SysExPattern {
  readonly pattern: string;
  readonly count: number;
  readonly examples: readonly CapturedMessage[];
  readonly analysis: {
    readonly manufacturerId?: string;
    readonly deviceId?: string;
    readonly command?: string;
    readonly dataLength?: number;
    readonly description?: string;
    readonly manufacturer?: string;
    readonly device?: string;
  };
}

interface ProtocolAnalysis {
  readonly sessionId: string;
  readonly messageCount: number;
  readonly timeSpan: number;
  readonly sysexPatterns: readonly SysExPattern[];
  readonly ccPatterns: readonly any[];
  readonly timing: {
    readonly averageInterval: number;
    readonly burstPatterns: readonly any[];
  };
  readonly novationMessages: readonly CapturedMessage[];
  readonly unknownMessages: readonly CapturedMessage[];
}

class MonitorSessionAnalyzer {
  private readonly knownManufacturers = new Map([
    ['00 20 29', 'Novation Digital Music Systems'],
    ['7E', 'Universal Non-Real Time'],
    ['7F', 'Universal Real Time'],
    ['43', 'Yamaha'],
    ['41', 'Roland'],
    ['47', 'Akai'],
  ]);

  private readonly novationDevices = new Map([
    ['02 11', 'Launch Control XL 3'],
    ['02 0C', 'Launchpad X'],
    ['02 0D', 'Launchpad Mini MK3'],
    ['02 0E', 'Launchkey Mini MK3'],
  ]);

  constructor() {}

  /**
   * Analyze a captured MIDI session
   */
  async analyzeSession(sessionPath: string): Promise<ProtocolAnalysis> {
    console.log(`🔬 Analyzing MIDI session: ${basename(sessionPath)}`);
    console.log('─'.repeat(60));

    // Load session data
    const session = this.loadSession(sessionPath);
    console.log(`📊 Session contains ${session.messages.length} messages`);

    if (session.messages.length === 0) {
      throw new Error('Session contains no messages to analyze');
    }

    // Perform analysis
    const analysis = this.performAnalysis(session);

    // Display results
    this.displayAnalysis(analysis);

    // Save analysis results
    const outputPath = this.saveAnalysis(sessionPath, analysis);
    console.log(`💾 Analysis saved to: ${outputPath}`);

    return analysis;
  }

  /**
   * Load session data from JSON file
   */
  private loadSession(sessionPath: string): MonitorSession {
    if (!existsSync(sessionPath)) {
      throw new Error(`Session file not found: ${sessionPath}`);
    }

    try {
      const content = readFileSync(sessionPath, 'utf8');
      const session = JSON.parse(content) as MonitorSession;

      if (!session.messages || !Array.isArray(session.messages)) {
        throw new Error('Invalid session format: missing or invalid messages array');
      }

      return session;
    } catch (error: any) {
      throw new Error(`Failed to load session: ${error.message}`);
    }
  }

  /**
   * Perform comprehensive protocol analysis
   */
  private performAnalysis(session: MonitorSession): ProtocolAnalysis {
    console.log('🔍 Analyzing message patterns...');

    const sysexMessages = session.messages.filter(m => m.messageType === 'sysex');
    const ccMessages = session.messages.filter(m => m.messageType === 'cc');

    console.log(`   Found ${sysexMessages.length} SysEx messages`);
    console.log(`   Found ${ccMessages.length} CC messages`);

    // Analyze SysEx patterns
    const sysexPatterns = this.analyzeSysExPatterns(sysexMessages);

    // Analyze CC patterns
    const ccPatterns = this.analyzeCCPatterns(ccMessages);

    // Find Novation-specific messages
    const novationMessages = this.findNovationMessages(session.messages);

    // Analyze timing
    const timing = this.analyzeMessageTiming(session.messages);

    // Find unknown/unidentified messages
    const unknownMessages = this.findUnknownMessages(session.messages);

    const timeSpan = session.endTime && session.startTime
      ? session.endTime - session.startTime
      : 0;

    return {
      sessionId: session.sessionId,
      messageCount: session.messages.length,
      timeSpan,
      sysexPatterns,
      ccPatterns,
      timing,
      novationMessages,
      unknownMessages,
    };
  }

  /**
   * Analyze SysEx message patterns
   */
  private analyzeSysExPatterns(messages: readonly CapturedMessage[]): SysExPattern[] {
    const patterns = new Map<string, CapturedMessage[]>();

    // Group messages by their command structure
    for (const message of messages) {
      if (message.rawData.length < 3) continue;

      // Create pattern based on first few bytes (manufacturer + device + command)
      const patternBytes = message.rawData.slice(0, Math.min(7, message.rawData.length));
      const pattern = patternBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');

      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern)!.push(message);
    }

    // Convert to analysis results
    return Array.from(patterns.entries()).map(([pattern, examples]) => {
      const firstExample = examples[0]!;
      const analysis = this.analyzeSysExMessage(firstExample);

      return {
        pattern,
        count: examples.length,
        examples: examples.slice(0, 3), // Keep first 3 examples
        analysis,
      };
    }).sort((a, b) => b.count - a.count); // Sort by frequency
  }

  /**
   * Analyze individual SysEx message
   */
  private analyzeSysExMessage(message: CapturedMessage): any {
    const data = message.rawData;
    if (data.length < 3) return { description: 'Invalid SysEx message' };

    const analysis: any = {
      dataLength: data.length,
    };

    // Manufacturer ID analysis
    if (data[1] !== undefined && data[2] !== undefined) {
      const manId = `${data[1].toString(16).padStart(2, '0')} ${data[2].toString(16).padStart(2, '0')}`.toUpperCase();
      analysis.manufacturerId = manId;

      const manufacturer = this.knownManufacturers.get(manId);
      if (manufacturer) {
        (analysis as any).manufacturer = manufacturer;
      }

      // Novation-specific analysis
      if (manId === '00 20 29' && data.length >= 6) {
        const deviceId = `${data[4].toString(16).padStart(2, '0')} ${data[5].toString(16).padStart(2, '0')}`.toUpperCase();
        analysis.deviceId = deviceId;

        const device = this.novationDevices.get(deviceId);
        if (device) {
          (analysis as any).device = device;
        }

        // Command analysis for Launch Control XL 3
        if (deviceId === '02 11' && data.length >= 7) {
          analysis.command = '0x' + data[6].toString(16).padStart(2, '0');
          analysis.description = this.interpretLCXL3Command(data[6], data);
        }
      }
    }

    return analysis;
  }

  /**
   * Interpret Launch Control XL 3 specific commands
   */
  private interpretLCXL3Command(command: number, data: readonly number[]): string {
    switch (command) {
      case 0x77:
        return 'Device inquiry/handshake';
      case 0x78:
        return 'Device response/identification';
      case 0x01:
        return 'Custom mode data request';
      case 0x02:
        return 'Custom mode data response';
      case 0x11:
        return 'Write custom mode data';
      case 0x12:
        return 'Read custom mode data';
      case 0x20:
        return 'LED control/animation';
      case 0x21:
        return 'LED state update';
      case 0x40:
        return 'Control name assignment';
      case 0x41:
        return 'Control name response';
      default:
        return `Unknown command (0x${command.toString(16).padStart(2, '0')})`;
    }
  }

  /**
   * Analyze Control Change patterns
   */
  private analyzeCCPatterns(messages: readonly CapturedMessage[]): any[] {
    const ccNumbers = new Map<number, CapturedMessage[]>();

    for (const message of messages) {
      if (message.parsedData?.controller !== undefined) {
        const cc = message.parsedData.controller;
        if (!ccNumbers.has(cc)) {
          ccNumbers.set(cc, []);
        }
        ccNumbers.get(cc)!.push(message);
      }
    }

    return Array.from(ccNumbers.entries()).map(([ccNumber, messages]) => ({
      ccNumber,
      count: messages.length,
      valueRange: this.getValueRange(messages),
      examples: messages.slice(0, 3),
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Get value range for CC messages
   */
  private getValueRange(messages: readonly CapturedMessage[]): { min: number; max: number } {
    const values = messages
      .map(m => m.parsedData?.value)
      .filter(v => typeof v === 'number');

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  /**
   * Find messages from Novation devices
   */
  private findNovationMessages(messages: readonly CapturedMessage[]): CapturedMessage[] {
    return messages.filter(message => {
      if (message.messageType === 'sysex' && message.rawData.length >= 3) {
        const manId = `${message.rawData[1]?.toString(16).padStart(2, '0')} ${message.rawData[2]?.toString(16).padStart(2, '0')}`.toUpperCase();
        return manId === '00 20 29';
      }
      return false;
    });
  }

  /**
   * Analyze message timing patterns
   */
  private analyzeMessageTiming(messages: readonly CapturedMessage[]): any {
    if (messages.length < 2) {
      return { averageInterval: 0, burstPatterns: [] };
    }

    const intervals: number[] = [];
    for (let i = 1; i < messages.length; i++) {
      const interval = messages[i]!.timestamp - messages[i - 1]!.timestamp;
      intervals.push(interval);
    }

    const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Find burst patterns (messages sent in quick succession)
    const burstThreshold = 50; // 50ms
    const bursts: any[] = [];
    let currentBurst: CapturedMessage[] = [];

    for (let i = 0; i < intervals.length; i++) {
      if (intervals[i]! < burstThreshold) {
        if (currentBurst.length === 0) {
          currentBurst.push(messages[i]!);
        }
        currentBurst.push(messages[i + 1]!);
      } else {
        if (currentBurst.length > 1) {
          bursts.push({
            messageCount: currentBurst.length,
            duration: currentBurst[currentBurst.length - 1]!.timestamp - currentBurst[0]!.timestamp,
            messages: currentBurst.slice(0, 3), // Keep first 3 examples
          });
        }
        currentBurst = [];
      }
    }

    return {
      averageInterval: Math.round(averageInterval),
      burstPatterns: bursts,
    };
  }

  /**
   * Find unknown/unidentified messages
   */
  private findUnknownMessages(messages: readonly CapturedMessage[]): CapturedMessage[] {
    return messages.filter(message => {
      if (message.messageType === 'sysex') {
        if (message.rawData.length >= 3) {
          const manId = `${message.rawData[1]?.toString(16).padStart(2, '0')} ${message.rawData[2]?.toString(16).padStart(2, '0')}`.toUpperCase();
          return !this.knownManufacturers.has(manId);
        }
        return true;
      }
      return false;
    });
  }

  /**
   * Display analysis results
   */
  private displayAnalysis(analysis: ProtocolAnalysis): void {
    console.log('\n📈 Analysis Results:');
    console.log('═'.repeat(60));

    console.log(`Session ID: ${analysis.sessionId}`);
    console.log(`Time Span: ${analysis.timeSpan}ms`);
    console.log(`Total Messages: ${analysis.messageCount}`);

    // SysEx patterns
    console.log(`\n🔥 SysEx Patterns (${analysis.sysexPatterns.length}):`);
    for (const pattern of analysis.sysexPatterns.slice(0, 10)) {
      console.log(`   ${pattern.pattern} (${pattern.count}x)`);
      if ((pattern.analysis as any).manufacturer) {
        console.log(`      └─ ${(pattern.analysis as any).manufacturer}`);
      }
      if ((pattern.analysis as any).device) {
        console.log(`         └─ ${(pattern.analysis as any).device}`);
      }
      if (pattern.analysis.description) {
        console.log(`         └─ ${pattern.analysis.description}`);
      }
    }

    // Novation messages
    console.log(`\n🎛️  Novation Messages: ${analysis.novationMessages.length}`);
    if (analysis.novationMessages.length > 0) {
      console.log('   Recent Novation messages:');
      for (const msg of analysis.novationMessages.slice(-3)) {
        console.log(`      ${msg.hexData}`);
      }
    }

    // Timing analysis
    console.log(`\n⏱️  Timing Analysis:`);
    console.log(`   Average interval: ${analysis.timing.averageInterval}ms`);
    console.log(`   Burst patterns: ${analysis.timing.burstPatterns.length}`);

    // Unknown messages
    if (analysis.unknownMessages.length > 0) {
      console.log(`\n❓ Unknown Messages: ${analysis.unknownMessages.length}`);
      console.log('   (Messages from unrecognized manufacturers)');
    }
  }

  /**
   * Save analysis results to file
   */
  private saveAnalysis(sessionPath: string, analysis: ProtocolAnalysis): string {
    const baseName = basename(sessionPath, extname(sessionPath));
    const outputPath = join(sessionPath, '..', `${baseName}-analysis.json`);

    try {
      const json = JSON.stringify(analysis, null, 2);
      writeFileSync(outputPath, json, 'utf8');
      return outputPath;
    } catch (error: any) {
      throw new Error(`Failed to save analysis: ${error.message}`);
    }
  }

  /**
   * Batch analyze multiple sessions
   */
  async analyzeBatch(sessionPaths: string[]): Promise<ProtocolAnalysis[]> {
    console.log(`🔬 Batch analyzing ${sessionPaths.length} sessions`);
    console.log('═'.repeat(60));

    const analyses: ProtocolAnalysis[] = [];

    for (const sessionPath of sessionPaths) {
      try {
        const analysis = await this.analyzeSession(sessionPath);
        analyses.push(analysis);
        console.log(''); // Spacing between sessions
      } catch (error: any) {
        console.error(`❌ Failed to analyze ${sessionPath}: ${error.message}`);
      }
    }

    // Cross-session analysis
    if (analyses.length > 1) {
      this.performCrossSessionAnalysis(analyses);
    }

    return analyses;
  }

  /**
   * Perform cross-session analysis to find patterns
   */
  private performCrossSessionAnalysis(analyses: readonly ProtocolAnalysis[]): void {
    console.log('🔗 Cross-Session Pattern Analysis:');
    console.log('─'.repeat(40));

    // Find common SysEx patterns across sessions
    const allPatterns = new Map<string, number>();

    for (const analysis of analyses) {
      for (const pattern of analysis.sysexPatterns) {
        allPatterns.set(pattern.pattern, (allPatterns.get(pattern.pattern) || 0) + pattern.count);
      }
    }

    const commonPatterns = Array.from(allPatterns.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    console.log(`Found ${commonPatterns.length} patterns appearing across multiple sessions:`);
    for (const [pattern, count] of commonPatterns.slice(0, 5)) {
      console.log(`   ${pattern} (total: ${count}x)`);
    }
  }
}

// CLI interface when run directly
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: ./monitor-session-analyzer.ts <session-file> [session-file...]');
    console.error('       ./monitor-session-analyzer.ts --batch <directory>');
    process.exit(1);
  }

  const analyzer = new MonitorSessionAnalyzer();

  try {
    if (args[0] === '--batch') {
      // Batch mode - analyze all JSON files in directory
      const directory = args[1];
      if (!directory) {
        throw new Error('Directory path required for batch mode');
      }
      // Implementation would scan directory for JSON files
      console.log(`Batch analysis of directory: ${directory}`);
      // For now, just show the usage
      console.log('Batch mode not yet implemented - please specify individual files');
      process.exit(1);
    } else {
      // Single or multiple file mode
      const analyses = await analyzer.analyzeBatch(args);
      console.log(`\n✅ Successfully analyzed ${analyses.length} session(s)`);
    }
  } catch (error: any) {
    console.error(`❌ Analysis failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('monitor-session-analyzer.ts')) {
  main();
}

export { MonitorSessionAnalyzer, type ProtocolAnalysis, type SysExPattern };