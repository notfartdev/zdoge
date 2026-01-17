/**
 * Unshield Monitoring Service
 * 
 * Monitors Unshield events from ShieldedPool contract to detect when tokens
 * are unshielded TO the connected wallet address.
 * 
 * How it works:
 * 1. Polls Unshield events from the ShieldedPool contract
 * 2. Filters events where recipient matches connected wallet address
 * 3. Prevents duplicate notifications using nullifierHash + txHash
 * 4. Triggers notification callback for incoming unshield transactions
 */

import { getPrivacyRpcUrl } from './privacy-utils';
import { shieldedPool } from '../dogeos-config';

/**
 * Get token symbol from token address
 */
function getTokenSymbolFromAddress(tokenAddress: string): string {
  // Normalize address for comparison
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // Check if it's native DOGE
  if (normalizedAddress === '0x0000000000000000000000000000000000000000' || 
      normalizedAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    return 'DOGE';
  }
  
  // Check supported tokens in shielded pool
  for (const [symbol, config] of Object.entries(shieldedPool.supportedTokens)) {
    if (config.address.toLowerCase() === normalizedAddress) {
      return symbol;
    }
  }
  
  // Fallback to 'Unknown' if not found
  console.warn(`[UnshieldMonitoring] Unknown token address: ${tokenAddress}`);
  return 'Unknown';
}

// Configuration
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

// Unshield event signature (V3): Unshield(bytes32 indexed nullifierHash, address indexed recipient, address indexed token, uint256 amount, bytes32 changeCommitment, address relayer, uint256 fee, uint256 timestamp)
// Event topic: keccak256("Unshield(bytes32,address,address,uint256,bytes32,address,uint256,uint256)")
// Note: V3 includes changeCommitment parameter
const UNSHIELD_EVENT_TOPIC_V3 = '0x67a09057b6d0c1b147347dafc527e5cfac7d1964c4c116a07915861f767ec53a'; // V3 signature
// V2 signature (for backward compatibility): Unshield(bytes32,address,address,uint256,address,uint256,uint256)
// We'll query for both topics to catch all events
const UNSHIELD_EVENT_TOPIC_V2 = '0x67a09057b6d0c1b147347dafc527e5cfac7d1964c4c116a07915861f767ec53a'; // Same for now, will update if different

// State
let isScanning = false;
let lastScannedBlock = 0;
let scanInterval: NodeJS.Timeout | null = null;
let onUnshieldCallback: ((unshield: UnshieldEvent) => void) | null = null;

// SECURITY: Rate limiting to prevent RPC spam and DoS attacks
let lastQueryTime = 0;
const MIN_QUERY_INTERVAL_MS = 5000; // Minimum 5 seconds between queries

export interface UnshieldEvent {
  nullifierHash: string;
  recipient: string;
  token: string; // Token address
  tokenSymbol: string; // Token symbol (e.g., "DOGE", "USDC")
  amount: bigint;
  relayer: string;
  fee: bigint;
  timestamp: number;
  blockNumber: number;
  txHash: string;
}

// Track processed unshield events to prevent duplicates
// Key format: `${txHash}:${nullifierHash}`
const processedUnshieldEvents = new Set<string>();

/**
 * Get processed events from localStorage (persists across refreshes)
 * SECURITY: Graceful degradation if localStorage is unavailable (disabled, quota exceeded, etc.)
 */
function getProcessedEventsFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem('shielded_processed_unshields');
    if (!stored) return new Set();
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('[UnshieldMonitoring] Invalid localStorage data format, resetting');
      localStorage.removeItem('shielded_processed_unshields');
      return new Set();
    }
    
    return new Set(parsed);
  } catch (error) {
    // localStorage unavailable (disabled, quota exceeded, private mode, etc.)
    console.warn('[UnshieldMonitoring] localStorage unavailable, using in-memory tracking only:', error);
    return new Set();
  }
}

/**
 * Save processed events to localStorage
 */
