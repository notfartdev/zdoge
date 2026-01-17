/**
 * Auto-Discovery Service for Shielded Transfers
 * 
 * Automatically scans for incoming shielded transfers and updates balances.
 * 
 * How it works:
 * 1. Polls Transfer events from the ShieldedPool contract
 * 2. Tries to decrypt each encrypted memo with user's viewing key
 * 3. If decryption succeeds → the note belongs to us
 * 4. Automatically adds discovered notes to wallet
 * 5. Triggers UI update with notification
 */

import { ShieldedNote } from './shielded-note';
import { ShieldedIdentity } from './shielded-address';
import { parseMemoFromContract, tryDecryptMemo } from './shielded-receiving';
import { createNoteWithRandomness } from './shielded-note';
import { mimcHash2 } from './shielded-crypto';
import { getPrivacyRpcUrl } from './privacy-utils';

// Configuration
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds for faster auto-discovery

// Transfer event signature: Transfer(bytes32,bytes32,bytes32,uint256,uint256,bytes,bytes,uint256)
// We'll fetch all events and filter by topic count
const TRANSFER_EVENT_TOPIC = '0xc04b6b3901a13e218d50c78452e5f79a4dc3f7ba86d15155ccc461534f1bc014';

// State
let isScanning = false;
let lastScannedBlock = 0;
let scanInterval: NodeJS.Timeout | null = null;
let onNewNoteCallback: ((note: ShieldedNote, txHash?: string) => void) | null = null;

interface TransferEvent {
  nullifierHash: string;
  outputCommitment1: string;
  outputCommitment2: string;
  leafIndex1: number;
  leafIndex2: number;
  encryptedMemo1: string;
  encryptedMemo2: string;
  blockNumber: number;
  txHash: string;
}

/**
 * Start auto-discovery scanning
 */
// Global set to track all discovered commitments (updated dynamically)
let globalCommitments = new Set<string>();

export function startAutoDiscovery(
  poolAddress: string,
  identity: ShieldedIdentity,
  existingNotes: ShieldedNote[],
  onNewNote: (note: ShieldedNote, txHash?: string) => void
): void {
  // Always update the callback, even if already running
  // This ensures the latest callback is always registered
  onNewNoteCallback = onNewNote;
  
  // Load processed events from localStorage on startup
  const storedProcessed = getProcessedEventsFromStorage();
  storedProcessed.forEach(key => processedTransferEvents.add(key));
  
  // Update global commitments set with current notes
  existingNotes.forEach(n => {
    globalCommitments.add(n.commitment.toString());
  });

  if (scanInterval) {
    console.log('[AutoDiscovery] Already running, callback updated. Triggering immediate scan...');
    // Trigger immediate scan even if already running to catch latest transfers
    scanForNewTransfers(poolAddress, identity, globalCommitments).catch(err => {
      console.error('[AutoDiscovery] Immediate scan error:', err);
    });
    return;
  }

  console.log('[AutoDiscovery] Starting auto-discovery for incoming transfers...');

  // Start polling
  scanInterval = setInterval(async () => {
    try {
      await scanForNewTransfers(poolAddress, identity, globalCommitments);
    } catch (error) {
      console.error('[AutoDiscovery] Scan error:', error);
    }
  }, POLL_INTERVAL_MS);

  // Do initial scan immediately
  scanForNewTransfers(poolAddress, identity, globalCommitments);
}

/**
 * Stop auto-discovery scanning
 */
export function stopAutoDiscovery(): void {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    console.log('[AutoDiscovery] Stopped');
  }
}

/**
 * Check if auto-discovery is running
 */
export function isAutoDiscoveryRunning(): boolean {
  return scanInterval !== null;
}

/**
 * Scan for new transfer events
 */
