// Production logging and monitoring utilities
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

class Logger {
  private level: LogLevel;
  private buffer: LogEntry[] = [];
  private maxBufferSize = 100;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(level: LogLevel = import.meta.env.PROD ? LogLevel.INFO : LogLevel.DEBUG) {
    this.level = level;
    this.startPeriodicFlush();
  }

  private startPeriodicFlush() {
    // Flush logs every 30 seconds in production
    if (import.meta.env.PROD) {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, 30000);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };
  }

  private getCurrentUserId(): string | undefined {
    // Get user ID from auth context or local storage
    if (typeof window !== 'undefined') {
      // Try to get from local storage or auth state
      return localStorage.getItem('currentUserId') || undefined;
    }
    return undefined;
  }

  private getSessionId(): string | undefined {
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem('sessionId', sessionId);
      }
      return sessionId;
    }
    return undefined;
  }

  private formatMessage(entry: LogEntry): string {
    return `[${entry.timestamp}] ${LogLevel[entry.level]}: ${entry.message}`;
  }

  private addToBuffer(entry: LogEntry) {
    this.buffer.push(entry);

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const logsToSend = [...this.buffer];
    this.buffer = [];

    // In production, send to monitoring service
    if (import.meta.env.PROD) {
      try {
        // Replace with your monitoring service endpoint
        // await fetch('/api/logs', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ logs: logsToSend }),
        // });

        // For now, just log to console in development
        console.group('📊 Application Logs');
        logsToSend.forEach(entry => {
          console.log(this.formatMessage(entry), entry.data || '');
        });
        console.groupEnd();
      } catch (error) {
        console.error('Failed to send logs:', error);
        // Put logs back in buffer if sending fails
        this.buffer.unshift(...logsToSend);
      }
    } else {
      // Development: log to console
      logsToSend.forEach(entry => {
        const style = this.getConsoleStyle(entry.level);
        console.log(`%c${this.formatMessage(entry)}`, style, entry.data || '');
      });
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return 'color: #888';
      case LogLevel.INFO: return 'color: #2196F3';
      case LogLevel.WARN: return 'color: #FF9800';
      case LogLevel.ERROR: return 'color: #F44336';
      case LogLevel.FATAL: return 'color: #F44336; font-weight: bold';
      default: return '';
    }
  }

  debug(message: string, data?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, data);
      this.addToBuffer(entry);
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry(LogLevel.INFO, message, data);
      this.addToBuffer(entry);
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry(LogLevel.WARN, message, data);
      this.addToBuffer(entry);
    }
  }

  error(message: string, data?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry(LogLevel.ERROR, message, data);
      this.addToBuffer(entry);
    }
  }

  fatal(message: string, data?: any) {
    if (this.shouldLog(LogLevel.FATAL)) {
      const entry = this.createLogEntry(LogLevel.FATAL, message, data);
      this.addToBuffer(entry);
      // Immediately flush fatal errors
      this.flush();
    }
  }

  // Performance monitoring
  startTimer(name: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.info(`Timer: ${name}`, { duration: `${duration.toFixed(2)}ms` });
    };
  }

  // User action tracking
  trackUserAction(action: string, data?: any) {
    this.info(`User Action: ${action}`, data);
  }

  // API call monitoring
  trackApiCall(endpoint: string, method: string, duration: number, success: boolean) {
    this.info(`API Call: ${method} ${endpoint}`, {
      duration: `${duration.toFixed(2)}ms`,
      success,
    });
  }

  // Error boundary reporting
  reportErrorBoundary(error: Error, errorInfo: any) {
    this.fatal('React Error Boundary triggered', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  // Cleanup
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush(); // Final flush
  }
}

// Export singleton instance
export const logger = new Logger();

// Performance monitoring utilities
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  startMeasurement(name: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
    };
  }

  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }

    // Log slow operations
    if (value > 1000) {
      logger.warn(`Slow operation detected: ${name}`, { duration: `${value.toFixed(2)}ms` });
    }
  }

  getMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, any> = {};

    for (const [name, values] of this.metrics.entries()) {
      if (values.length === 0) continue;

      const sum = values.reduce((a, b) => a + b, 0);
      result[name] = {
        avg: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }

    return result;
  }

  reset() {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Memory usage monitoring (client-side)
export const getMemoryUsage = () => {
  if ('memory' in performance) {
    const memInfo = (performance as any).memory;
    return {
      used: Math.round(memInfo.usedJSHeapSize / 1048576), // Convert to MB
      total: Math.round(memInfo.totalJSHeapSize / 1048576),
      limit: Math.round(memInfo.jsHeapSizeLimit / 1048576),
    };
  }
  return null;
};

// Export utilities for use in components
export const withLogging = <T extends (...args: any[]) => any>(
  fn: T,
  operationName: string
): T => {
  return ((...args: any[]) => {
    const endTimer = logger.startTimer(operationName);
    try {
      const result = fn(...args);
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      logger.error(`Error in ${operationName}`, error);
      throw error;
    }
  }) as T;
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    logger.info('Page unloading');
    logger.destroy();
  });
}
