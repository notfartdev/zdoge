/**
 * Structured Event Logging Utility
 * 
 * Provides consistent, structured logging for all backend events.
 * Supports different log levels and structured data output.
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  service: string;
  event: string;
  message: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: {
    requestId?: string;
    ip?: string;
    userId?: string;
    txHash?: string;
    poolAddress?: string;
    [key: string]: any; // Allow additional properties for flexibility
  };
}

class Logger {
  private service: string;
  private minLevel: LogLevel;

  constructor(service: string, minLevel: LogLevel = LogLevel.INFO) {
    this.service = service;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatLog(event: LogEvent): string {
    // Format as JSON for structured logging
    return JSON.stringify(event);
  }

  private log(level: LogLevel, event: string, message: string, data?: Record<string, any>, error?: Error, metadata?: LogEvent['metadata']): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEvent: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      event,
      message,
      ...(data && { data }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          ...(error.stack && { stack: error.stack }),
        },
      }),
      ...(metadata && { metadata }),
    };

    const formatted = this.formatLog(logEvent);
    
    // Output to console with appropriate method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }
  }

  debug(event: string, message: string, data?: Record<string, any>, metadata?: LogEvent['metadata']): void {
    this.log(LogLevel.DEBUG, event, message, data, undefined, metadata);
  }

  info(event: string, message: string, data?: Record<string, any>, metadata?: LogEvent['metadata']): void {
    this.log(LogLevel.INFO, event, message, data, undefined, metadata);
  }

  warn(event: string, message: string, data?: Record<string, any>, metadata?: LogEvent['metadata']): void {
    this.log(LogLevel.WARN, event, message, data, undefined, metadata);
  }

  error(event: string, message: string, error?: Error, data?: Record<string, any>, metadata?: LogEvent['metadata']): void {
    this.log(LogLevel.ERROR, event, message, data, error, metadata);
  }

  // Convenience methods for common events
  requestReceived(endpoint: string, method: string, metadata?: LogEvent['metadata']): void {
    this.info('request.received', `${method} ${endpoint}`, undefined, metadata);
  }

  requestCompleted(endpoint: string, method: string, statusCode: number, duration: number, metadata?: LogEvent['metadata']): void {
    this.info('request.completed', `${method} ${endpoint} - ${statusCode} (${duration}ms)`, { statusCode, duration }, metadata);
  }

  transactionSubmitted(txHash: string, operation: string, metadata?: LogEvent['metadata']): void {
    this.info('transaction.submitted', `Transaction submitted: ${txHash}`, { txHash, operation }, { ...metadata, txHash });
  }

  transactionConfirmed(txHash: string, blockNumber: number, metadata?: LogEvent['metadata']): void {
    this.info('transaction.confirmed', `Transaction confirmed: ${txHash}`, { txHash, blockNumber }, { ...metadata, txHash });
  }

  transactionFailed(txHash: string, error: Error, metadata?: LogEvent['metadata']): void {
    this.error('transaction.failed', `Transaction failed: ${txHash}`, error, { txHash }, { ...metadata, txHash });
  }

  proofGenerated(operation: string, duration: number, metadata?: LogEvent['metadata']): void {
    this.info('proof.generated', `Proof generated for ${operation}`, { operation, duration }, metadata);
  }

  proofVerified(operation: string, valid: boolean, metadata?: LogEvent['metadata']): void {
    this.info('proof.verified', `Proof verified for ${operation}: ${valid ? 'valid' : 'invalid'}`, { operation, valid }, metadata);
  }

  rateLimitExceeded(ip: string, endpoint: string, metadata?: LogEvent['metadata']): void {
    this.warn('rate_limit.exceeded', `Rate limit exceeded for ${ip} on ${endpoint}`, { ip, endpoint }, { ...metadata, ip });
  }
}

// Create logger instances for different services
export const shieldedRelayerLogger = new Logger('shielded-relayer');
export const shieldedIndexerLogger = new Logger('shielded-indexer');
export const apiLogger = new Logger('api');

// Export default logger
export default Logger;
