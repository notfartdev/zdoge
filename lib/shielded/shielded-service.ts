/**
 * Shielded Transaction Service
 * 
 * High-level API for shielded operations:
 * - Shield: Deposit public DOGE into shielded note
 * - Transfer: Send shielded DOGE to another shielded address
 * - Unshield: Withdraw shielded DOGE to public address
 */

import { 
  ShieldedIdentity, 
  generateShieldedIdentity,
  parseShieldedAddress,
  serializeIdentity,
  deserializeIdentity,
  exportSpendingKey,
  importSpendingKey,
} from './shielded-address';
import {
  ShieldedNote,
  createNote,
  serializeNote,
  deserializeNote,
  noteToShareableString,
  noteFromShareableString,
  parseAmountToWei,
  formatWeiToAmount,
  getCommitmentBytes,
} from './shielded-note';
import {
  generateTransferProof,
  generateUnshieldProof,
  fetchMerklePath,
} from './shielded-proof-service';
import { toBytes32 } from './shielded-crypto';
import {
  encryptNoteForRecipient,
  tryDecryptMemo,
  formatMemoForContract,
  parseMemoFromContract,
  EncryptedMemo,
} from './shielded-receiving';
import {
  StealthKeys,
  StealthMetaAddress,
  generateStealthKeys,
  encodeMetaAddress,
  decodeMetaAddress,
  generateStealthAddress,
  scanStealthTransfer,
} from './stealth-address';

// Storage keys
const IDENTITY_STORAGE_KEY = 'dogenado_shielded_identity';
const NOTES_STORAGE_KEY = 'dogenado_shielded_notes';
const STEALTH_KEYS_STORAGE_KEY = 'dogenado_stealth_keys';

/**
 * Shielded wallet state
 */
export interface ShieldedWalletState {
  identity: ShieldedIdentity | null;
  notes: ShieldedNote[];
  stealthKeys: StealthKeys | null;
  isInitialized: boolean;
}

// In-memory state
let walletState: ShieldedWalletState = {
  identity: null,
  notes: [],
  stealthKeys: null,
  isInitialized: false,
};

// Default pool address - imported at runtime
const DEFAULT_POOL_ADDRESS = '0x6d237c2ed7036bf2F2006BcA6D3cA98E6E45b5f6';

/**
 * Initialize shielded wallet
 * Loads existing identity or creates a new one
 * Automatically syncs notes with on-chain data
 */
export async function initializeShieldedWallet(poolAddress?: string): Promise<ShieldedIdentity> {
  // Try to load existing identity
  const storedIdentity = loadIdentityFromStorage();
  
  if (storedIdentity) {
    walletState.identity = storedIdentity;
    walletState.notes = loadNotesFromStorage();
    walletState.isInitialized = true;
    
    // Auto-sync notes with chain if we have any
    if (walletState.notes.length > 0) {
      console.log('Auto-syncing notes with blockchain...');
      try {
        await syncNotesWithChain(poolAddress || DEFAULT_POOL_ADDRESS);
      } catch (error) {
        console.warn('Auto-sync failed, continuing with stored notes:', error);
      }
    }
    
    return storedIdentity;
  }
  
  // Create new identity
  const identity = await generateShieldedIdentity();
  saveIdentityToStorage(identity);
  
  walletState.identity = identity;
  walletState.notes = [];
  walletState.isInitialized = true;
  
  return identity;
}

/**
 * Get current wallet state
 */
export function getWalletState(): ShieldedWalletState {
  return { ...walletState };
}

/**
 * Get shielded identity
 */
export function getIdentity(): ShieldedIdentity | null {
  return walletState.identity;
}

/**
 * Get all notes owned by this wallet
 */
export function getNotes(): ShieldedNote[] {
  return [...walletState.notes];
}

/**
 * Get total shielded balance
 */
export function getShieldedBalance(): bigint {
  return walletState.notes.reduce((sum, note) => sum + note.amount, 0n);
}

