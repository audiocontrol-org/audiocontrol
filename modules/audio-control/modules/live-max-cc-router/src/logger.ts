/**
 * Centralized logging utility for Max for Live
 * Provides configurable log levels to control verbosity
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO; // Default to INFO level
  private prefix: string = "CC Router";

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level set to ${LogLevel[level]}`);
  }

  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  public error(message: string): void {
    if (this.logLevel >= LogLevel.ERROR) {
      error(`${this.prefix} [ERROR]: ${message}\n`);
    }
  }

  public warn(message: string): void {
    if (this.logLevel >= LogLevel.WARN) {
      post(`${this.prefix} [WARN]: ${message}\n`);
    }
  }

  public info(message: string): void {
    if (this.logLevel >= LogLevel.INFO) {
      post(`${this.prefix}: ${message}\n`);
    }
  }

  public debug(message: string): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      post(`${this.prefix} [DEBUG]: ${message}\n`);
    }
  }

  public trace(message: string): void {
    if (this.logLevel >= LogLevel.TRACE) {
      post(`${this.prefix} [TRACE]: ${message}\n`);
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
