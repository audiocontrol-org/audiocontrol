/**
 * Performance utilities and metrics for real-time MIDI operations
 */

/**
 * High-resolution performance timer
 */
export class PerformanceTimer {
  private startTime: number;
  private measurements: number[] = [];

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Start a new measurement
   */
  start(): void {
    this.startTime = performance.now();
  }

  /**
   * End the current measurement and return duration in milliseconds
   */
  end(): number {
    const duration = performance.now() - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  /**
   * Get statistics for all measurements
   */
  getStats(): PerformanceStats {
    if (this.measurements.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      mean: sum / count,
      median: sorted[Math.floor(count / 2)]!,
      p95: sorted[Math.floor(count * 0.95)]!,
      p99: sorted[Math.floor(count * 0.99)]!,
    };
  }

  /**
   * Reset all measurements
   */
  reset(): void {
    this.measurements = [];
  }
}

export interface PerformanceStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private initialUsage: NodeJS.MemoryUsage;
  private measurements: NodeJS.MemoryUsage[] = [];

  constructor() {
    this.initialUsage = process.memoryUsage();
  }

  /**
   * Take a memory usage snapshot
   */
  snapshot(): NodeJS.MemoryUsage {
    const usage = process.memoryUsage();
    this.measurements.push(usage);
    return usage;
  }

  /**
   * Get memory usage delta from initial snapshot
   */
  getDelta(): MemoryDelta {
    const current = process.memoryUsage();
    return {
      rss: current.rss - this.initialUsage.rss,
      heapTotal: current.heapTotal - this.initialUsage.heapTotal,
      heapUsed: current.heapUsed - this.initialUsage.heapUsed,
      external: current.external - this.initialUsage.external,
      arrayBuffers: current.arrayBuffers - this.initialUsage.arrayBuffers,
    };
  }

  /**
   * Format memory usage in human-readable format
   */
  formatUsage(usage: NodeJS.MemoryUsage): string {
    const formatBytes = (bytes: number): string => {
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(1)}MB`;
    };

    return [
      `RSS: ${formatBytes(usage.rss)}`,
      `Heap Total: ${formatBytes(usage.heapTotal)}`,
      `Heap Used: ${formatBytes(usage.heapUsed)}`,
      `External: ${formatBytes(usage.external)}`,
      `Array Buffers: ${formatBytes(usage.arrayBuffers)}`,
    ].join(', ');
  }
}

export interface MemoryDelta {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

/**
 * MIDI latency measurement
 */
export class LatencyMeasurement {
  private sendTimes = new Map<string, number>();
  private latencies: number[] = [];

  /**
   * Record when a MIDI message was sent
   */
  recordSend(messageId: string): void {
    this.sendTimes.set(messageId, performance.now());
  }

  /**
   * Record when a MIDI response was received
   */
  recordReceive(messageId: string): number | undefined {
    const sendTime = this.sendTimes.get(messageId);
    if (sendTime === undefined) {
      return undefined;
    }

    const latency = performance.now() - sendTime;
    this.latencies.push(latency);
    this.sendTimes.delete(messageId);

    return latency;
  }

  /**
   * Get latency statistics
   */
  getStats(): PerformanceStats {
    if (this.latencies.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      mean: sum / count,
      median: sorted[Math.floor(count / 2)]!,
      p95: sorted[Math.floor(count * 0.95)]!,
      p99: sorted[Math.floor(count * 0.99)]!,
    };
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.sendTimes.clear();
    this.latencies = [];
  }
}

/**
 * Throughput measurement for MIDI messages
 */
export class ThroughputMeasurement {
  private messageCount = 0;
  private startTime = performance.now();
  private measurements: { timestamp: number; count: number }[] = [];

  /**
   * Record a processed message
   */
  recordMessage(): void {
    this.messageCount++;
  }

  /**
   * Take a throughput measurement
   */
  measure(): ThroughputStats {
    const now = performance.now();
    const elapsed = (now - this.startTime) / 1000; // Convert to seconds
    const messagesPerSecond = elapsed > 0 ? this.messageCount / elapsed : 0;

    const stats = {
      messagesPerSecond,
      totalMessages: this.messageCount,
      elapsedSeconds: elapsed,
      timestamp: now,
    };

    this.measurements.push({ timestamp: now, count: this.messageCount });
    return stats;
  }

  /**
   * Get recent throughput over specified window
   */
  getRecentThroughput(windowSeconds: number = 10): number {
    const now = performance.now();
    const cutoff = now - (windowSeconds * 1000);

    // Find measurements within the window
    const recentMeasurements = this.measurements.filter(m => m.timestamp >= cutoff);

    if (recentMeasurements.length < 2) {
      return 0;
    }

    const oldest = recentMeasurements[0]!;
    const newest = recentMeasurements[recentMeasurements.length - 1]!;

    const messagesDiff = newest.count - oldest.count;
    const timeDiff = (newest.timestamp - oldest.timestamp) / 1000;

    return timeDiff > 0 ? messagesDiff / timeDiff : 0;
  }

  /**
   * Reset measurements
   */
  reset(): void {
    this.messageCount = 0;
    this.startTime = performance.now();
    this.measurements = [];
  }
}

export interface ThroughputStats {
  messagesPerSecond: number;
  totalMessages: number;
  elapsedSeconds: number;
  timestamp: number;
}

/**
 * Comprehensive performance monitor for the entire library
 */
export class PerformanceMonitor {
  readonly connection = new PerformanceTimer();
  readonly commands = new PerformanceTimer();
  readonly sysex = new PerformanceTimer();
  readonly parsing = new PerformanceTimer();
  readonly memory = new MemoryTracker();
  readonly latency = new LatencyMeasurement();
  readonly throughput = new ThroughputMeasurement();

  /**
   * Get a comprehensive performance report
   */
  getReport(): PerformanceReport {
    return {
      connection: this.connection.getStats(),
      commands: this.commands.getStats(),
      sysex: this.sysex.getStats(),
      parsing: this.parsing.getStats(),
      memory: this.memory.getDelta(),
      latency: this.latency.getStats(),
      throughput: this.throughput.measure(),
      timestamp: Date.now(),
    };
  }

  /**
   * Reset all measurements
   */
  reset(): void {
    this.connection.reset();
    this.commands.reset();
    this.sysex.reset();
    this.parsing.reset();
    this.latency.clear();
    this.throughput.reset();
  }
}

export interface PerformanceReport {
  connection: PerformanceStats;
  commands: PerformanceStats;
  sysex: PerformanceStats;
  parsing: PerformanceStats;
  memory: MemoryDelta;
  latency: PerformanceStats;
  throughput: ThroughputStats;
  timestamp: number;
}