/**
 * Shield DOGE (deposit into shielded pool)
 * 
 * @param amountDoge Amount in DOGE (e.g., 100)
 * @returns Note and commitment for contract call
 */
export async function prepareShield(
  amountDoge: number
): Promise<{
  note: ShieldedNote;
  commitment: `0x${string}`;
  amountWei: bigint;
}> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  const amountWei = parseAmountToWei(amountDoge);
  
  // Create note for ourselves
  const note = await createNote(
    amountWei,
    walletState.identity.shieldedAddress,
    'DOGE'
  );
  
  return {
    note,
    commitment: getCommitmentBytes(note),
    amountWei,
  };
}

/**
 * Complete shield after transaction confirmed
 * Saves the note with its leaf index
 */
export function completeShield(note: ShieldedNote, leafIndex: number): void {
  note.leafIndex = leafIndex;
  walletState.notes.push(note);
  saveNotesToStorage(walletState.notes);
}

/**
 * Prepare transfer to another shielded address
 * 
 * @param recipientAddress Recipient's shielded address string
 * @param amountDoge Amount to send in DOGE
 * @param noteIndex Index of note to spend (optional, auto-selects if not provided)
 * @param poolAddress Contract address
 * 
 * Returns encrypted memos so recipient can auto-discover the transfer
 */
export async function prepareTransfer(
  recipientAddress: string,
  amountDoge: number,
  poolAddress: string,
  noteIndex?: number,
  relayerAddress?: string,
  feeDoge: number = 0
): Promise<{
  proof: { proof: string[]; publicInputs: string[] };
  nullifierHash: `0x${string}`;
  outputCommitment1: `0x${string}`;
  outputCommitment2: `0x${string}`;
  recipientNote: ShieldedNote;
  changeNote: ShieldedNote;
  root: `0x${string}`;
  encryptedMemo1: `0x${string}`;  // For recipient to auto-discover
  encryptedMemo2: `0x${string}`;  // For sender's change
}> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  const amountWei = parseAmountToWei(amountDoge);
  const feeWei = parseAmountToWei(feeDoge);
  const recipientPubkey = parseShieldedAddress(recipientAddress);
  
  // Select note to spend
  let noteToSpend: ShieldedNote;
  if (noteIndex !== undefined) {
    noteToSpend = walletState.notes[noteIndex];
  } else {
    // Auto-select: find smallest note that covers amount + fee
    const requiredAmount = amountWei + feeWei;
    const candidates = walletState.notes
      .filter(n => n.amount >= requiredAmount && n.leafIndex !== undefined)
      .sort((a, b) => Number(a.amount - b.amount));
    
    if (candidates.length === 0) {
      throw new Error('No note with sufficient balance');
    }
    noteToSpend = candidates[0];
  }
  
  if (noteToSpend.leafIndex === undefined) {
    throw new Error('Note has no leaf index');
  }
  
  // Generate proof
  const { proof, outputNote1, outputNote2, nullifierHash } = await generateTransferProof(
    noteToSpend,
    walletState.identity,
    recipientPubkey,
    amountWei,
    poolAddress,
    relayerAddress || '0x0000000000000000000000000000000000000000',
    feeWei
  );
  
  // Fetch root for return
  const { root } = await fetchMerklePath(poolAddress, noteToSpend.leafIndex);
  
  // Encrypt note details for recipient (enables auto-discovery)
  const encryptedMemo1 = await encryptNoteForRecipient(outputNote1, recipientPubkey);
  
  // Encrypt change note for ourselves
  const encryptedMemo2 = await encryptNoteForRecipient(outputNote2, walletState.identity!.shieldedAddress);
  
  return {
    proof,
    nullifierHash: toBytes32(nullifierHash),
    outputCommitment1: toBytes32(outputNote1.commitment),
    outputCommitment2: toBytes32(outputNote2.commitment),
    recipientNote: outputNote1,
    changeNote: outputNote2,
    root: toBytes32(root),
    encryptedMemo1: formatMemoForContract(encryptedMemo1),
    encryptedMemo2: formatMemoForContract(encryptedMemo2),
  };
}

