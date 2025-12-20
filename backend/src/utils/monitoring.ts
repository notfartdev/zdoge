/**
 * Health Monitoring & Alerting
 * 
 * Tracks system health and can send alerts.
 * For production, integrate with PagerDuty, Slack, etc.
 */

import { createPublicClient, http, type Address } from 'viem';
import { dogeosTestnet } from '../config.js';

// Monitoring configuration
const MONITORING_CONFIG = {
  // Minimum relayer balance in DOGE
  minRelayerBalance: 1,
  // Warning threshold (5 DOGE)
  warnRelayerBalance: 5,
  // Check interval in ms
  checkInterval: 60000, // 1 minute
  // Max consecutive failures before alert
  maxConsecutiveFailures: 3,
};

// Metrics storage
interface Metrics {
  // Transaction metrics
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  
  // Timing metrics
  avgTransactionTime: number;
  lastTransactionTime: number;
  
  // Error tracking
  errorCounts: Map<string, number>;
  lastErrors: Array<{ code: string; message: string; timestamp: number }>;
  
  // Health status
  consecutiveFailures: number;
  lastHealthCheck: number;
  isHealthy: boolean;
  
  // Relayer metrics
  relayerBalance: number;
  relayerBalanceWarning: boolean;
  
  // Pool metrics
  poolStats: Map<string, { deposits: number; withdrawals: number }>;
}

const metrics: Metrics = {
  totalTransactions: 0,
  successfulTransactions: 0,
  failedTransactions: 0,
  avgTransactionTime: 0,
  lastTransactionTime: 0,
  errorCounts: new Map(),
  lastErrors: [],
  consecutiveFailures: 0,
  lastHealthCheck: Date.now(),
  isHealthy: true,
  relayerBalance: 0,
  relayerBalanceWarning: false,
  poolStats: new Map(),
};

// Alert handlers (extend for PagerDuty, Slack, etc.)
type AlertHandler = (alert: Alert) => void;
const alertHandlers: AlertHandler[] = [];

interface Alert {
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: number;
}

/**
 * Register an alert handler
 */
export function onAlert(handler: AlertHandler): void {
  alertHandlers.push(handler);
}

/**
 * Send an alert
 */
function sendAlert(level: Alert['level'], title: string, message: string): void {
  const alert: Alert = {
    level,
    title,
    message,
    timestamp: Date.now(),
  };
  
  // Log locally
  const logFn = level === 'critical' ? console.error : level === 'warning' ? console.warn : console.log;
  logFn(`[Alert:${level.toUpperCase()}] ${title}: ${message}`);
  
  // Call handlers
  for (const handler of alertHandlers) {
    try {
      handler(alert);
    } catch (error) {
      console.error('[Monitor] Alert handler failed:', error);
    }
  }
}

/**
 * Record a transaction result
 */
export function recordTransaction(success: boolean, durationMs: number, errorCode?: string): void {
  metrics.totalTransactions++;
  metrics.lastTransactionTime = durationMs;
  
  if (success) {
    metrics.successfulTransactions++;
    metrics.consecutiveFailures = 0;
    
    // Update average
    const total = metrics.successfulTransactions;
    metrics.avgTransactionTime = ((metrics.avgTransactionTime * (total - 1)) + durationMs) / total;
  } else {
    metrics.failedTransactions++;
    metrics.consecutiveFailures++;
    
    if (errorCode) {
      const count = metrics.errorCounts.get(errorCode) || 0;
      metrics.errorCounts.set(errorCode, count + 1);
      
      metrics.lastErrors.push({
        code: errorCode,
        message: `Transaction failed with ${errorCode}`,
        timestamp: Date.now(),
      });
      
      // Keep only last 100 errors
      if (metrics.lastErrors.length > 100) {
        metrics.lastErrors.shift();
      }
    }
    
    // Check for alert conditions
    if (metrics.consecutiveFailures >= MONITORING_CONFIG.maxConsecutiveFailures) {
      sendAlert('critical', 'Multiple Transaction Failures', 
        `${metrics.consecutiveFailures} consecutive transactions have failed`);
    }
  }
}