async function scanForNewTransfers(
  poolAddress: string,
  identity: ShieldedIdentity,
  existingCommitments: Set<string>
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
      console.warn(`[AutoDiscovery] Block range too large (${currentBlock - fromBlock} blocks), capping at ${MAX_BLOCK_RANGE}`);
      fromBlock = currentBlock - MAX_BLOCK_RANGE;
    }
    
    if (fromBlock > currentBlock) {
      isScanning = false;
      return;
    }

    console.log(`[AutoDiscovery] Scanning blocks ${fromBlock} to ${currentBlock}...`);

    // Fetch Transfer events
    const events = await fetchTransferEvents(poolAddress, fromBlock, currentBlock);
    
    if (events.length > 0) {
      console.log(`[AutoDiscovery] Found ${events.length} transfer events to check`);
    }

    // Try to decrypt each event's memos
    for (const event of events) {
      await tryDiscoverNote(event, identity, existingCommitments);
    }

    // Update last scanned block
    lastScannedBlock = currentBlock;

  } catch (error: any) {
    // Handle network errors gracefully - don't break the scanning service
    console.warn('[AutoDiscovery] Scan failed (will retry on next poll):', error.message || error);
    // Don't update lastScannedBlock on error - will retry same range on next poll
  } finally {
    isScanning = false;
  }
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
    console.warn('[AutoDiscovery] Failed to fetch current block:', error.message || error);
    // Return a fallback block number (current block - 1) to allow scanning to continue
    // This prevents the service from completely breaking on network errors
    throw error; // Re-throw so caller can handle it
  }
}

/**
 * Fetch Transfer events from the pool
 * SECURITY: Includes block range validation and event signature validation
 */