/**
 * Complete transfer after transaction confirmed
 * - Removes spent note
 * - Adds change note (if any)
 */
export function completeTransfer(
  spentNoteIndex: number,
  changeNote: ShieldedNote,
  changeLeafIndex: number
): void {
  // Remove spent note
  walletState.notes.splice(spentNoteIndex, 1);
  
  // Add change note if it has value
  if (changeNote.amount > 0n) {
    changeNote.leafIndex = changeLeafIndex;
    walletState.notes.push(changeNote);
  }
  
  saveNotesToStorage(walletState.notes);
}

/**
 * Prepare unshield (withdraw to public address)
 */
export async function prepareUnshield(
  recipientAddress: string,
  noteIndex: number,
  poolAddress: string,
  relayerAddress?: string,
  feeDoge: number = 0
): Promise<{
  proof: { proof: string[]; publicInputs: string[] };
  nullifierHash: `0x${string}`;
  amount: bigint;
  root: `0x${string}`;
}> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  const note = walletState.notes[noteIndex];
  if (!note || note.leafIndex === undefined) {
    throw new Error('Invalid note');
  }
  
  const feeWei = parseAmountToWei(feeDoge);
  const withdrawAmount = note.amount - feeWei;
  
  if (withdrawAmount <= 0n) {
    throw new Error('Fee exceeds note amount');
  }
  
  // Generate proof
  const { proof, nullifierHash, root } = await generateUnshieldProof(
    note,
    walletState.identity,
    recipientAddress,
    withdrawAmount,
    poolAddress,
    relayerAddress || '0x0000000000000000000000000000000000000000',
    feeWei
  );
  
  return {
    proof,
    nullifierHash: toBytes32(nullifierHash),
    amount: withdrawAmount,
    root: toBytes32(root),
  };
}

/**
 * Complete unshield after transaction confirmed
 * Removes the spent note
 */
export function completeUnshield(noteIndex: number): void {
  walletState.notes.splice(noteIndex, 1);
  saveNotesToStorage(walletState.notes);
}

/**
 * Scan for incoming transfers (auto-discovery)
 * 
 * This scans Transfer events and tries to decrypt the memos.
 * If decryption succeeds, the note belongs to us.
 * 
 * @param events Transfer events from contract
 * @returns Number of new notes discovered
 */
export async function scanForIncomingTransfers(
  events: Array<{
    nullifierHash: string;
    outputCommitment1: string;
    outputCommitment2: string;
    encryptedMemo1?: string;
    encryptedMemo2?: string;
    leafIndex1: number;
    leafIndex2: number;
  }>
): Promise<number> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  let discovered = 0;
  
  for (const event of events) {
    // Try memo 1 (recipient's note)
    if (event.encryptedMemo1) {
      const memo = parseMemoFromContract(event.encryptedMemo1);
      if (memo) {
        const note = await tryDecryptMemo(memo, walletState.identity);
        if (note) {
          // Check we don't already have this note
          const exists = walletState.notes.some(n => n.commitment === note.commitment);
          if (!exists) {
            note.leafIndex = event.leafIndex1;
            walletState.notes.push(note);
            discovered++;
          }
        }
      }
    }
    
    // Try memo 2 (change note - if we're the sender)
    if (event.encryptedMemo2) {
      const memo = parseMemoFromContract(event.encryptedMemo2);
      if (memo) {
        const note = await tryDecryptMemo(memo, walletState.identity);
        if (note) {
          const exists = walletState.notes.some(n => n.commitment === note.commitment);
          if (!exists) {
            note.leafIndex = event.leafIndex2;
            walletState.notes.push(note);
            discovered++;
          }
        }
      }
    }
  }
  
  if (discovered > 0) {
    saveNotesToStorage(walletState.notes);
  }
  
  return discovered;
}