function saveProcessedEventsToStorage(events: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep only last 500 events to avoid localStorage bloat
    const arr = Array.from(events);
    const toStore = arr.length > 500 ? arr.slice(-500) : arr;
    localStorage.setItem('shielded_processed_unshields', JSON.stringify(toStore));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if an unshield event has already been processed
 */
function isUnshieldEventProcessed(txHash: string, nullifierHash: string): boolean {
  const key = `${txHash}:${nullifierHash}`;
  const stored = getProcessedEventsFromStorage();
  return processedUnshieldEvents.has(key) || stored.has(key);
}

/**
 * Mark an unshield event as processed
 */
function markUnshieldEventProcessed(txHash: string, nullifierHash: string): void {
  const key = `${txHash}:${nullifierHash}`;
  processedUnshieldEvents.add(key);
  const stored = getProcessedEventsFromStorage();
  stored.add(key);
  saveProcessedEventsToStorage(stored);
}

/**
 * Start monitoring for incoming unshield transactions
 */
export function startUnshieldMonitoring(
  poolAddress: string,
  recipientAddress: string, // Connected wallet address to monitor
  onUnshield: (unshield: UnshieldEvent) => void
): void {
  // Always update the callback
  onUnshieldCallback = onUnshield;
  
  // Load processed events from localStorage on startup
  const storedProcessed = getProcessedEventsFromStorage();
  storedProcessed.forEach(key => processedUnshieldEvents.add(key));
  
  if (scanInterval) {
    console.log('[UnshieldMonitoring] Already running, callback updated. Triggering immediate scan...');
    // Trigger immediate scan even if already running
    scanForUnshieldEvents(poolAddress, recipientAddress).catch(err => {
      console.error('[UnshieldMonitoring] Immediate scan error:', err);
    });
    return;
  }
  
  console.log('[UnshieldMonitoring] Starting monitoring for incoming unshield transactions...');
  
  // Start polling
  scanInterval = setInterval(async () => {
    try {
      await scanForUnshieldEvents(poolAddress, recipientAddress);
    } catch (error) {
      console.error('[UnshieldMonitoring] Scan error:', error);
    }
  }, POLL_INTERVAL_MS);
  
  // Do initial scan immediately
  scanForUnshieldEvents(poolAddress, recipientAddress);
}

/**
 * Stop monitoring
 */
export function stopUnshieldMonitoring(): void {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    console.log('[UnshieldMonitoring] Stopped');
  }
}

/**
 * Check if monitoring is running
 */
export function isUnshieldMonitoringRunning(): boolean {
  return scanInterval !== null;
}

/**
 * Fetch current block number
 */
async function getCurrentBlock(): Promise<number> {
  try {
    const rpcUrl = getPrivacyRpcUrl();
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
    });
    
    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    
    return parseInt(data.result, 16);
  } catch (error: any) {
    console.warn('[UnshieldMonitoring] Failed to fetch current block:', error.message || error);
    throw error;
  }
}

/**
 * Scan for new Unshield events
 */
async function scanForUnshieldEvents(
  poolAddress: string,
  recipientAddress: string
): Promise<void> {
  if (isScanning) return;
  isScanning = true;
  
  try {
    // Get current block
    const currentBlock = await getCurrentBlock();
    
    // Calculate from block (scan last 1000 blocks or from last scanned)
    let fromBlock = lastScannedBlock > 0 
      ? lastScannedBlock + 1 
      : Math.max(0, currentBlock - 1000);
    
    // SECURITY: Validate block range to prevent DoS attacks
    const MAX_BLOCK_RANGE = 10000; // Reasonable limit (prevents excessive RPC queries)
    if (currentBlock - fromBlock > MAX_BLOCK_RANGE) {
      console.warn(`[UnshieldMonitoring] Block range too large (${currentBlock - fromBlock} blocks), capping at ${MAX_BLOCK_RANGE}`);
      fromBlock = currentBlock - MAX_BLOCK_RANGE;
    }
    
    if (fromBlock > currentBlock) {
      isScanning = false;
      return;
    }
    
    console.log(`[UnshieldMonitoring] Scanning blocks ${fromBlock} to ${currentBlock}...`);
    
    // Fetch Unshield events filtered by recipient address
    const events = await fetchUnshieldEvents(poolAddress, recipientAddress, fromBlock, currentBlock);
    
    if (events.length > 0) {
      console.log(`[UnshieldMonitoring] Found ${events.length} unshield event(s) to recipient ${recipientAddress.slice(0, 10)}...`);
    }
    
    // Process each event
    for (const event of events) {
      await processUnshieldEvent(event);
    }
    
    // Update last scanned block
    lastScannedBlock = currentBlock;
    
  } catch (error: any) {
    // Handle network errors gracefully - don't break the monitoring service
    console.warn('[UnshieldMonitoring] Scan failed (will retry on next poll):', error.message || error);
    // Don't update lastScannedBlock on error - will retry same range on next poll
  } finally {
    isScanning = false;
  }
}

/**
 * Fetch Unshield events from the pool, filtered by recipient address
 * SECURITY: Includes rate limiting and block range validation
 */
