export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

export interface LoggerOptions {
  prefix?: string;
  includeTimestamp?: boolean;
}

export class NoOpLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export class ConsoleLogger implements Logger {
  private readonly prefix: string | undefined;
  private readonly includeTimestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix;
    this.includeTimestamp = options.includeTimestamp ?? false;
  }

  private formatMessage(msg: string): string {
    const parts: string[] = [];

    if (this.includeTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    parts.push(msg);

    return parts.join(' ');
  }

  debug(msg: string, ...args: unknown[]): void {
    console.debug(this.formatMessage(msg), ...args);
  }

  info(msg: string, ...args: unknown[]): void {
    console.info(this.formatMessage(msg), ...args);
  }

  warn(msg: string, ...args: unknown[]): void {
    console.warn(this.formatMessage(msg), ...args);
  }

  error(msg: string, ...args: unknown[]): void {
    console.error(this.formatMessage(msg), ...args);
  }
}