/**
 * Update relayer balance
 */
export function updateRelayerBalance(balanceDoge: number): void {
  metrics.relayerBalance = balanceDoge;
  
  if (balanceDoge < MONITORING_CONFIG.minRelayerBalance && !metrics.relayerBalanceWarning) {
    metrics.relayerBalanceWarning = true;
    sendAlert('critical', 'Low Relayer Balance', 
      `Relayer balance is ${balanceDoge.toFixed(4)} DOGE, below minimum ${MONITORING_CONFIG.minRelayerBalance} DOGE`);
  } else if (balanceDoge < MONITORING_CONFIG.warnRelayerBalance && !metrics.relayerBalanceWarning) {
    metrics.relayerBalanceWarning = true;
    sendAlert('warning', 'Low Relayer Balance Warning', 
      `Relayer balance is ${balanceDoge.toFixed(4)} DOGE, approaching minimum`);
  } else if (balanceDoge >= MONITORING_CONFIG.warnRelayerBalance) {
    metrics.relayerBalanceWarning = false;
  }
}

/**
 * Update pool statistics
 */
export function updatePoolStats(poolAddress: string, deposits: number, withdrawals: number): void {
  metrics.poolStats.set(poolAddress.toLowerCase(), { deposits, withdrawals });
}

/**
 * Get current metrics
 */
export function getMetrics(): {
  transactions: {
    total: number;
    successful: number;
    failed: number;
    successRate: string;
    avgTimeMs: number;
  };
  relayer: {
    balance: number;
    warning: boolean;
  };
  health: {
    isHealthy: boolean;
    consecutiveFailures: number;
    lastCheck: number;
  };
  errors: {
    counts: Record<string, number>;
    recent: Array<{ code: string; message: string; timestamp: number }>;
  };
} {
  const successRate = metrics.totalTransactions > 0
    ? ((metrics.successfulTransactions / metrics.totalTransactions) * 100).toFixed(2)
    : '0.00';
  
  return {
    transactions: {
      total: metrics.totalTransactions,
      successful: metrics.successfulTransactions,
      failed: metrics.failedTransactions,
      successRate: `${successRate}%`,
      avgTimeMs: Math.round(metrics.avgTransactionTime),
    },
    relayer: {
      balance: metrics.relayerBalance,
      warning: metrics.relayerBalanceWarning,
    },
    health: {
      isHealthy: metrics.isHealthy && metrics.consecutiveFailures < MONITORING_CONFIG.maxConsecutiveFailures,
      consecutiveFailures: metrics.consecutiveFailures,
      lastCheck: metrics.lastHealthCheck,
    },
    errors: {
      counts: Object.fromEntries(metrics.errorCounts),
      recent: metrics.lastErrors.slice(-10),
    },
  };
}

/**
 * Run health check
 */
export async function runHealthCheck(relayerAddress?: Address): Promise<boolean> {
  metrics.lastHealthCheck = Date.now();
  
  try {
    const publicClient = createPublicClient({
      chain: dogeosTestnet,
      transport: http(),
    });
    
    // Check RPC connection
    await publicClient.getBlockNumber();
    
    // Check relayer balance if address provided
    if (relayerAddress) {
      const balance = await publicClient.getBalance({ address: relayerAddress });
      const balanceDoge = Number(balance) / 1e18;
      updateRelayerBalance(balanceDoge);
    }
    
    metrics.isHealthy = true;
    return true;
    
  } catch (error) {
    console.error('[Monitor] Health check failed:', error);
    metrics.isHealthy = false;
    sendAlert('critical', 'Health Check Failed', 'Unable to connect to RPC or check relayer balance');
    return false;
  }
}

// Console alert handler (default)
onAlert((alert) => {
  // Already logged in sendAlert, but you can add more logic here
  // For production, add PagerDuty, Slack, Discord webhooks, etc.
});

console.log('[Monitor] Health monitoring initialized');