async function fetchTransferEvents(
  poolAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<TransferEvent[]> {
  try {
    // SECURITY: Validate block range to prevent DoS attacks
    const blockRange = toBlock - fromBlock;
    const MAX_BLOCK_RANGE = 10000; // Reasonable limit
    if (blockRange > MAX_BLOCK_RANGE) {
      console.warn(`[AutoDiscovery] Block range too large (${blockRange} blocks), capping at ${MAX_BLOCK_RANGE}`);
      fromBlock = toBlock - MAX_BLOCK_RANGE;
    }
    
    if (fromBlock < 0 || toBlock < fromBlock) {
      console.error(`[AutoDiscovery] Invalid block range: ${fromBlock} to ${toBlock}`);
      return [];
    }
    
    const rpcUrl = getPrivacyRpcUrl();
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getLogs',
        params: [{
          address: poolAddress,
          topics: [TRANSFER_EVENT_TOPIC],
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
      console.warn('[AutoDiscovery] RPC error:', data.error);
      return [];
    }

  const logs = data.result || [];
  
  // Parse Transfer events
  // Transfer event: (nullifierHash indexed, leafIndex1 indexed, leafIndex2 indexed, ...)
  const events: TransferEvent[] = [];
  
  for (const log of logs) {
    try {
      // SECURITY: Strict event validation - verify event structure matches expected format
      // Topics: [eventSig, nullifierHash, leafIndex1, leafIndex2]
      if (log.topics.length < 4) {
        console.warn('[AutoDiscovery] Invalid event: missing topics');
        continue;
      }
      
      // SECURITY: Validate event signature matches expected Transfer event
      if (log.topics[0] !== TRANSFER_EVENT_TOPIC) {
        console.warn('[AutoDiscovery] Invalid event: wrong event signature');
        continue;
      }
      
      // SECURITY: Validate nullifier hash format (64 hex chars = 32 bytes)
      const nullifierHash = log.topics[1];
      if (!/^0x[a-fA-F0-9]{64}$/.test(nullifierHash)) {
        console.warn('[AutoDiscovery] Invalid nullifier hash format:', nullifierHash);
        continue;
      }
      
      // SECURITY: Verify event is from the correct contract address
      if (log.address.toLowerCase() !== poolAddress.toLowerCase()) {
        console.warn(`[AutoDiscovery] Event from wrong contract: ${log.address} (expected ${poolAddress})`);
        continue;
      }
      
      const leafIndex1 = parseInt(log.topics[2], 16);
      const leafIndex2 = parseInt(log.topics[3], 16);

      // Data contains: outputCommitment1, outputCommitment2, encryptedMemo1, encryptedMemo2, timestamp
      // This is ABI encoded, let's parse it
      const data = log.data.slice(2); // Remove 0x
      
      // Each bytes32 is 64 hex chars, bytes are variable length with offset
      // For simplicity, let's try to extract the memos from the raw data
      // The data layout is complex due to dynamic bytes arrays
      
      // outputCommitment1: first 32 bytes (64 hex)
      const outputCommitment1 = '0x' + data.slice(0, 64);
      // outputCommitment2: next 32 bytes
      const outputCommitment2 = '0x' + data.slice(64, 128);
      
      // The rest contains offsets and dynamic data for memos
      // For now, try to extract raw hex - this needs proper ABI decoding
      // The memos start after the fixed fields
      
      // Simplified: Try to find JSON-like structures in the data
      const encryptedMemo1 = extractMemoFromData(data, 128);
      const encryptedMemo2 = extractMemoFromData(data, 128 + 256); // Rough estimate

      events.push({
        nullifierHash,
        outputCommitment1,
        outputCommitment2,
        leafIndex1,
        leafIndex2,
        encryptedMemo1,
        encryptedMemo2,
        blockNumber: parseInt(log.blockNumber, 16),
        txHash: log.transactionHash,
      });
    } catch (e) {
      console.warn('[AutoDiscovery] Failed to parse event:', e);
    }
  }

  return events;
  } catch (error: any) {
    console.warn('[AutoDiscovery] Failed to fetch transfer events:', error.message || error);
    // Return empty array on error - allows scanning to continue on next poll
    return [];
  }
}

/**
 * Extract memo from raw event data
 * This is a simplified extraction - proper ABI decoding would be more robust
 */
function extractMemoFromData(data: string, startOffset: number): string {
  try {
    // Look for JSON-like structure (starts with 7b = '{')
    const searchStart = startOffset;
    const hexData = data.slice(searchStart);
    
    // Find start of JSON (7b = '{')
    const jsonStartIndex = hexData.indexOf('7b');
    if (jsonStartIndex === -1) return '';

    // Extract until we find the closing brace pattern
    // This is approximate - proper ABI decoding needed for production
    let bracketCount = 0;
    let endIndex = jsonStartIndex;
    
    for (let i = jsonStartIndex; i < hexData.length - 1; i += 2) {
      const byte = parseInt(hexData.slice(i, i + 2), 16);
      if (byte === 0x7b) bracketCount++; // '{'
      if (byte === 0x7d) bracketCount--; // '}'
      if (bracketCount === 0 && byte === 0x7d) {
        endIndex = i + 2;
        break;
      }
    }

    const memoHex = hexData.slice(jsonStartIndex, endIndex);
    return '0x' + memoHex;
  } catch {
    return '';
  }
}

// Track processed transfer events to prevent re-processing even if note was spent
// Key format: `${txHash}:${commitment}`
const processedTransferEvents = new Set<string>();

/**
 * Get processed events from localStorage (persists across refreshes)
 */
function getProcessedEventsFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem('shielded_processed_transfers');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
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
    localStorage.setItem('shielded_processed_transfers', JSON.stringify(toStore));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if a transfer event has already been processed
 */
function isTransferEventProcessed(txHash: string, commitment: string): boolean {
  const key = `${txHash}:${commitment}`;
  const stored = getProcessedEventsFromStorage();
  return processedTransferEvents.has(key) || stored.has(key);
}

/**
 * Mark a transfer event as processed
 */
function markTransferEventProcessed(txHash: string, commitment: string): void {
  const key = `${txHash}:${commitment}`;
  processedTransferEvents.add(key);
  const stored = getProcessedEventsFromStorage();
  stored.add(key);
  saveProcessedEventsToStorage(stored);
}

/**
 * Try to discover if a note belongs to us
 */
async function tryDiscoverNote(
  event: TransferEvent,
  identity: ShieldedIdentity,
  existingCommitments: Set<string>
): Promise<void> {
  // Try memo 1 (recipient's note)
  if (event.encryptedMemo1) {
    const note = await tryDecryptAndVerify(
      event.encryptedMemo1,
      event.leafIndex1,
      event.outputCommitment1,
      identity,
      existingCommitments
    );
    
    if (note) {
      // CRITICAL: Check if we've already processed this transfer event
      // This prevents re-adding notes that were spent and removed from wallet
      const commitmentStr = note.commitment.toString();
      if (isTransferEventProcessed(event.txHash, commitmentStr)) {
        console.log(`[AutoDiscovery] Transfer event ${event.txHash.slice(0, 10)}... already processed for commitment ${commitmentStr.slice(0, 16)}..., skipping`);
        return;
      }
      
      console.log(`[AutoDiscovery] 🎉 Discovered incoming transfer! ${Number(note.amount) / 1e18} ${note.token || 'DOGE'}`);
      // Mark as processed BEFORE calling callback (prevents race conditions)
      markTransferEventProcessed(event.txHash, commitmentStr);
      // Add to both local and global commitments set
      existingCommitments.add(commitmentStr);
      globalCommitments.add(commitmentStr);
      onNewNoteCallback?.(note, event.txHash);
    }
  }

  // Try memo 2 (change note - if we're the sender)
  if (event.encryptedMemo2) {
    const note = await tryDecryptAndVerify(
      event.encryptedMemo2,
      event.leafIndex2,
      event.outputCommitment2,
      identity,
      existingCommitments
    );

    if (note) {
      // CRITICAL: Check if we've already processed this transfer event
      const commitmentStr = note.commitment.toString();
      if (isTransferEventProcessed(event.txHash, commitmentStr)) {
        console.log(`[AutoDiscovery] Transfer event ${event.txHash.slice(0, 10)}... already processed for change note ${commitmentStr.slice(0, 16)}..., skipping`);
        return;
      }
      
      console.log(`[AutoDiscovery] Discovered change note: ${Number(note.amount) / 1e18} ${note.token || 'DOGE'}`);
      // Mark as processed BEFORE calling callback
      markTransferEventProcessed(event.txHash, commitmentStr);
      // Add to both local and global commitments set
      existingCommitments.add(commitmentStr);
      globalCommitments.add(commitmentStr);
      onNewNoteCallback?.(note, event.txHash);
    }
  }
}

/**
 * Try to decrypt memo and verify commitment matches
 */
async function tryDecryptAndVerify(
  memoHex: string,
  leafIndex: number,
  expectedCommitment: string,
  identity: ShieldedIdentity,
  existingCommitments: Set<string>
): Promise<ShieldedNote | null> {
  try {
    // Parse memo
    const memo = parseMemoFromContract(memoHex);
    if (!memo) return null;

    // Try to decrypt
    const note = await tryDecryptMemo(memo, identity);
    if (!note) return null;

    // Check if we already have this note
    if (existingCommitments.has(note.commitment.toString())) {
      return null;
    }

    // Verify commitment matches what's on-chain
    const expectedCommitmentBigInt = BigInt(expectedCommitment);
    if (note.commitment !== expectedCommitmentBigInt) {
      console.warn('[AutoDiscovery] Commitment mismatch, skipping');
      return null;
    }

    // Set leaf index
    note.leafIndex = leafIndex;

    return note;
  } catch (e) {
    // Decryption failed - not our note
    return null;
  }
}

/**
 * Force an immediate scan (useful after sending)
 */
export async function forceScan(
  poolAddress: string,
  identity: ShieldedIdentity,
  existingNotes: ShieldedNote[]
): Promise<ShieldedNote[]> {
  const existingCommitments = new Set(
    existingNotes.map(n => n.commitment.toString())
  );
  
  const discoveredNotes: ShieldedNote[] = [];
  const originalCallback = onNewNoteCallback;
  
  // Temporarily capture discovered notes
  onNewNoteCallback = (note, txHash) => {
    discoveredNotes.push(note);
    originalCallback?.(note, txHash);
  };

  // Get current block and scan last 100 blocks
  const currentBlock = await getCurrentBlock();
  const fromBlock = Math.max(0, currentBlock - 100);
  
  const events = await fetchTransferEvents(poolAddress, fromBlock, currentBlock);
  
  for (const event of events) {
    await tryDiscoverNote(event, identity, existingCommitments);
  }

  onNewNoteCallback = originalCallback;
  return discoveredNotes;
}