/**
 * Import a note received from someone else (manual import)
 */
export async function importReceivedNote(shareableString: string): Promise<ShieldedNote> {
  const note = await noteFromShareableString(shareableString);
  
  // Verify we own this note
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  if (note.ownerPubkey !== walletState.identity.shieldedAddress) {
    throw new Error('This note is not addressed to you');
  }
  
  // Check if we already have this note
  const exists = walletState.notes.some(n => n.commitment === note.commitment);
  if (exists) {
    throw new Error('Note already imported');
  }
  
  walletState.notes.push(note);
  saveNotesToStorage(walletState.notes);
  
  return note;
}

/**
 * Export a note for sharing with recipient
 */
export function exportNoteForRecipient(note: ShieldedNote): string {
  return noteToShareableString(note);
}

/**
 * Backup wallet (export spending key)
 */
export function backupWallet(): string | null {
  if (!walletState.identity) return null;
  return exportSpendingKey(walletState.identity);
}

/**
 * Restore wallet from backup
 */
export async function restoreWallet(spendingKeyHex: string): Promise<ShieldedIdentity> {
  const identity = await importSpendingKey(spendingKeyHex);
  
  saveIdentityToStorage(identity);
  walletState.identity = identity;
  walletState.notes = [];
  walletState.isInitialized = true;
  
  return identity;
}

/**
 * Clear wallet (for testing)
 */
export function clearWallet(): void {
  walletState = {
    identity: null,
    notes: [],
    isInitialized: false,
  };
  
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(IDENTITY_STORAGE_KEY);
    localStorage.removeItem(NOTES_STORAGE_KEY);
  }
}

/**
 * Sync notes with on-chain data
 * Matches stored note commitments with on-chain commitments to fix leaf indices
 */
export async function syncNotesWithChain(poolAddress: string): Promise<{
  synced: number;
  notFound: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let synced = 0;
  let notFound = 0;
  
  if (walletState.notes.length === 0) {
    return { synced: 0, notFound: 0, errors: ['No notes to sync'] };
  }
  
  try {
    // Fetch all commitments from chain
    const RPC_URL = 'https://rpc.testnet.dogeos.com';
    
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getLogs',
        params: [{
          address: poolAddress,
          fromBlock: '0x0',
          toBlock: 'latest',
        }],
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    
    const logs = data.result || [];
    
    // Filter deposit-style events (3+ topics)
    const depositLogs = logs.filter((log: any) => 
      log.topics && log.topics.length >= 3
    );
    
    console.log(`Found ${depositLogs.length} deposits on chain`);
    
    // Build a map of commitment -> leafIndex
    const commitmentMap = new Map<string, number>();
    for (const log of depositLogs) {
      const commitment = log.topics[1].toLowerCase();
      const leafIndex = parseInt(log.topics[2], 16);
      // Only keep first occurrence (in case of duplicates)
      if (!commitmentMap.has(commitment)) {
        commitmentMap.set(commitment, leafIndex);
      }
    }
    
    console.log(`Unique commitments on chain: ${commitmentMap.size}`);
    
    // Debug: Print all on-chain commitments
    console.log('=== ON-CHAIN COMMITMENTS ===');
    commitmentMap.forEach((leafIndex, commitment) => {
      console.log(`  ${commitment} -> leafIndex: ${leafIndex}`);
    });
    
    // Match each stored note to on-chain data
    for (const note of walletState.notes) {
      // Convert note commitment to hex string for matching
      const noteCommitmentHex = '0x' + note.commitment.toString(16).padStart(64, '0').toLowerCase();
      
      console.log(`=== CHECKING NOTE ===`);
      console.log(`  Amount: ${Number(note.amount) / 1e18} DOGE`);
      console.log(`  Local commitment: ${noteCommitmentHex}`);
      console.log(`  Current leafIndex: ${note.leafIndex}`);
      
      const onChainLeafIndex = commitmentMap.get(noteCommitmentHex);
      
      if (onChainLeafIndex !== undefined) {
        if (note.leafIndex !== onChainLeafIndex) {
          console.log(`  ✅ MATCH FOUND! Fixing leafIndex: ${note.leafIndex} -> ${onChainLeafIndex}`);
          note.leafIndex = onChainLeafIndex;
          synced++;
        } else {
          console.log(`  ✅ Already correct, leafIndex=${note.leafIndex}`);
        }
      } else {
        console.warn(`  ❌ NOT FOUND ON CHAIN!`);
        console.log(`  Closest matches:`);
        // Find similar commitments for debugging
        const notePrefix = noteCommitmentHex.slice(0, 20);
        commitmentMap.forEach((idx, comm) => {
          if (comm.startsWith(notePrefix.slice(0, 10))) {
            console.log(`    ${comm} (leafIndex: ${idx})`);
          }
        });
        errors.push(`Note with amount ${Number(note.amount) / 1e18} DOGE not found on chain - commitment mismatch`);
        notFound++;
      }
    }
    
    // Save updated notes
    if (synced > 0) {
      saveNotesToStorage(walletState.notes);
    }
    
    return { synced, notFound, errors };
    
  } catch (error: any) {
    console.error('Sync error:', error);
    return { synced: 0, notFound: 0, errors: [error.message] };
  }
}

