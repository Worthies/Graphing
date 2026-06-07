/**
 * Logger utility for SVG Editor webview.
 * Provides structured logging with VS Code output channel integration.
 */

declare function acquireVsCodeApi(): { postMessage(args: any): void };

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
}

// Cache VS Code API instance (acquireVsCodeApi can only be called once)
let vscodeApi: { postMessage(args: any): void } | null = null;

function getVsCodeApi(): { postMessage(args: any): void } | null {
  if (vscodeApi) return vscodeApi;
  try {
    vscodeApi = acquireVsCodeApi();
    return vscodeApi;
  } catch {
    return null;
  }
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private buffer: LogEntry[] = [];
  private flushTimeout: number | null = null;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any, context?: string): void {
    const errorData = {
      message: (error && error.message) || String(error),
      stack: error && error.stack,
      context
    };
    this.log(LogLevel.ERROR, message, errorData);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: Date.now()
    };

    // Console output for development
    const consoleMethod = level === LogLevel.ERROR ? 'error' :
                          level === LogLevel.WARN ? 'warn' : 'log';
    console[consoleMethod](`[Graphing] ${message}`, data || '');

    // Buffer for VS Code output
    this.buffer.push(entry);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) return;

    this.flushTimeout = window.setTimeout(() => {
      this.flush();
      this.flushTimeout = null;
    }, 1000) as unknown as number;
  }

  private flush(): void {
    if (this.buffer.length === 0) return;

    const api = getVsCodeApi();
    if (api) {
      api.postMessage({
        command: 'log',
        data: this.buffer.map(entry => ({
          level: LogLevel[entry.level],
          message: entry.message,
          data: entry.data,
          timestamp: new Date(entry.timestamp).toISOString()
        }))
      });
    }

    this.buffer = [];
  }
}

export const logger = new Logger();

/**
 * Error boundary wrapper for async operations
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    logger.error(errorMessage, error);
    return fallback;
  }
}

/**
 * Error boundary wrapper for sync operations
 */
export function withSyncErrorHandling<T>(
  operation: () => T,
  errorMessage: string,
  fallback?: T
): T | undefined {
  try {
    return operation();
  } catch (error) {
    logger.error(errorMessage, error);
    return fallback;
  }
}
