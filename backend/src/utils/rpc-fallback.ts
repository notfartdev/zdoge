/**
 * RPC Fallback Manager
 * 
 * Provides multiple RPC endpoints with automatic fallback.
 */

import { createPublicClient, http, type PublicClient, type HttpTransport, type Chain } from 'viem';
import { dogeosTestnet } from '../config.js';

// RPC endpoints configuration
const RPC_ENDPOINTS = [
  // Primary endpoint
  {
    name: 'DogeOS Primary',
    url: 'https://rpc.testnet.dogeos.com',
    priority: 1,
  },
  // Backup endpoints
  {
    name: 'Blockscout',
    url: 'https://blockscout.testnet.dogeos.com/api/eth-rpc',
    priority: 2,
  },
];

interface RPCEndpoint {
  name: string;
  url: string;
  priority: number;
  failureCount: number;
  lastFailure: number;
  isHealthy: boolean;
}

const endpoints: RPCEndpoint[] = RPC_ENDPOINTS.map(e => ({
  ...e,
  failureCount: 0,
  lastFailure: 0,
  isHealthy: true,
}));

// Failure threshold before marking unhealthy
const FAILURE_THRESHOLD = 3;
// Recovery time in ms (5 minutes)
const RECOVERY_TIME = 5 * 60 * 1000;

let currentEndpointIndex = 0;

/**
 * Get the best available RPC URL
 */
export function getBestRpcUrl(): string {
  const now = Date.now();
  
  // Sort by priority and health
  const sorted = [...endpoints].sort((a, b) => {
    // Healthy endpoints first
    if (a.isHealthy !== b.isHealthy) {
      return a.isHealthy ? -1 : 1;
    }
    // Then by priority
    return a.priority - b.priority;
  });
  
  // Check if unhealthy endpoints have recovered
  for (const endpoint of sorted) {
    if (!endpoint.isHealthy && (now - endpoint.lastFailure) > RECOVERY_TIME) {
      endpoint.isHealthy = true;
      endpoint.failureCount = 0;
      console.log(`[RPC] Endpoint ${endpoint.name} marked as recovered`);
    }
  }
  
  // Return first healthy endpoint
  const healthy = sorted.find(e => e.isHealthy);
  if (healthy) {
    const idx = endpoints.indexOf(healthy);
    if (idx !== currentEndpointIndex) {
      console.log(`[RPC] Switching to ${healthy.name} (${healthy.url})`);
      currentEndpointIndex = idx;
    }
    return healthy.url;
  }
  
  // All unhealthy, return primary anyway
  console.warn('[RPC] All endpoints unhealthy, using primary');
  return endpoints[0].url;
}

/**
 * Report an RPC failure
 */
export function reportRpcFailure(url?: string): void {
  const endpoint = url 
    ? endpoints.find(e => e.url === url)
    : endpoints[currentEndpointIndex];
  
  if (endpoint) {
    endpoint.failureCount++;
    endpoint.lastFailure = Date.now();
    
    if (endpoint.failureCount >= FAILURE_THRESHOLD) {
      endpoint.isHealthy = false;
      console.warn(`[RPC] Endpoint ${endpoint.name} marked unhealthy after ${endpoint.failureCount} failures`);
    }
  }
}

/**
 * Report an RPC success
 */
export function reportRpcSuccess(url?: string): void {
  const endpoint = url 
    ? endpoints.find(e => e.url === url)
    : endpoints[currentEndpointIndex];
  
  if (endpoint) {
    endpoint.failureCount = 0;
    endpoint.isHealthy = true;
  }
}

/**
 * Create a public client with fallback support
 */
export function createFallbackClient(): PublicClient {
  const url = getBestRpcUrl();
  
  return createPublicClient({
    chain: dogeosTestnet,
    transport: http(url),
  });
}

/**
 * Execute a function with RPC fallback
 */
export async function withFallback<T>(
  fn: (client: PublicClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const url = getBestRpcUrl();
    const client = createPublicClient({
      chain: dogeosTestnet,
      transport: http(url),
    });
    
    try {
      const result = await fn(client);
      reportRpcSuccess(url);
      return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`[RPC] Attempt ${attempt + 1} failed on ${url}:`, error.message);
      reportRpcFailure(url);
    }
  }
  
  throw lastError || new Error('All RPC attempts failed');
}

/**
 * Get status of all endpoints
 */
export function getEndpointStatus(): Array<{
  name: string;
  url: string;
  healthy: boolean;
  failureCount: number;
  priority: number;
}> {
  return endpoints.map(e => ({
    name: e.name,
    url: e.url,
    healthy: e.isHealthy,
    failureCount: e.failureCount,
    priority: e.priority,
  }));
}

/**
 * Add a custom RPC endpoint
 */
export function addEndpoint(name: string, url: string, priority: number = 10): void {
  endpoints.push({
    name,
    url,
    priority,
    failureCount: 0,
    lastFailure: 0,
    isHealthy: true,
  });
  console.log(`[RPC] Added endpoint ${name} (${url})`);
}

console.log(`[RPC] Fallback manager initialized with ${endpoints.length} endpoints`);