async function fetchUnshieldEvents(
  poolAddress: string,
  recipientAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<UnshieldEvent[]> {
  try {
    // SECURITY: Rate limiting to prevent RPC spam
    const now = Date.now();
    if (now - lastQueryTime < MIN_QUERY_INTERVAL_MS) {
      console.warn(`[UnshieldMonitoring] Rate limit: skipping query (last query ${now - lastQueryTime}ms ago)`);
      return [];
    }
    lastQueryTime = now;
    
    // SECURITY: Validate block range to prevent DoS attacks
    const blockRange = toBlock - fromBlock;
    const MAX_BLOCK_RANGE = 10000; // Reasonable limit
    if (blockRange > MAX_BLOCK_RANGE) {
      console.warn(`[UnshieldMonitoring] Block range too large (${blockRange} blocks), capping at ${MAX_BLOCK_RANGE}`);
      fromBlock = toBlock - MAX_BLOCK_RANGE;
    }
    
    if (fromBlock < 0 || toBlock < fromBlock) {
      console.error(`[UnshieldMonitoring] Invalid block range: ${fromBlock} to ${toBlock}`);
      return [];
    }
    
    const rpcUrl = getPrivacyRpcUrl();
    
    // SECURITY: Validate recipient address format before using in query
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      console.error(`[UnshieldMonitoring] Invalid recipient address format: ${recipientAddress}`);
      throw new Error(`Invalid recipient address: ${recipientAddress}`);
    }
    
    // Convert recipient address to topic (indexed parameter)
    // Topic format: left-padded to 32 bytes (64 hex chars)
    const recipientTopic = '0x' + recipientAddress.slice(2).toLowerCase().padStart(64, '0');
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getLogs',
        params: [{
          address: poolAddress,
          topics: [
            UNSHIELD_EVENT_TOPIC_V3, // Event signature (V3)
            null, // nullifierHash (any)
            recipientTopic, // recipient (filtered to our address) - CRITICAL: This ensures we only get events to our wallet
            null, // token (any)
          ],
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: '0x' + toBlock.toString(16),
        }],
      }),
    });
    
    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.error) {
      console.warn('[UnshieldMonitoring] RPC error:', data.error);
      return [];
    }
    
    const logs = data.result || [];
    
    // Parse Unshield events
    // Unshield event: (nullifierHash indexed, recipient indexed, token indexed, amount, relayer, fee, timestamp)
    // Topics: [eventSig, nullifierHash, recipient, token]
    // Data: [amount, relayer, fee, timestamp] (ABI encoded)
    const events: UnshieldEvent[] = [];
    
    for (const log of logs) {
      try {
        // SECURITY: Strict event validation - verify event structure matches expected format
        // Topics: [eventSig, nullifierHash, recipient, token]
        if (log.topics.length < 4) {
          console.warn('[UnshieldMonitoring] Invalid event: missing topics');
          continue;
        }
        
        // SECURITY: Validate event signature matches expected Unshield event
        if (log.topics[0] !== UNSHIELD_EVENT_TOPIC_V3) {
          console.warn('[UnshieldMonitoring] Invalid event: wrong event signature');
          continue;
        }
        
        // SECURITY: Validate nullifier hash format (64 hex chars = 32 bytes)
        const nullifierHash = log.topics[1];
        if (!/^0x[a-fA-F0-9]{64}$/.test(nullifierHash)) {
          console.warn('[UnshieldMonitoring] Invalid nullifier hash format:', nullifierHash);
          continue;
        }
        
        // SECURITY: Validate recipient address format
        const recipient = '0x' + log.topics[2].slice(-40); // Extract address from topic
        if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
          console.warn('[UnshieldMonitoring] Invalid recipient address format:', recipient);
          continue;
        }
        
        // SECURITY: Validate token address format
        const token = '0x' + log.topics[3].slice(-40); // Extract address from topic
        if (!/^0x[a-fA-F0-9]{40}$/.test(token)) {
          console.warn('[UnshieldMonitoring] Invalid token address format:', token);
          continue;
        }
        
        // SECURITY: Verify event is from the correct contract address
        if (log.address.toLowerCase() !== poolAddress.toLowerCase()) {
          console.warn(`[UnshieldMonitoring] Event from wrong contract: ${log.address} (expected ${poolAddress})`);
          continue;
        }
        
        // Parse data (amount, changeCommitment (V3), relayer, fee, timestamp)
        // V3: uint256 amount, bytes32 changeCommitment, address relayer, uint256 fee, uint256 timestamp
        // V2: uint256 amount, address relayer, uint256 fee, uint256 timestamp
        // We'll try to detect version by data length
        const data = log.data.slice(2); // Remove 0x
        
        // V3 has changeCommitment (32 bytes = 64 hex chars), V2 doesn't
        // V3 total: 64 (amount) + 64 (changeCommitment) + 64 (relayer) + 64 (fee) + 64 (timestamp) = 320 chars
        // V2 total: 64 (amount) + 64 (relayer) + 64 (fee) + 64 (timestamp) = 256 chars
        const isV3 = data.length >= 320;
        
        let amountHex: string;
        let relayerHex: string;
        let feeHex: string;
        let timestampHex: string;
        
        if (isV3) {
          // V3 format: amount, changeCommitment, relayer, fee, timestamp
          amountHex = data.slice(0, 64);
          // Skip changeCommitment (64 chars)
          relayerHex = data.slice(128, 192);
          feeHex = data.slice(192, 256);
          timestampHex = data.slice(256, 320);
        } else {
          // V2 format: amount, relayer, fee, timestamp
          amountHex = data.slice(0, 64);
          relayerHex = data.slice(64, 128);
          feeHex = data.slice(128, 192);
          timestampHex = data.slice(192, 256);
        }
        
        const amount = BigInt('0x' + amountHex);
        const relayer = '0x' + relayerHex.slice(-40);
        const fee = BigInt('0x' + feeHex);
        const timestamp = parseInt(timestampHex, 16);
        
        // SECURITY: Validate fee doesn't exceed amount (would result in negative amount received)
        if (fee > amount) {
          console.error(`[UnshieldMonitoring] Invalid unshield event: fee (${fee}) exceeds amount (${amount}), skipping`);
          continue;
        }
        
        // SECURITY: Warn on unusually high fees (potential front-running or manipulation)
        const MAX_REASONABLE_FEE = BigInt(10) ** BigInt(18); // 1 token (as heuristic)
        if (fee > MAX_REASONABLE_FEE) {
          console.warn(`[UnshieldMonitoring] Unusually high fee detected: ${fee} (amount: ${amount})`);
        }
        
        // Get token symbol from address
        const tokenSymbol = getTokenSymbolFromAddress(token);
        
        events.push({
          nullifierHash,
          recipient,
          token,
          tokenSymbol,
          amount,
          relayer,
          fee,
          timestamp,
          blockNumber: parseInt(log.blockNumber, 16),
          txHash: log.transactionHash,
        });
      } catch (e) {
        console.warn('[UnshieldMonitoring] Failed to parse event:', e);
      }
    }
    
    return events;
  } catch (error: any) {
    console.warn('[UnshieldMonitoring] Failed to fetch unshield events:', error.message || error);
    return [];
  }
}

