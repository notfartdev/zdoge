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

// Configuration
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds for faster auto-discovery
const RPC_URL = 'https://rpc.testnet.dogeos.com';

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
    const fromBlock = lastScannedBlock > 0 
      ? lastScannedBlock + 1 
      : Math.max(0, currentBlock - 1000);

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

  } finally {
    isScanning = false;
  }
}

/**
 * Fetch current block number
 */
async function getCurrentBlock(): Promise<number> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: [],
    }),
  });

  const data = await response.json();
  return parseInt(data.result, 16);
}

/**
 * Fetch Transfer events from the pool
 */
async function fetchTransferEvents(
  poolAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<TransferEvent[]> {
  const response = await fetch(RPC_URL, {
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

  const data = await response.json();
  if (data.error) {
    console.error('[AutoDiscovery] RPC error:', data.error);
    return [];
  }

  const logs = data.result || [];
  
  // Parse Transfer events
  // Transfer event: (nullifierHash indexed, leafIndex1 indexed, leafIndex2 indexed, ...)
  const events: TransferEvent[] = [];
  
  for (const log of logs) {
    try {
      // Topics: [eventSig, nullifierHash, leafIndex1, leafIndex2]
      if (log.topics.length < 4) continue;

      const nullifierHash = log.topics[1];
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
      console.log(`[AutoDiscovery] 🎉 Discovered incoming transfer! ${Number(note.amount) / 1e18} ${note.token || 'DOGE'}`);
      // Add to both local and global commitments set
      existingCommitments.add(note.commitment.toString());
      globalCommitments.add(note.commitment.toString());
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
      console.log(`[AutoDiscovery] Discovered change note: ${Number(note.amount) / 1e18} ${note.token || 'DOGE'}`);
      // Add to both local and global commitments set
      existingCommitments.add(note.commitment.toString());
      globalCommitments.add(note.commitment.toString());
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