/**
 * Clear only notes (keep identity)
 */
export function clearNotes(): void {
  walletState.notes = [];
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(NOTES_STORAGE_KEY);
  }
}

// ============ Storage Helpers ============

function saveIdentityToStorage(identity: ShieldedIdentity): void {
  if (typeof localStorage === 'undefined') return;
  
  const serialized = serializeIdentity(identity);
  localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(serialized));
}

function loadIdentityFromStorage(): ShieldedIdentity | null {
  if (typeof localStorage === 'undefined') return null;
  
  const stored = localStorage.getItem(IDENTITY_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const serialized = JSON.parse(stored);
    return deserializeIdentity(serialized);
  } catch {
    return null;
  }
}

function saveNotesToStorage(notes: ShieldedNote[]): void {
  if (typeof localStorage === 'undefined') return;
  
  const serialized = notes.map(serializeNote);
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(serialized));
}

function loadNotesFromStorage(): ShieldedNote[] {
  if (typeof localStorage === 'undefined') return [];
  
  const stored = localStorage.getItem(NOTES_STORAGE_KEY);
  if (!stored) return [];
  
  try {
    const serialized = JSON.parse(stored);
    // Note: This is sync load, notes will be deserialized on first access
    return serialized.map((s: any) => ({
      amount: BigInt(s.amount),
      ownerPubkey: BigInt('0x' + s.ownerPubkey),
      secret: BigInt('0x' + s.secret),
      blinding: BigInt('0x' + s.blinding),
      commitment: BigInt('0x' + s.commitment),
      leafIndex: s.leafIndex,
      token: s.token,
      createdAt: s.createdAt,
    }));
  } catch {
    return [];
  }
}

// ============ Stealth Key Storage ============

function saveStealthKeysToStorage(keys: StealthKeys): void {
  if (typeof localStorage === 'undefined') return;
  
  const serialized = {
    spendingKey: keys.spendingKey.toString(16),
    viewingKey: keys.viewingKey.toString(16),
    spendingPubKey: keys.metaAddress.spendingPubKey.toString(16),
    viewingPubKey: keys.metaAddress.viewingPubKey.toString(16),
  };
  localStorage.setItem(STEALTH_KEYS_STORAGE_KEY, JSON.stringify(serialized));
}