/**
 * Process an unshield event
 * SECURITY: Marked as processed BEFORE callback to prevent race conditions
 * If callback is called twice for same event, second call will be skipped
 */
async function processUnshieldEvent(event: UnshieldEvent): Promise<void> {
  // CRITICAL: Check if we've already processed this unshield event
  // This prevents duplicate processing if multiple scans discover the same event
  if (isUnshieldEventProcessed(event.txHash, event.nullifierHash)) {
    console.log(`[UnshieldMonitoring] Unshield event ${event.txHash.slice(0, 10)}... already processed, skipping`);
    return;
  }
  
  // SECURITY: Mark as processed BEFORE calling callback (prevents race conditions)
  // If two async operations try to process the same event, only the first will proceed
  // The check above and this mark create an atomic operation (as atomic as JavaScript allows)
  markUnshieldEventProcessed(event.txHash, event.nullifierHash);
  
  console.log(`[UnshieldMonitoring] 🎉 Discovered incoming unshield! ${Number(event.amount) / 1e18} tokens to ${event.recipient.slice(0, 10)}...`);
  
  // Trigger callback
  // NOTE: If callback is slow and event is discovered again, the check above will prevent duplicate processing
  onUnshieldCallback?.(event);
}

/**
 * Force an immediate scan (useful after wallet connection)
 */
export async function forceUnshieldScan(
  poolAddress: string,
  recipientAddress: string
): Promise<UnshieldEvent[]> {
  const discoveredEvents: UnshieldEvent[] = [];
  const originalCallback = onUnshieldCallback;
  
  // Temporarily capture discovered events
  onUnshieldCallback = (event) => {
    discoveredEvents.push(event);
    originalCallback?.(event);
  };
  
  // Get current block and scan last 100 blocks
  const currentBlock = await getCurrentBlock();
  const fromBlock = Math.max(0, currentBlock - 100);
  
  const events = await fetchUnshieldEvents(poolAddress, recipientAddress, fromBlock, currentBlock);
  
  for (const event of events) {
    await processUnshieldEvent(event);
  }
  
  onUnshieldCallback = originalCallback;
  return discoveredEvents;
}
