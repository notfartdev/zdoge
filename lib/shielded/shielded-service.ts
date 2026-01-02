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

// Storage keys
const IDENTITY_STORAGE_KEY = 'dogenado_shielded_identity';
const NOTES_STORAGE_KEY = 'dogenado_shielded_notes';

/**
 * Shielded wallet state
 */
export interface ShieldedWalletState {
  identity: ShieldedIdentity | null;
  notes: ShieldedNote[];
  isInitialized: boolean;
}

// In-memory state
let walletState: ShieldedWalletState = {
  identity: null,
  notes: [],
  isInitialized: false,
};

/**
 * Initialize shielded wallet
 * Loads existing identity or creates a new one
 */
export async function initializeShieldedWallet(): Promise<ShieldedIdentity> {
  // Try to load existing identity
  const storedIdentity = loadIdentityFromStorage();
  
  if (storedIdentity) {
    walletState.identity = storedIdentity;
    walletState.notes = loadNotesFromStorage();
    walletState.isInitialized = true;
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