function loadStealthKeysFromStorage(): StealthKeys | null {
  if (typeof localStorage === 'undefined') return null;
  
  const stored = localStorage.getItem(STEALTH_KEYS_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const s = JSON.parse(stored);
    return {
      spendingKey: BigInt('0x' + s.spendingKey),
      viewingKey: BigInt('0x' + s.viewingKey),
      metaAddress: {
        spendingPubKey: BigInt('0x' + s.spendingPubKey),
        viewingPubKey: BigInt('0x' + s.viewingPubKey),
      },
    };
  } catch {
    return null;
  }
}

// ============ Stealth Address API ============

/**
 * Initialize or load stealth keys
 * Derives from wallet signature for deterministic generation
 */
export async function initializeStealthKeys(walletAddress: string): Promise<StealthKeys> {
  // Try to load existing keys
  let keys = loadStealthKeysFromStorage();
  
  if (keys) {
    walletState.stealthKeys = keys;
    return keys;
  }
  
  // Generate new keys from wallet address + identity
  // In production, use a signature from the wallet for entropy
  const seed = `stealth:${walletAddress}:${walletState.identity?.spendingKey?.toString(16) || 'default'}`;
  keys = await generateStealthKeys(seed);
  
  // Save to storage
  saveStealthKeysToStorage(keys);
  walletState.stealthKeys = keys;
  
  console.log('[Stealth] Keys initialized');
  return keys;
}

/**
 * Get the current stealth meta-address for receiving
 * This is what users share to receive private payments
 */
export function getStealthReceiveAddress(): string | null {
  if (!walletState.stealthKeys) {
    return null;
  }
  return encodeMetaAddress(walletState.stealthKeys.metaAddress);
}

/**
 * Get stealth keys (for advanced operations)
 */
export function getStealthKeys(): StealthKeys | null {
  return walletState.stealthKeys;
}

/**
 * Generate a one-time stealth address for sending to a recipient
 * 
 * @param recipientMetaAddress - Recipient's stealth meta-address string
 * @param amount - Amount to send
 * @param token - Token type
 */
export async function createStealthPayment(
  recipientMetaAddress: string,
  amount: bigint,
  token: string = 'DOGE'
): Promise<{
  stealthAddress: string;
  ephemeralPubKey: bigint;
  encryptedData: string;
  viewTag: string;
} | null> {
  const metaAddress = decodeMetaAddress(recipientMetaAddress);
  if (!metaAddress) {
    console.error('Invalid stealth meta-address');
    return null;
  }
  
  // Generate random note parameters
  const { randomFieldElement } = await import('./shielded-crypto');
  const secret = await randomFieldElement();
  const blinding = await randomFieldElement();
  
  const result = await generateStealthAddress(metaAddress, {
    amount,
    token,
    secret,
    blinding,
  });
  
  return {
    stealthAddress: result.address,
    ephemeralPubKey: result.ephemeralPubKey,
    encryptedData: result.encryptedData,
    viewTag: result.viewTag,
  };
}

/**
 * Scan for incoming stealth transfers
 * Returns any transfers that belong to us
 */
export async function scanForStealthTransfers(
  transfers: Array<{
    ephemeralPubKey: bigint;
    viewTag: string;
    encryptedData: string;
  }>
): Promise<Array<{
  amount: bigint;
  token: string;
  secret: bigint;
  blinding: bigint;
}>> {
  if (!walletState.stealthKeys) {
    return [];
  }
  
  const found: Array<{
    amount: bigint;
    token: string;
    secret: bigint;
    blinding: bigint;
  }> = [];
  
  for (const transfer of transfers) {
    const result = await scanStealthTransfer(
      transfer.ephemeralPubKey,
      transfer.viewTag,
      transfer.encryptedData,
      walletState.stealthKeys
    );
    
    if (result) {
      found.push({
        amount: result.amount,
        token: result.token,
        secret: result.secret,
        blinding: result.blinding,
      });
    }
  }
  
  return found;
}

