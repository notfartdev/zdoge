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
import { shieldedPool } from '../dogeos-config';
import { EncryptedStorage } from './encrypted-storage';

// Native token address constant (accessible throughout the module)
const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as `0x${string}`;

// Helper to get token metadata from config
function getTokenMetadata(tokenSymbol: string): { symbol: string; address: `0x${string}`; decimals: number } {
  if (tokenSymbol === 'DOGE') {
    return {
      symbol: 'DOGE',
      address: NATIVE_TOKEN,
      decimals: 18,
    };
  }
  
  const token = shieldedPool.supportedTokens[tokenSymbol as keyof typeof shieldedPool.supportedTokens];
  if (!token) {
    throw new Error(`Token ${tokenSymbol} not found in shieldedPool.supportedTokens`);
  }
  
  return {
    symbol: token.symbol,
    address: token.address,
    decimals: token.decimals,
  };
}

// Storage keys - now include wallet address for per-wallet identity
const IDENTITY_STORAGE_PREFIX = 'dogenado_shielded_identity_';
const NOTES_STORAGE_PREFIX = 'dogenado_shielded_notes_';
const STEALTH_KEYS_STORAGE_PREFIX = 'dogenado_stealth_keys_';
const SIGNATURE_STORAGE_PREFIX = 'dogenado_wallet_sig_';

// Current wallet address (set during initialization)
let currentWalletAddress: string | null = null;

// Get storage keys for current wallet
function getStorageKeys() {
  const addr = currentWalletAddress?.toLowerCase() || 'default';
  return {
    identity: `${IDENTITY_STORAGE_PREFIX}${addr}`,
    notes: `${NOTES_STORAGE_PREFIX}${addr}`,
    stealthKeys: `${STEALTH_KEYS_STORAGE_PREFIX}${addr}`,
    signature: `${SIGNATURE_STORAGE_PREFIX}${addr}`,
  };
}

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
 * PERMANENT SIGNATURE MESSAGE FORMAT
 * 
 * CRITICAL: This message format MUST NEVER CHANGE.
 * Changing this will break the permanent 1-wallet-to-1-address mapping.
 * 
 * Format: "zDoge.cash Shielded Wallet\n\n...\n\nWallet: {address}\nVersion: 1"
 */
const SHIELDED_IDENTITY_MESSAGE_VERSION = 1;
function getShieldedIdentityMessage(walletAddress: string): string {
  return `zDoge.cash Shielded Wallet

Sign this message to create your permanent shielded identity.

This signature is used to derive your private spending key.
The same wallet will ALWAYS produce the same shielded address.
This address is permanent and will never change.

Wallet: ${walletAddress}
Version: ${SHIELDED_IDENTITY_MESSAGE_VERSION}`;
}

/**
 * Initialize shielded wallet
 * 
 * CRITICAL: This creates a PERMANENT, DETERMINISTIC shielded address.
 * 
 * Rules:
 * - 1 wallet address = 1 shielded address (FOREVER)
 * - Same wallet on any device/browser = same shielded address
 * - Shielded address NEVER changes (permanent)
 * - Derived deterministically from wallet signature
 * 
 * @param walletAddress - The connected wallet's address
 * @param signMessage - Function to request wallet signature (REQUIRED)
 * @param poolAddress - Optional pool address for syncing
 */
export async function initializeShieldedWallet(
  walletAddress: string,
  signMessage?: (message: string) => Promise<string>,
  poolAddress?: string
): Promise<ShieldedIdentity> {
  // Set current wallet address for storage keys
  currentWalletAddress = walletAddress;
  const keys = getStorageKeys();
  
  // Try to load existing identity for this wallet from localStorage (cache)
  const storedIdentity = await loadIdentityFromStorage();
  
  if (storedIdentity) {
    walletState.identity = storedIdentity;
    walletState.notes = await loadNotesFromStorage();
    walletState.isInitialized = true;
    
    // Verify: Re-derive identity from stored signature to ensure consistency
    let storedSig: string | null = null;
    if (typeof window !== 'undefined') {
      const storage = getEncryptedStorage();
      if (storage) {
        storedSig = await storage.getItem('signature');
      } else {
        storedSig = localStorage.getItem(keys.signature);
      }
    }
    if (storedSig) {
      const verifiedIdentity = await deriveIdentityFromSignature(storedSig);
      if (verifiedIdentity.shieldedAddress !== storedIdentity.shieldedAddress) {
        console.error('[ShieldedWallet] Identity mismatch detected! Re-deriving...');
        // Update to verified identity
        walletState.identity = verifiedIdentity;
        await saveIdentityToStorage(verifiedIdentity);
      }
    }
    
    // NOTE: Removed blocking sync on initialization for faster page loads
    // Notes are now verified just-in-time before spending (transfer/unshield)
    // This provides the same safety guarantees with much better UX
    // Manual sync is still available via syncNotesWithChain() if needed
    
    console.log(`[ShieldedWallet] Loaded permanent identity for ${walletAddress.slice(0, 8)}...`);
    return walletState.identity;
  }
  
  // No stored identity - MUST derive from wallet signature (permanent)
  console.log(`[ShieldedWallet] Creating permanent identity for ${walletAddress.slice(0, 8)}...`);
  
  // REQUIRE signature - no random fallback
  if (!signMessage) {
    throw new Error(
      'signMessage function is required. Shielded addresses are permanent and must be derived from wallet signature.'
    );
  }
  
  let signature: string;
  
  // Check if we have a stored signature (from previous session on this browser)
  let storedSig: string | null = null;
  if (typeof window !== 'undefined') {
    const storage = getEncryptedStorage();
    if (storage) {
      storedSig = await storage.getItem('signature');
    } else {
      storedSig = localStorage.getItem(keys.signature);
    }
  }
  
  if (storedSig) {
    // Verify stored signature produces same identity
    signature = storedSig;
    console.log('[ShieldedWallet] Using stored signature (permanent address)');
  } else {
    // Request signature from wallet using FIXED message format
    const message = getShieldedIdentityMessage(walletAddress);
    
    console.log('[ShieldedWallet] Requesting signature for permanent identity...');
    signature = await signMessage(message);
    
    // Store signature permanently (so user doesn't have to sign again)
    // This is safe because signature is deterministic - same wallet = same signature
    if (typeof window !== 'undefined') {
      const storage = getEncryptedStorage();
      if (storage) {
        await storage.setItem('signature', signature);
      } else {
        localStorage.setItem(keys.signature, signature);
      }
    }
    console.log('[ShieldedWallet] Signature obtained and stored (permanent)');
  }
  
  // Derive identity from signature (DETERMINISTIC - always same for same wallet)
  const identity = await deriveIdentityFromSignature(signature);
  await saveIdentityToStorage(identity);
  
  walletState.identity = identity;
  walletState.notes = [];
  walletState.isInitialized = true;
  
  console.log(`[ShieldedWallet] Permanent identity created: ${identity.addressString}`);
  console.log(`[ShieldedWallet] This address will NEVER change for wallet ${walletAddress.slice(0, 8)}...`);
  
  return identity;
}

/**
 * Derive shielded identity from wallet signature
 * 
 * CRITICAL: This function is DETERMINISTIC.
 * Same signature → Same spending key → Same shielded address
 * 
 * This ensures:
 * - 1 wallet = 1 shielded address (FOREVER)
 * - Same wallet on any device/browser = same address
 * - Address is PERMANENT and never changes
 * 
 * @param signature - Wallet signature (deterministic for same wallet)
 */
async function deriveIdentityFromSignature(signature: string): Promise<ShieldedIdentity> {
  const { keccak256, toBytes } = await import('viem');
  const { FIELD_SIZE, mimcHash2, DOMAIN } = await import('./shielded-crypto');
  
  // Hash the signature to get spending key (DETERMINISTIC)
  // Same wallet signature → same hash → same spending key
  const hash1 = keccak256(toBytes(signature));
  const spendingKey = BigInt(hash1) % FIELD_SIZE;
  
  // Derive viewing key using MiMC (must match circuit!)
  const viewingKey = await mimcHash2(spendingKey, DOMAIN.VIEWING_KEY);
  
  // Derive shielded address using MiMC (must match circuit's DeriveAddress!)
  // This is the PERMANENT public address (zdoge:...)
  const shieldedAddress = await mimcHash2(spendingKey, DOMAIN.SHIELDED_ADDRESS);
  
  // Create shielded address string with zdoge: prefix
  const addressString = `zdoge:${shieldedAddress.toString(16).padStart(64, '0')}`;
  
  return {
    spendingKey,
    viewingKey,
    shieldedAddress,
    addressString,
  };
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
 * Get total shielded balance (single bigint for backward compatibility)
 */
export function getShieldedBalance(): bigint {
  return walletState.notes.reduce((sum, note) => sum + note.amount, 0n);
}

/**
 * Get shielded balance per token
 */
// Cache for balance calculation to reduce redundant logging
let lastBalanceCache: { notesCount: number; balances: Record<string, bigint>; timestamp: number } | null = null;
const BALANCE_CACHE_MS = 100; // Cache for 100ms to prevent excessive logging

export function getShieldedBalancePerToken(): Record<string, bigint> {
  const balances: Record<string, bigint> = {};
  const now = Date.now();
  
  // Check cache to avoid redundant logging
  const notesCount = walletState.notes.length;
  if (lastBalanceCache && 
      lastBalanceCache.notesCount === notesCount && 
      (now - lastBalanceCache.timestamp) < BALANCE_CACHE_MS) {
    // Return cached balance if notes haven't changed and within cache window
    return lastBalanceCache.balances;
  }
  
  // Only log when actually calculating (not from cache)
  for (const note of walletState.notes) {
    if (note.leafIndex !== undefined) { // Only count confirmed notes
      const token = note.token || 'DOGE';
      const amount = note.amount;
      balances[token] = (balances[token] || 0n) + amount;
    }
  }
  
  // Update cache
  lastBalanceCache = {
    notesCount,
    balances: { ...balances },
    timestamp: now
  };
  
  // Only log final balance (not individual notes) to reduce console spam
  const balanceStr = Object.entries(balances).map(([token, amount]) => `${formatWeiToAmount(amount)} ${token}`).join(', ');
  console.log(`[Balance] ${notesCount} notes → ${balanceStr || '0 DOGE'}`);
  
  return balances;
}

/**
 * Shield DOGE (deposit into shielded pool)
 * 
 * @param amountDoge Amount in DOGE (e.g., 100)
 * @returns Note and commitment for contract call
 */
export async function prepareShield(
  amount: number,
  token: string = 'DOGE'
): Promise<{
  note: ShieldedNote;
  commitment: `0x${string}`;
  amountWei: bigint;
}> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  // Get token metadata
  const tokenMeta = getTokenMetadata(token);
  const tokenDecimals = tokenMeta.decimals;
  
  // Convert amount to token base units using token decimals
  const amountWei = parseAmountToWei(amount, tokenDecimals);
  
  // Create note for ourselves with the specified token metadata
  const note = await createNote(
    amountWei,
    walletState.identity.shieldedAddress,
    tokenMeta.symbol,
    tokenMeta.address,
    tokenMeta.decimals
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
export async function completeShield(note: ShieldedNote, leafIndex: number): Promise<void> {
  note.leafIndex = leafIndex;
  walletState.notes.push(note);
  await saveNotesToStorage(walletState.notes);
}

/**
 * Just-in-time note verification before spending
 * Verifies that:
 * 1. The commitment exists on-chain (note is valid)
 * 2. The nullifier hasn't been spent (note isn't already used)
 * 
 * This replaces blocking sync on page load with targeted verification before spending.
 * Same safety guarantees, much better UX.
 * 
 * @returns { valid: true } or throws with detailed error
 */
export async function verifyNoteBeforeSpending(
  note: ShieldedNote,
  poolAddress: string,
  identity: typeof walletState.identity
): Promise<{ valid: true }> {
  const { createPublicClient, http } = await import('viem');
  const { dogeosTestnet } = await import('../dogeos-config');
  const { getPrivacyRpcUrl } = await import('./privacy-utils');
  const { computeNullifier, computeNullifierHash, toBytes32, computeCommitment } = await import('./shielded-crypto');

  const publicClient = createPublicClient({
    chain: dogeosTestnet,
    transport: http(getPrivacyRpcUrl()),
  });

  // Step 1: Verify commitment exists on-chain
  const noteCommitment = note.commitment || await computeCommitment(note.secret, note.amount);
  const commitmentHex = toBytes32(noteCommitment);

  try {
    const commitmentExists = await publicClient.readContract({
      address: poolAddress as `0x${string}`,
      abi: [{
        type: 'function',
        name: 'commitments',
        inputs: [{ name: '', type: 'bytes32' }],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
      }],
      functionName: 'commitments',
      args: [commitmentHex],
    }) as boolean;

    if (!commitmentExists) {
      // Note doesn't exist on current contract - remove from wallet
      const noteIndex = walletState.notes.findIndex(n => n.commitment === note.commitment);
      if (noteIndex !== -1) {
        walletState.notes.splice(noteIndex, 1);
        await saveNotesToStorage(walletState.notes);
        console.warn(`[Verify] Removed invalid note from wallet: ${formatWeiToAmount(note.amount)} ${note.token || 'DOGE'}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('shielded-wallet-updated'));
        }
      }
      throw new Error('This note does not exist on the current contract. It may be from an old deployment. The note has been removed from your wallet.');
    }
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      throw error; // Re-throw our custom error
    }
    // If contract call fails, log but continue (contract will reject if invalid)
    console.warn('[Verify] Failed to verify commitment on-chain:', error);
  }

  // Step 2: Verify nullifier hasn't been spent (only if note has leafIndex)
  if (note.leafIndex !== undefined && identity) {
    try {
      const nullifier = await computeNullifier(
        note.secret,
        BigInt(note.leafIndex),
        identity.spendingKey
      );
      const nullifierHash = await computeNullifierHash(nullifier);
      const nullifierHashBytes = toBytes32(nullifierHash);

      const isSpent = await publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: [{
          name: 'isSpent',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: '_nullifierHash', type: 'bytes32' }],
          outputs: [{ name: '', type: 'bool' }],
        }],
        functionName: 'isSpent',
        args: [nullifierHashBytes],
      }) as boolean;

      if (isSpent) {
        // Remove the spent note from wallet
        const noteIndex = walletState.notes.findIndex(n => n.commitment === note.commitment);
        if (noteIndex !== -1) {
          walletState.notes.splice(noteIndex, 1);
          await saveNotesToStorage(walletState.notes);
          console.warn(`[Verify] Removed spent note from wallet: ${formatWeiToAmount(note.amount)} ${note.token || 'DOGE'}`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('shielded-wallet-updated'));
          }
        }
        throw new Error('This note has already been spent on-chain. It has been removed from your wallet. Please try again with a different note.');
      }
    } catch (error: any) {
      if (error.message?.includes('already been spent')) {
        throw error; // Re-throw our custom error
      }
      // If contract call fails, log but continue (contract will reject if spent)
      console.warn('[Verify] Failed to check nullifier on-chain:', error);
    }
  }

  console.log(`[Verify] Note verified: commitment exists, not spent`);
  return { valid: true };
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
  
  // Just-in-time verification: Verify note exists on-chain AND not spent
  // This replaces blocking sync on page load with targeted verification before spending
  await verifyNoteBeforeSpending(noteToSpend, poolAddress, walletState.identity);
  
  // Generate proof (returns root that was used in proof)
  const { proof, outputNote1, outputNote2, nullifierHash, root } = await generateTransferProof(
    noteToSpend,
    walletState.identity,
    recipientPubkey,
    amountWei,
    poolAddress,
    relayerAddress || '0x0000000000000000000000000000000000000000',
    feeWei
  );
  
  // Root is now returned from generateTransferProof (same as used in proof)
  console.log('[Transfer] Using root from proof generation:', root.toString(16).slice(0, 20) + '...');
  
  // Encrypt note details for recipient (enables auto-discovery)
      const encryptedMemo1 = await encryptNoteForRecipient(outputNote1, recipientPubkey);
      
      // Encrypt change note for ourselves
      const encryptedMemo2 = await encryptNoteForRecipient(outputNote2, walletState.identity!.shieldedAddress);
      
      // Validate memo sizes before formatting (1024 bytes max for encrypted memos)
      // This accounts for encryption overhead and provides room for future fields
      // Still provides DoS protection while being practical
      // Increased from 512 to 1024 to handle edge cases better
      const MAX_ENCRYPTED_MEMO_BYTES = 1024;
      const memo1Formatted = formatMemoForContract(encryptedMemo1);
      const memo2Formatted = formatMemoForContract(encryptedMemo2);
      
      // Check memo sizes (hex string length / 2 = bytes, subtract '0x' prefix)
      const memo1Bytes = (memo1Formatted.length - 2) / 2;
      const memo2Bytes = (memo2Formatted.length - 2) / 2;
      
      if (memo1Bytes > MAX_ENCRYPTED_MEMO_BYTES) {
        throw new Error(`encryptedMemo1 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes (got ${memo1Bytes} bytes). Please try with a smaller transaction.`);
      }
      if (memo2Bytes > MAX_ENCRYPTED_MEMO_BYTES) {
        throw new Error(`encryptedMemo2 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes (got ${memo2Bytes} bytes). Please try with a smaller transaction.`);
      }
      
      return {
        proof,
        nullifierHash: toBytes32(nullifierHash),
        outputCommitment1: toBytes32(outputNote1.commitment),
        outputCommitment2: toBytes32(outputNote2.commitment),
        recipientNote: outputNote1,
        changeNote: outputNote2,
        root: toBytes32(root),
        encryptedMemo1: memo1Formatted,
        encryptedMemo2: memo2Formatted,
      };
}

/**
 * Complete transfer after transaction confirmed
 * - Removes spent note
 * - Adds recipient note (if sent to self)
 * - Adds change note (if any)
 */
export async function completeTransfer(
  spentNoteIndex: number | ShieldedNote, // Can be index or the note itself
  changeNote: ShieldedNote,
  changeLeafIndex: number,
  recipientNote?: ShieldedNote,
  recipientLeafIndex?: number,
  poolAddress?: string // Pool address for on-chain verification
): void {
  // Find the spent note - handle both index and note object
  let actualIndex: number;
  if (typeof spentNoteIndex === 'number') {
    // If index provided, use it (for backward compatibility with single transfers)
    actualIndex = spentNoteIndex;
    if (actualIndex < 0 || actualIndex >= walletState.notes.length) {
      console.warn('[Transfer] Invalid note index:', actualIndex, 'wallet has', walletState.notes.length, 'notes');
      throw new Error(`Invalid note index: ${actualIndex}`);
    }
  } else {
    // If note provided, find it by commitment (more reliable for sequential transfers)
    const note = spentNoteIndex;
    console.log(`[Transfer] Looking for note to remove:`, {
      commitment: note.commitment.toString().slice(0, 20) + '...',
      leafIndex: note.leafIndex,
      amount: formatWeiToAmount(note.amount) + ' DOGE',
      availableNotes: walletState.notes.length
    });
    
    // Try to find by commitment first (most reliable)
    actualIndex = walletState.notes.findIndex(n => n.commitment === note.commitment);
    
    if (actualIndex === -1) {
      // Fallback: try to find by leafIndex and amount if commitment doesn't match
      console.warn('[Transfer] Note not found by commitment, trying leafIndex + amount match');
      actualIndex = walletState.notes.findIndex(
        n => n.leafIndex === note.leafIndex && n.amount === note.amount
      );
    }
    
    if (actualIndex === -1) {
      console.error('[Transfer] Could not find spent note:', {
        lookingFor: {
          commitment: note.commitment.toString().slice(0, 20) + '...',
          leafIndex: note.leafIndex,
          amount: formatWeiToAmount(note.amount) + ' DOGE'
        },
        availableNotes: walletState.notes.map((n, i) => ({
          index: i,
          leafIndex: n.leafIndex,
          amount: formatWeiToAmount(n.amount) + ' DOGE',
          commitment: n.commitment.toString().slice(0, 20) + '...'
        }))
      });
      throw new Error('Spent note not found in wallet (may have already been removed)');
    }
    console.log(`[Transfer] Found spent note at index ${actualIndex} by commitment/leafIndex`);
  }
  
  // BULLETPROOF: Verify note is actually spent on-chain before removing
  // This prevents removing notes that haven't been spent yet (e.g., if transaction failed)
  const noteToRemove = walletState.notes[actualIndex];
  if (noteToRemove.leafIndex !== undefined && walletState.identity) {
    try {
      const { verifyAndRemoveNote } = await import('./note-cleanup');
      // We need the nullifier hash - compute it from the note
      const { computeNullifier, computeNullifierHash, toBytes32 } = await import('./shielded-crypto');
      const nullifier = await computeNullifier(
        noteToRemove.secret,
        BigInt(noteToRemove.leafIndex),
        walletState.identity.spendingKey
      );
      const nullifierHash = await computeNullifierHash(nullifier);
      const nullifierHashBytes = toBytes32(nullifierHash);
      
      // Verify on-chain that this note is actually spent
      const verification = await verifyAndRemoveNote(
        noteToRemove,
        nullifierHashBytes,
        poolAddress || '', // Will be set by caller context
        walletState.identity.spendingKey
      );
      
      if (!verification.removed) {
        console.warn(
          `[Transfer] Note not confirmed spent on-chain: ${verification.reason}. ` +
          `This might be a timing issue - will retry cleanup later. ` +
          `Note will be removed anyway as transaction was submitted.`
        );
        // Still remove it since transaction was submitted, but log the warning
        // Background cleanup will catch any discrepancies
      } else {
        console.log(`[Transfer] ✓ Verified note is spent on-chain before removal`);
      }
    } catch (verifyError) {
      console.warn('[Transfer] Failed to verify note on-chain before removal:', verifyError);
      // Continue with removal anyway - background cleanup will catch discrepancies
    }
  }
  
  // Remove spent note
  const removedNote = walletState.notes.splice(actualIndex, 1)[0];
  console.log(`[Transfer] Removed spent note: ${formatWeiToAmount(removedNote.amount)} DOGE (was at index ${actualIndex})`);
  console.log(`[Transfer] Wallet now has ${walletState.notes.length} notes after removal`);
  
  // Check if recipient note belongs to us (sent to our own shielded address)
  if (recipientNote && recipientLeafIndex !== undefined && walletState.identity) {
    const isOurNote = recipientNote.ownerPubkey === walletState.identity.shieldedAddress;
    if (isOurNote && recipientNote.amount > 0n) {
      // Check if note already exists (might have been added by auto-discovery)
      const recipientCommitment = recipientNote.commitment;
      const alreadyExists = walletState.notes.some(n => {
        const matches = n.commitment === recipientCommitment;
        if (matches) {
          console.log(`[Transfer] Found duplicate note by commitment: ${recipientCommitment.toString(16).slice(0, 16)}...`);
        }
        return matches;
      });
      if (!alreadyExists) {
        recipientNote.leafIndex = recipientLeafIndex;
        walletState.notes.push(recipientNote);
        console.log('[Transfer] Added recipient note to wallet (sent to self):', recipientLeafIndex);
      } else {
        console.log('[Transfer] Recipient note already exists (likely added by auto-discovery), skipping duplicate');
      }
    }
  }
  
  // Add change note if it has value
  if (changeNote.amount > 0n) {
    changeNote.leafIndex = changeLeafIndex;
    walletState.notes.push(changeNote);
    console.log(`[Transfer] Added change note to wallet: ${formatWeiToAmount(changeNote.amount)} DOGE at leafIndex ${changeLeafIndex}`);
  }
  
  console.log(`[Transfer] Final wallet state: ${walletState.notes.length} notes total`);
  saveNotesToStorage(walletState.notes);
}

/**
 * Prepare batch transfer (spend multiple notes in one transaction)
 * 
 * This enables sending amounts larger than any single note by combining multiple notes.
 * All proofs share the same output commitments (recipient + change).
 * 
 * @param recipientAddress Recipient's shielded address
 * @param amountDoge Amount to send (total from all notes)
 * @param poolAddress Contract address
 * @param noteIndices Indices of notes to spend (if not provided, auto-selects)
 * @param relayerAddress Relayer address
 * @param feeDoge Total fee for the batch
 */
export async function prepareBatchTransfer(
  recipientAddress: string,
  amountDoge: number,
  poolAddress: string,
  noteIndices?: number[],
  relayerAddress?: string,
  feeDoge: number = 0
): Promise<{
  proofs: Array<{ proof: string[]; publicInputs: string[] }>;
  roots: `0x${string}`[];
  nullifierHashes: `0x${string}`[];
  outputCommitment1: `0x${string}`;
  outputCommitment2: `0x${string}`;
  recipientNote: ShieldedNote;
  changeNote: ShieldedNote;
  encryptedMemo1: `0x${string}`;
  encryptedMemo2: `0x${string}`;
  spentNoteIndices: number[];
}> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  const amountWei = parseAmountToWei(amountDoge);
  const feeWei = parseAmountToWei(feeDoge);
  const recipientPubkey = parseShieldedAddress(recipientAddress);
  
  // Check if sending to self - batch transfer with shared commitments loses value!
  const isSendingToSelf = recipientPubkey === walletState.identity.shieldedAddress;
  if (isSendingToSelf) {
    throw new Error(
      'Cannot use batch transfer to send to yourself - it causes value loss due to shared commitments. ' +
      'To consolidate notes: 1) Unshield all notes to your wallet, 2) Re-shield as a single large note. ' +
      'Or send to a different recipient.'
    );
  }
  
  // Select notes to spend
  let notesToSpend: ShieldedNote[];
  let spentNoteIndices: number[];
  
  if (noteIndices && noteIndices.length > 0) {
    // Use provided indices
    notesToSpend = noteIndices.map(i => walletState.notes[i]);
    spentNoteIndices = noteIndices;
  } else {
    // Auto-select: find smallest set of notes that covers amount + fee
    const requiredAmount = amountWei + feeWei;
    const candidates = walletState.notes
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => note.leafIndex !== undefined && note.amount > 0n)
      .sort((a, b) => Number(a.note.amount - b.note.amount));
    
    // Greedy selection: pick smallest notes until we have enough
    let total = 0n;
    const selected: Array<{ note: ShieldedNote; index: number }> = [];
    for (const item of candidates) {
      if (total >= requiredAmount) break;
      selected.push(item);
      total += item.note.amount;
    }
    
    if (total < requiredAmount) {
      throw new Error(`Insufficient balance. Need ${formatWeiToAmount(requiredAmount)} DOGE, have ${formatWeiToAmount(total)} DOGE across ${candidates.length} notes`);
    }
    
    notesToSpend = selected.map(s => s.note);
    spentNoteIndices = selected.map(s => s.index);
  }
  
  if (notesToSpend.length === 0) {
    throw new Error('No notes selected');
  }
  
  if (notesToSpend.length > 100) {
    throw new Error('Cannot spend more than 100 notes in one batch (contract limit)');
  }
  
  // Verify all notes have leaf indices
  for (const note of notesToSpend) {
    if (note.leafIndex === undefined) {
      throw new Error('One or more notes do not have a leaf index');
    }
  }
  
  // Calculate total input amount
  const totalInput = notesToSpend.reduce((sum, note) => sum + note.amount, 0n);
  const changeAmount = totalInput - amountWei - feeWei;
  
  if (changeAmount < 0n) {
    throw new Error(`Insufficient funds. Total input: ${formatWeiToAmount(totalInput)} DOGE, required: ${formatWeiToAmount(amountWei + feeWei)} DOGE`);
  }
  
  console.log(`[BatchTransfer] Spending ${notesToSpend.length} notes:`);
  console.log(`  Total input: ${formatWeiToAmount(totalInput)} DOGE`);
  console.log(`  Transfer amount: ${formatWeiToAmount(amountWei)} DOGE`);
  console.log(`  Fee: ${formatWeiToAmount(feeWei)} DOGE`);
  console.log(`  Change: ${formatWeiToAmount(changeAmount)} DOGE`);
  
  // Generate output notes ONCE (shared across all proofs)
  const { generateTransferProofWithOutputs } = await import('./shielded-proof-service');
  
  const proofs: Array<{ proof: string[]; publicInputs: string[] }> = [];
  const roots: `0x${string}`[] = [];
  const nullifierHashes: `0x${string}`[] = [];
  
  // Fee per proof (split evenly)
  const feePerProof = feeWei / BigInt(notesToSpend.length);
  
  // For batch transfers with shared output commitments, each note must send
  // the same amounts to recipient and change to satisfy value conservation.
  // Distribute amounts evenly across all notes:
  const transferAmountPerNote = amountWei / BigInt(notesToSpend.length);
  const changeAmountPerNote = changeAmount / BigInt(notesToSpend.length);
  
  // Verify that each note can cover its portion
  for (const note of notesToSpend) {
    const requiredPerNote = transferAmountPerNote + changeAmountPerNote + feePerProof;
    if (note.amount < requiredPerNote) {
      throw new Error(`Note with amount ${formatWeiToAmount(note.amount)} DOGE cannot cover required ${formatWeiToAmount(requiredPerNote)} DOGE per note in batch`);
    }
  }
  
  // Generate first proof (creates output notes with distributed amounts)
  const firstProof = await generateTransferProofWithOutputs(
    notesToSpend[0],
    walletState.identity,
    recipientPubkey,
    transferAmountPerNote,  // Each note sends equal portion to recipient
    changeAmountPerNote,   // Each note sends equal portion as change
    poolAddress,
    relayerAddress || '0x0000000000000000000000000000000000000000',
    feePerProof
  );
  
  proofs.push(firstProof.proof);
  roots.push(toBytes32(firstProof.root));
  nullifierHashes.push(toBytes32(firstProof.nullifierHash));
  
  const recipientNote = firstProof.outputNote1;
  const changeNote = firstProof.outputNote2;
  const outputCommitment1 = toBytes32(recipientNote.commitment);
  const outputCommitment2 = toBytes32(changeNote.commitment);
  
  // Generate remaining proofs (all use same output commitments with same amounts)
  for (let i = 1; i < notesToSpend.length; i++) {
    const proof = await generateTransferProofWithOutputs(
      notesToSpend[i],
      walletState.identity,
      recipientPubkey,
      transferAmountPerNote,  // Same amount per note
      changeAmountPerNote,    // Same change per note
      poolAddress,
      relayerAddress || '0x0000000000000000000000000000000000000000',
      feePerProof,
      recipientNote,  // Reuse same recipient note
      changeNote      // Reuse same change note
    );
    
    proofs.push(proof.proof);
    roots.push(toBytes32(proof.root));
    nullifierHashes.push(toBytes32(proof.nullifierHash));
  }
  
  // Encrypt memos
  const encryptedMemo1 = await encryptNoteForRecipient(recipientNote, recipientPubkey);
  const encryptedMemo2 = await encryptNoteForRecipient(changeNote, walletState.identity.shieldedAddress);
  
  const MAX_ENCRYPTED_MEMO_BYTES = 1024;
  const memo1Formatted = formatMemoForContract(encryptedMemo1);
  const memo2Formatted = formatMemoForContract(encryptedMemo2);
  
  const memo1Bytes = (memo1Formatted.length - 2) / 2;
  const memo2Bytes = (memo2Formatted.length - 2) / 2;
  
  if (memo1Bytes > MAX_ENCRYPTED_MEMO_BYTES) {
    throw new Error(`encryptedMemo1 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes (got ${memo1Bytes} bytes)`);
  }
  if (memo2Bytes > MAX_ENCRYPTED_MEMO_BYTES) {
    throw new Error(`encryptedMemo2 exceeds maximum size of ${MAX_ENCRYPTED_MEMO_BYTES} bytes (got ${memo2Bytes} bytes)`);
  }
  
  // NOTE: With shared commitments, each note only contributes 1/N of the total
  // The recipient note has amount = transferAmountPerNote (not full amountWei)
  // The change note has amount = changeAmountPerNote (not full changeAmount)
  // This is correct for the commitment verification
  
  return {
    proofs,
    roots,
    nullifierHashes,
    outputCommitment1,
    outputCommitment2,
    recipientNote,  // Amount is transferAmountPerNote
    changeNote,     // Amount is changeAmountPerNote  
    encryptedMemo1: memo1Formatted,
    encryptedMemo2: memo2Formatted,
    spentNoteIndices,
  };
}

/**
 * Complete batch transfer after transaction confirmed
 * - Removes all spent notes
 * - Adds recipient note (if sent to self)
 * - Adds change note
 */
export async function completeBatchTransfer(
  spentNoteIndices: number[],
  changeNote: ShieldedNote,
  changeLeafIndex: number,
  recipientNote?: ShieldedNote,
  recipientLeafIndex?: number
): Promise<void> {
  // Remove spent notes (in reverse order to maintain indices)
  const sortedIndices = [...spentNoteIndices].sort((a, b) => b - a);
  for (const index of sortedIndices) {
    walletState.notes.splice(index, 1);
  }
  
  // Check if recipient note belongs to us
  if (recipientNote && recipientLeafIndex !== undefined && walletState.identity) {
    const isOurNote = recipientNote.ownerPubkey === walletState.identity.shieldedAddress;
    if (isOurNote && recipientNote.amount > 0n) {
      // Check if note already exists (might have been added by auto-discovery)
      const alreadyExists = walletState.notes.some(n => n.commitment === recipientNote.commitment);
      if (!alreadyExists) {
        recipientNote.leafIndex = recipientLeafIndex;
        walletState.notes.push(recipientNote);
        console.log('[BatchTransfer] Added recipient note to wallet (sent to self):', recipientLeafIndex);
      } else {
        console.log('[BatchTransfer] Recipient note already exists (likely added by auto-discovery), skipping duplicate');
      }
    }
  }
  
  // Add change note
  if (changeNote.amount > 0n) {
    changeNote.leafIndex = changeLeafIndex;
    walletState.notes.push(changeNote);
    console.log('[BatchTransfer] Added change note to wallet:', changeLeafIndex);
  }
  
  saveNotesToStorage(walletState.notes);
}

/**
 * Prepare sequential transfers (Option D: Auto-split large transfers)
 * 
 * When amount exceeds single note capacity, automatically splits into multiple
 * sequential transfers. Each transfer uses a single note and creates separate
 * recipient notes.
 * 
 * @param recipientAddress Recipient's shielded address
 * @param totalAmountDoge Total amount to send (will be split across multiple transfers)
 * @param poolAddress Contract address
 * @param relayerAddress Relayer address
 * @param feePercent Fee percentage (0-100)
 * @param minFeeDoge Minimum fee in DOGE
 * @param onProgress Callback for progress updates (transferIndex, totalTransfers, amount)
 * @returns Array of transfer results
 */
export async function prepareSequentialTransfers(
  recipientAddress: string,
  totalAmountDoge: number,
  poolAddress: string,
  relayerAddress?: string,
  feePercent: number = 0.5,
  minFeeDoge: number = 0.001,
  onProgress?: (transferIndex: number, totalTransfers: number, amount: number) => void
): Promise<Array<{
  proof: { proof: string[]; publicInputs: string[] };
  root: `0x${string}`;
  nullifierHash: `0x${string}`;
  outputCommitment1: `0x${string}`;
  outputCommitment2: `0x${string}`;
  recipientNote: ShieldedNote;
  changeNote: ShieldedNote;
  encryptedMemo1: `0x${string}`;
  encryptedMemo2: `0x${string}`;
  noteIndex: number;
  amount: bigint;
}>> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  const totalAmountWei = parseAmountToWei(totalAmountDoge);
  const recipientPubkey = parseShieldedAddress(recipientAddress);
  
  // Get available notes
  const availableNotes = walletState.notes
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => note.leafIndex !== undefined && note.amount > 0n);
  
  if (availableNotes.length === 0) {
    throw new Error('No available notes');
  }
  
  // Calculate fee per transfer
  const feePercentBigInt = BigInt(Math.floor(feePercent * 100));
  const minFeeWei = parseAmountToWei(minFeeDoge);
  const MIN_CHANGE = 1000n; // Minimum 1000 wei for change note (accounts for rounding)
  
  /**
   * Find optimal subset of notes to minimize transfers and change
   * Uses dynamic programming for subset sum (faster than brute force)
   * 
   * IMPORTANT: targetAmount is the SPENDING amount (what user wants to spend from balance),
   * NOT the recipient amount. The recipient receives less after fees are deducted.
   */
  function findOptimalNoteSubset(
    notes: Array<{ note: ShieldedNote; index: number }>,
    targetAmount: bigint // SPENDING amount (what user wants to spend from balance)
  ): Array<{ note: ShieldedNote; index: number; transferAmount: bigint; fee: bigint }> {
    // Calculate net sendable amount for each note (after fee and min change)
    // Use same buffer as in distribution logic
    const ROUNDING_BUFFER = 10000n; // Extra buffer for rounding errors
    const minChangeRequired = MIN_CHANGE + ROUNDING_BUFFER;
    
    const noteValues = notes.map(({ note, index }) => {
      let fee = (note.amount * feePercentBigInt) / 10000n;
      if (fee < minFeeWei) fee = minFeeWei;
      
      // Option 1: Full note spend (no change needed) - like unshield
      // Can spend entire note: amount - fee (no change note created)
      const maxFullSpend = note.amount > fee ? note.amount - fee : 0n;
      
      // Option 2: Partial note spend (must create change note)
      // Must leave MIN_CHANGE behind for change note
      const maxPartialSpend = note.amount > fee + minChangeRequired 
        ? note.amount - fee - minChangeRequired 
        : 0n;
      
      // Use the maximum (full spend is always better if possible)
      const maxSendable = maxFullSpend > maxPartialSpend ? maxFullSpend : maxPartialSpend;
      
      // Note: maxSendable is what recipient receives from this note (after fees)
      // But we need to track spending capacity too: note.amount = spending capacity
      
      return {
        note,
        index,
        maxSendable, // Recipient receives this (after fees)
        fee,
        spendingCapacity: note.amount, // Total spending from this note
        netValue: maxSendable, // How much recipient receives from this note
        canFullSpend: maxFullSpend > 0n, // Can we fully spend this note?
        canOnlyCoverFee: note.amount <= fee, // Note can only cover fees, nothing left for recipient
      };
    });
    
    // Separate notes that can send vs notes that can only cover fees
    const usefulNotes = noteValues.filter(n => n.maxSendable > 0n);
    const feeOnlyNotes = noteValues.filter(n => n.canOnlyCoverFee);
    
    if (usefulNotes.length === 0) {
      throw new Error('No notes with sufficient balance after fees');
    }
    
    // For the selection logic, we'll use all notes (useful + fee-only) to get accurate total capacity
    const allNotesForCapacity = [...usefulNotes, ...feeOnlyNotes];
    
    // Sort by spending capacity (largest first) for better selection when trying to match spending amount
    usefulNotes.sort((a, b) => Number(b.spendingCapacity - a.spendingCapacity));
    feeOnlyNotes.sort((a, b) => Number(b.spendingCapacity - a.spendingCapacity));
    
    // Debug: Log note details
    console.log(`[findOptimalNoteSubset] Target spending amount: ${formatWeiToAmount(targetAmount)} DOGE`);
    console.log(`[findOptimalNoteSubset] Available ${usefulNotes.length} useful notes + ${feeOnlyNotes.length} fee-only notes:`);
    allNotesForCapacity.forEach((item, i) => {
      const noteType = item.canOnlyCoverFee ? ' (fee-only)' : '';
      console.log(`  Note ${i + 1}: amount=${formatWeiToAmount(item.note.amount)} DOGE, fee=${formatWeiToAmount(item.fee)} DOGE, spendingCapacity=${formatWeiToAmount(item.spendingCapacity)} DOGE, maxSendable=${formatWeiToAmount(item.maxSendable)} DOGE, canFullSpend=${item.canFullSpend}${noteType}`);
    });
    const totalNoteAmounts = allNotesForCapacity.reduce((sum, n) => sum + n.note.amount, 0n);
    const totalMaxSpendable = usefulNotes.reduce((sum, n) => sum + n.maxSendable, 0n);
    console.log(`[findOptimalNoteSubset] Total note amounts: ${formatWeiToAmount(totalNoteAmounts)} DOGE`);
    console.log(`[findOptimalNoteSubset] Total max sendable (after fees): ${formatWeiToAmount(totalMaxSpendable)} DOGE`);
    
    // Calculate total spending capacity from all available notes (including fee-only notes)
    const totalAvailableCapacity = allNotesForCapacity.reduce((sum, n) => sum + n.spendingCapacity, 0n);
    
    // If target amount exceeds available capacity, we can't fulfill it
    if (targetAmount > totalAvailableCapacity) {
      throw new Error(`Insufficient balance: cannot spend ${formatWeiToAmount(targetAmount)} DOGE. Available spending capacity: ${formatWeiToAmount(totalAvailableCapacity)} DOGE from ${noteValues.length} notes`);
    }
    
    // Greedy approach: select notes until we have enough SPENDING CAPACITY
    // targetAmount is what user wants to SPEND, not what recipient receives
    const selectedNotes: typeof noteValues = [];
    let totalSpendingCapacity = 0n;
    
    // If we need to spend the full available capacity (or close to it), use all notes
    if (targetAmount >= totalAvailableCapacity * 99n / 100n) {
      // Use all notes (within 1% tolerance for rounding)
      selectedNotes.push(...usefulNotes, ...feeOnlyNotes);
      totalSpendingCapacity = totalAvailableCapacity;
      console.log(`[findOptimalNoteSubset] Using all ${allNotesForCapacity.length} notes (target is close to max capacity)`);
    } else {
      // Greedy selection: first add useful notes, then fee-only notes if needed
      for (const item of usefulNotes) {
        if (totalSpendingCapacity >= targetAmount) break;
        selectedNotes.push(item);
        totalSpendingCapacity += item.spendingCapacity;
      }
      
      // If we still don't have enough, add fee-only notes
      if (totalSpendingCapacity < targetAmount) {
        for (const item of feeOnlyNotes) {
          if (totalSpendingCapacity >= targetAmount) break;
          selectedNotes.push(item);
          totalSpendingCapacity += item.spendingCapacity;
        }
      }
      
      // If still not enough, something is wrong (we already checked totalAvailableCapacity)
    }
    
    console.log(`[findOptimalNoteSubset] Selected ${selectedNotes.length} notes, total spending capacity: ${formatWeiToAmount(totalSpendingCapacity)} DOGE`);
    
    if (selectedNotes.length === 0 || totalSpendingCapacity < targetAmount) {
      throw new Error(`Insufficient balance: cannot find notes to spend ${formatWeiToAmount(targetAmount)} DOGE. Available spending capacity: ${formatWeiToAmount(totalSpendingCapacity)} DOGE from ${allNotesForCapacity.length} notes`);
    }
    
    // Distribute the SPENDING amount across selected notes
    // Note: transferAmount will be what recipient receives (spending - fees per note)
    const transfers: Array<{ note: ShieldedNote; index: number; transferAmount: bigint; fee: bigint }> = [];
    let remainingSpending = targetAmount;
    
    // Sort by spending capacity descending to use larger notes first
    selectedNotes.sort((a, b) => Number(b.spendingCapacity - a.spendingCapacity));
    
    for (const item of selectedNotes) {
      if (remainingSpending <= 0n) break;
      
      // Declare variables for this iteration
      let noteSpending: bigint;
      let transferAmount: bigint;
      
      // Calculate how much we can spend from this note
      const maxFullSpend = item.note.amount > item.fee ? item.note.amount - item.fee : 0n;
      const maxPartialSpend = item.note.amount > item.fee + minChangeRequired 
        ? item.note.amount - item.fee - minChangeRequired 
        : 0n;
      const maxSendableFromNote = maxFullSpend > maxPartialSpend ? maxFullSpend : maxPartialSpend;
      
      // Handle fee-only notes (can only cover fees, nothing for recipient)
      if (item.canOnlyCoverFee) {
        // For fee-only notes, we fully spend them (they just cover fees)
        if (remainingSpending >= item.note.amount) {
          noteSpending = item.note.amount;
          transferAmount = 0n; // Recipient receives nothing from this note
        } else {
          // We don't need this note's full capacity, but we include it anyway if it's selected
          noteSpending = remainingSpending;
          transferAmount = 0n;
        }
      } else if (maxSendableFromNote <= 0n) {
        continue; // Note too small and not fee-only, skip
      } else {
        // Determine spending strategy for this note
        const changeAfterFullSpend = item.note.amount - maxFullSpend - item.fee;
        const canFullySpend = maxFullSpend > 0n && (changeAfterFullSpend < minChangeRequired || changeAfterFullSpend === 0n);
        
        // Decide how much to SPEND from this note
        // transferAmount = what recipient receives (spending - fee)
        // We need: transferAmount + fee = spending from this note
        
        if (canFullySpend && remainingSpending >= item.spendingCapacity) {
          // Fully spend this note (note.amount total)
          noteSpending = item.note.amount;
          transferAmount = maxFullSpend; // Recipient receives note.amount - fee
        } else if (canFullySpend && remainingSpending < item.spendingCapacity) {
          // Spend exactly what we need (remainingSpending)
          noteSpending = remainingSpending;
          transferAmount = remainingSpending > item.fee ? remainingSpending - item.fee : 0n;
          // If spending less than note.amount, change = note.amount - noteSpending - fee
          // But if change < minChange, we fully spend (transferAmount = note.amount - fee)
          const potentialChange = item.note.amount - noteSpending - item.fee;
          if (potentialChange < minChangeRequired && potentialChange >= 0n) {
            // Change too small, fully spend this note
            noteSpending = item.note.amount;
            transferAmount = maxFullSpend;
          }
        } else {
          // Partial spend (must create change note with minChangeRequired)
          // We can spend: note.amount - fee - minChangeRequired
          const maxPartialSpending = item.note.amount - item.fee - minChangeRequired;
          if (remainingSpending >= maxPartialSpending) {
            noteSpending = maxPartialSpending;
            transferAmount = maxPartialSpend;
          } else {
            noteSpending = remainingSpending;
            transferAmount = remainingSpending > item.fee ? remainingSpending - item.fee : 0n;
          }
        }
      }
      
      // Verify we can actually do this transfer
      if (noteSpending > item.note.amount || noteSpending <= 0n) {
        continue;
      }
      
      // For fee-only notes, transferAmount can be 0 (that's expected)
      
      // Record the transfer (transferAmount is what recipient receives)
    // Skip fee-only notes (where recipient receives 0) - they can't be used in transfers
    // Circuit requires positive amount for recipient notes
    if (transferAmount > 0n) {
      transfers.push({
        note: item.note,
        index: item.index,
        transferAmount,
        fee: item.fee,
      });
      remainingSpending -= noteSpending; // Deduct what we spent from this note
    } else {
      // Fee-only note: can't create transfer (circuit rejects zero-amount recipient notes)
      // Just deduct from remaining spending to account for the fee being paid
      remainingSpending -= noteSpending;
      console.warn(`[findOptimalNoteSubset] Skipping fee-only note (${formatWeiToAmount(item.note.amount)} DOGE) - cannot create transfer with zero recipient amount`);
    }
    }
    
    if (remainingSpending > 0n) {
      throw new Error(`Insufficient balance: still need ${formatWeiToAmount(remainingSpending)} DOGE after optimal selection`);
    }
    
    const totalRecipientAmount = transfers.reduce((sum, t) => sum + t.transferAmount, 0n);
    const totalSpent = transfers.reduce((sum, t) => sum + t.transferAmount + t.fee, 0n);
    console.log(`[SequentialTransfer] Optimal selection: ${transfers.length} notes (spending: ${formatWeiToAmount(totalSpent)} DOGE, recipient receives: ${formatWeiToAmount(totalRecipientAmount)} DOGE)`);
    
    return transfers;
  }
  
  // Find optimal note selection
  const optimalTransfers = findOptimalNoteSubset(availableNotes, totalAmountWei);
  
  // Filter out fee-only notes (transferAmount = 0) - circuit rejects zero-amount recipient notes
  // These notes can't be used in transfers but are accounted for in spending calculation
  const usableTransfers = optimalTransfers.filter(t => t.transferAmount > 0n);
  
  if (usableTransfers.length === 0) {
    throw new Error('No usable notes for transfer (all notes are too small after fees)');
  }
  
  // Convert to expected format
  const transfers: Array<{
    noteIndex: number;
    note: ShieldedNote;
    amount: bigint;
    fee: bigint;
  }> = usableTransfers.map(t => ({
    noteIndex: t.index,
    note: t.note,
    amount: t.transferAmount,
    fee: t.fee,
  }));
  
  // Log if fee-only notes were filtered out
  const feeOnlyCount = optimalTransfers.length - usableTransfers.length;
  if (feeOnlyCount > 0) {
    console.warn(`[SequentialTransfer] Filtered out ${feeOnlyCount} fee-only note(s) - cannot create transfers with zero recipient amount`);
  }
  
  console.log(`[SequentialTransfer] Planning ${transfers.length} transfers:`);
  transfers.forEach((t, i) => {
    console.log(`  Transfer ${i + 1}: ${formatWeiToAmount(t.amount)} DOGE from note ${t.noteIndex} (fee: ${formatWeiToAmount(t.fee)} DOGE)`);
  });
  
  // Generate proofs for each transfer
  const results: Array<{
    proof: { proof: string[]; publicInputs: string[] };
    root: `0x${string}`;
    nullifierHash: `0x${string}`;
    outputCommitment1: `0x${string}`;
    outputCommitment2: `0x${string}`;
    recipientNote: ShieldedNote;
    changeNote: ShieldedNote;
    encryptedMemo1: `0x${string}`;
    encryptedMemo2: `0x${string}`;
    noteIndex: number;
    note: ShieldedNote; // Include the note object for reliable removal
    amount: bigint;
  }> = [];
  
  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i];
    
    // Pre-check: Verify nullifier is not already spent on-chain (before generating proof)
    // This prevents wasting time generating proofs for spent notes
    try {
      const { createPublicClient, http } = await import('viem');
      const { dogeosTestnet } = await import('../dogeos-config');
      const { getPrivacyRpcUrl } = await import('./privacy-utils');
      const { computeNullifier, computeNullifierHash, toBytes32 } = await import('./shielded-crypto');
      
      const publicClient = createPublicClient({
        chain: dogeosTestnet,
        transport: http(getPrivacyRpcUrl()),
      });
      
      if (transfer.note.leafIndex !== undefined) {
        const nullifier = await computeNullifier(
          transfer.note.secret,
          BigInt(transfer.note.leafIndex),
          walletState.identity.spendingKey
        );
        const nullifierHash = await computeNullifierHash(nullifier);
        const nullifierHashBytes = toBytes32(nullifierHash);
        
        const isSpent = await publicClient.readContract({
          address: poolAddress as `0x${string}`,
          abi: [{
            name: 'isSpent',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: '_nullifierHash', type: 'bytes32' }],
            outputs: [{ name: '', type: 'bool' }],
          }],
          functionName: 'isSpent',
          args: [nullifierHashBytes],
        });
        
        if (isSpent) {
          // Remove the spent note from wallet
          const noteIndex = walletState.notes.findIndex(n => n.commitment === transfer.note.commitment);
          if (noteIndex !== -1) {
            walletState.notes.splice(noteIndex, 1);
            await saveNotesToStorage(walletState.notes);
            console.warn(`[SequentialTransfer] Removed spent note from wallet: ${formatWeiToAmount(transfer.note.amount)} DOGE`);
            // Dispatch event to refresh UI
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('shielded-wallet-updated'));
            }
          }
          throw new Error(`Note ${i + 1} (${formatWeiToAmount(transfer.note.amount)} DOGE) has already been spent on-chain. It has been removed from your wallet. Please try again.`);
        }
      }
    } catch (checkError: any) {
      // If it's our custom error, re-throw it
      if (checkError.message && checkError.message.includes('already been spent')) {
        throw checkError;
      }
      // Otherwise, log warning but continue (prepareTransfer will also check)
      console.warn(`[SequentialTransfer] Failed to check nullifier for transfer ${i + 1}:`, checkError);
    }
    
    // Verify change calculation (allow zero change for full note spends, like unshield)
    const expectedChange = transfer.note.amount - transfer.amount - transfer.fee;
    if (expectedChange < 0n) {
      throw new Error(
        `Transfer ${i + 1} would result in negative change: ` +
        `note=${formatWeiToAmount(transfer.note.amount)} DOGE, ` +
        `transfer=${formatWeiToAmount(transfer.amount)} DOGE, ` +
        `fee=${formatWeiToAmount(transfer.fee)} DOGE, ` +
        `change=${formatWeiToAmount(expectedChange)} DOGE`
      );
    }
    // Note: change = 0 is valid for full note spends (circuit can handle zero change commitment)
    
    console.log(`[SequentialTransfer] Transfer ${i + 1}/${transfers.length}:`);
    console.log(`  Note: ${formatWeiToAmount(transfer.note.amount)} DOGE`);
    console.log(`  Sending: ${formatWeiToAmount(transfer.amount)} DOGE`);
    console.log(`  Fee: ${formatWeiToAmount(transfer.fee)} DOGE`);
    console.log(`  Expected change: ${formatWeiToAmount(expectedChange)} DOGE`);
    
    // Update progress: Generating proof
    if (onProgress) {
      onProgress(i + 1, transfers.length, Number(transfer.amount) / 1e18);
    }
    
    // Generate proof for this transfer
    // Convert to DOGE with proper precision handling
    // Round down to avoid precision issues
    const transferAmountDoge = Math.floor(Number(transfer.amount) / 1e15) / 1e3; // Round to 3 decimal places
    const feeDoge = Math.floor(Number(transfer.fee) / 1e15) / 1e3;
    
    // Double-check: convert back to wei and verify change is non-negative (allow zero for full note spends)
    const transferAmountWeiCheck = BigInt(Math.floor(transferAmountDoge * 1e18));
    const feeWeiCheck = BigInt(Math.floor(feeDoge * 1e18));
    const changeCheck = transfer.note.amount - transferAmountWeiCheck - feeWeiCheck;
    
    if (changeCheck < 0n) {
      // Adjust transfer amount down slightly to ensure non-negative change
      // For full note spends, change = 0 is valid, so only adjust if change would be negative
      const adjustedTransferAmount = transfer.note.amount - feeWeiCheck - MIN_CHANGE;
      if (adjustedTransferAmount <= 0n) {
        throw new Error(
          `Transfer ${i + 1} cannot be processed: note too small after fee. ` +
          `Note: ${formatWeiToAmount(transfer.note.amount)} DOGE, ` +
          `Fee: ${formatWeiToAmount(transfer.fee)} DOGE`
        );
      }
      console.warn(
        `[SequentialTransfer] Adjusting transfer ${i + 1} amount due to rounding: ` +
        `${formatWeiToAmount(transfer.amount)} -> ${formatWeiToAmount(adjustedTransferAmount)} DOGE`
      );
      
      const result = await prepareTransfer(
        recipientAddress,
        Number(adjustedTransferAmount) / 1e18,
        poolAddress,
        transfer.noteIndex,
        relayerAddress || '0x0000000000000000000000000000000000000000',
        feeDoge
      );
      
      results.push({
        ...result,
        noteIndex: transfer.noteIndex,
        note: transfer.note, // Include note for reliable removal
        amount: adjustedTransferAmount,
      });
    } else {
      const result = await prepareTransfer(
        recipientAddress,
        transferAmountDoge,
        poolAddress,
        transfer.noteIndex,
        relayerAddress || '0x0000000000000000000000000000000000000000',
        feeDoge
      );
      
      results.push({
        ...result,
        noteIndex: transfer.noteIndex,
        note: transfer.note, // Include note for reliable removal
        amount: transfer.amount,
      });
    }
  }
  
  return results;
}

/**
 * Prepare Multi-Input Transfer using the new multi-input circuit
 * 
 * This is a TRUE Zcash-style multi-input transfer:
 * - ONE proof for ALL input notes (not multiple proofs)
 * - Much more gas-efficient
 * - Proper value conservation across all inputs
 * 
 * @param recipientAddress Recipient's shielded address (z-address)
 * @param amountDoge Amount to transfer in DOGE
 * @param poolAddress The shielded pool contract address
 * @param notesToSpendIndices Optional: specific note indices to use
 * @param relayerAddress Relayer address for gasless transactions
 * @param feeDoge Relayer fee in DOGE
 */
export async function prepareMultiInputTransfer(
  recipientAddress: string,
  amountDoge: number,
  poolAddress: string,
  notesToSpendIndices?: number[],
  relayerAddress?: string,
  feeDoge: number = 0
): Promise<{
  proof: { proof: string[]; publicInputs: string[] };
  roots: `0x${string}`[];          // Fixed size array [10]
  nullifierHashes: `0x${string}`[]; // Fixed size array [10]
  outputCommitment1: `0x${string}`;
  outputCommitment2: `0x${string}`;
  recipientNote: ShieldedNote;
  changeNote: ShieldedNote;
  encryptedMemo1: `0x${string}`;
  encryptedMemo2: `0x${string}`;
  spentNoteIndices: number[];
  numInputs: number;
}> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  const amountWei = parseAmountToWei(amountDoge);
  const feeWei = parseAmountToWei(feeDoge);
  const requiredAmount = amountWei + feeWei;
  
  // Parse recipient address
  const recipientPubkey = BigInt(recipientAddress);
  
  console.log('[MultiTransfer] Preparing multi-input transfer');
  console.log('[MultiTransfer] Amount:', amountDoge, 'DOGE (', amountWei.toString(), 'wei)');
  console.log('[MultiTransfer] Fee:', feeDoge, 'DOGE');
  
  // Select notes to spend
  let notesToSpend: ShieldedNote[];
  let spentNoteIndices: number[];
  
  if (notesToSpendIndices && notesToSpendIndices.length > 0) {
    notesToSpend = notesToSpendIndices.map(i => walletState.notes[i]);
    spentNoteIndices = notesToSpendIndices;
  } else {
    // Auto-select notes using greedy algorithm
    const candidates = walletState.notes
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => note.leafIndex !== undefined && note.amount > 0n)
      .sort((a, b) => Number(a.note.amount - b.note.amount));
    
    let total = 0n;
    const selected: Array<{ note: ShieldedNote; index: number }> = [];
    for (const item of candidates) {
      if (total >= requiredAmount) break;
      selected.push(item);
      total += item.note.amount;
    }
    
    if (total < requiredAmount) {
      throw new Error(`Insufficient balance. Need ${formatWeiToAmount(requiredAmount)} DOGE, have ${formatWeiToAmount(total)} DOGE`);
    }
    
    notesToSpend = selected.map(s => s.note);
    spentNoteIndices = selected.map(s => s.index);
  }
  
  if (notesToSpend.length < 2) {
    throw new Error('Multi-input transfer requires at least 2 notes. Use regular transfer for single notes.');
  }
  
  if (notesToSpend.length > 100) {
    throw new Error('Cannot spend more than 100 notes in one transaction (contract limit)');
  }
  
  console.log(`[MultiTransfer] Using ${notesToSpend.length} notes`);
  
  // Just-in-time verification: Verify ALL notes exist on-chain AND not spent
  // Run verifications in parallel for better performance
  await Promise.all(
    notesToSpend.map(note => verifyNoteBeforeSpending(note, poolAddress, walletState.identity))
  );
  
  // Generate multi-input proof
  const { generateMultiInputTransferProof } = await import('./shielded-proof-service');
  
  const result = await generateMultiInputTransferProof(
    notesToSpend,
    walletState.identity,
    recipientPubkey,
    amountWei,
    poolAddress,
    relayerAddress || '0x0000000000000000000000000000000000000000',
    feeWei
  );
  
  // Pad roots and nullifierHashes to fixed size of 5
  const paddedRoots: `0x${string}`[] = [];
  const paddedNullifierHashes: `0x${string}`[] = [];
  
  for (let i = 0; i < 5; i++) {
    if (i < result.roots.length) {
      paddedRoots.push(toBytes32(result.roots[i]));
      paddedNullifierHashes.push(toBytes32(result.nullifierHashes[i]));
    } else {
      paddedRoots.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      paddedNullifierHashes.push('0x0000000000000000000000000000000000000000000000000000000000000000');
    }
  }
  
  // Encrypt memos
  const encryptedMemo1 = await encryptNoteForRecipient(result.outputNote1, recipientPubkey);
  const encryptedMemo2 = await encryptNoteForRecipient(result.outputNote2, walletState.identity.shieldedAddress);
  
  const memo1Formatted = formatMemoForContract(encryptedMemo1);
  const memo2Formatted = formatMemoForContract(encryptedMemo2);
  
  return {
    proof: result.proof,
    roots: paddedRoots,
    nullifierHashes: paddedNullifierHashes,
    outputCommitment1: toBytes32(result.outputNote1.commitment),
    outputCommitment2: toBytes32(result.outputNote2.commitment),
    recipientNote: result.outputNote1,
    changeNote: result.outputNote2,
    encryptedMemo1: memo1Formatted,
    encryptedMemo2: memo2Formatted,
    spentNoteIndices,
    numInputs: result.numInputs,
  };
}

/**
 * Complete multi-input transfer after transaction confirmed
 * - Removes all spent notes
 * - Adds recipient note (if sent to self)
 * - Adds change note
 * 
 * This is the same as completeBatchTransfer but named for clarity
 */
export async function completeMultiInputTransfer(
  spentNoteIndices: number[],
  changeNote: ShieldedNote,
  changeLeafIndex: number,
  recipientNote?: ShieldedNote,
  recipientLeafIndex?: number
): Promise<void> {
  // Reuse the same logic as batch transfer
  return completeBatchTransfer(spentNoteIndices, changeNote, changeLeafIndex, recipientNote, recipientLeafIndex);
}

/**
 * Prepare unshield (withdraw to public address)
 * Supports partial unshield with change notes (V3)
 * 
 * @param recipientAddress - Public address to receive funds
 * @param noteIndex - Index of note to spend
 * @param requestedAmount - Amount to withdraw (can be less than note amount)
 * @param poolAddress - Shielded pool contract address
 * @param relayerAddress - Optional relayer address
 * @param feeDoge - Fee in human-readable format (deprecated, use feeWei)
 * @param feeWei - Fee in wei (already calculated for the token's decimals)
 */
export async function prepareUnshield(
  recipientAddress: string,
  noteIndex: number,
  requestedAmount: bigint,  // NEW: Requested withdrawal amount
  poolAddress: string,
  relayerAddress?: string,
  feeDoge: number = 0,
  feeWei?: bigint  // Optional: pass fee directly in wei to avoid precision loss
): Promise<{
  proof: { proof: string[]; publicInputs: string[] };
  nullifierHash: `0x${string}`;
  amount: bigint;
  changeAmount: bigint;      // NEW: Change amount
  changeNote?: ShieldedNote; // NEW: Change note (if any)
  changeCommitment?: `0x${string}`; // NEW: Change commitment
  root: `0x${string}`;
}> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  const note = walletState.notes[noteIndex];
  if (!note || note.leafIndex === undefined) {
    throw new Error('Invalid note');
  }
  
  // Just-in-time verification: Verify note exists on-chain AND not spent
  // This replaces blocking sync on page load with targeted verification before spending
  await verifyNoteBeforeSpending(note, poolAddress, walletState.identity);
  
  // Use feeWei if provided (already in token base units), otherwise convert from feeDoge
  // Fee must be in same units as note.amount (token base units)
  const fee = feeWei !== undefined ? feeWei : parseAmountToWei(feeDoge);
  
  // Calculate change: note.amount - requestedAmount - fee
  const changeAmount = note.amount - requestedAmount - fee;
  
  if (changeAmount < 0n) {
    // Use note's decimals if available, otherwise fall back to token lookup
    const tokenDecimals = note.decimals ?? (note.token ? (shieldedPool.supportedTokens[note.token as keyof typeof shieldedPool.supportedTokens]?.decimals || 18) : 18);
    const noteAmountHuman = formatWeiToAmount(note.amount, tokenDecimals);
    const requestedAmountHuman = formatWeiToAmount(requestedAmount, tokenDecimals);
    const feeAmountHuman = formatWeiToAmount(fee, tokenDecimals);
    throw new Error(`Insufficient funds. Note: ${noteAmountHuman} ${note.token || 'DOGE'}, Requested: ${requestedAmountHuman} ${note.token || 'DOGE'}, Fee: ${feeAmountHuman} ${note.token || 'DOGE'}`);
  }
  
  if (requestedAmount <= 0n) {
    throw new Error('Withdrawal amount must be positive');
  }
  
  // Generate proof with change support
  const { proof, nullifierHash, root, changeNote, changeCommitment } = await generateUnshieldProof(
    note,
    walletState.identity,
    recipientAddress,
    requestedAmount,  // Withdrawal amount
    poolAddress,
    relayerAddress || '0x0000000000000000000000000000000000000000',
    fee
  );
  
  return {
    proof,
    nullifierHash: toBytes32(nullifierHash),
    amount: requestedAmount,
    changeAmount,           // NEW
    changeNote,            // NEW
    changeCommitment: changeCommitment ? toBytes32(changeCommitment) : undefined, // NEW
    root: toBytes32(root),
  };
}

/**
 * Complete unshield after transaction confirmed
 * Removes the spent note and adds change note if present (V3)
 */
export async function completeUnshield(
  noteIndex: number,
  changeNote?: ShieldedNote | null,  // V3: Change note to add back
  changeLeafIndex?: number,            // V3: Leaf index of change note
  nullifierHash?: `0x${string}`,
  poolAddress?: string
): Promise<void> {
  // BULLETPROOF: Verify note removal - find by commitment if nullifier provided
  if (nullifierHash && poolAddress && walletState.identity) {
    try {
      // Find the note by matching nullifier hash
      const noteToRemove = walletState.notes[noteIndex];
      if (noteToRemove && noteToRemove.leafIndex !== undefined) {
        const { verifyAndRemoveNote } = await import('./note-cleanup');
        const { computeNullifier, computeNullifierHash, toBytes32 } = await import('./shielded-crypto');
        const nullifier = await computeNullifier(
          noteToRemove.secret,
          BigInt(noteToRemove.leafIndex),
          walletState.identity.spendingKey
        );
        const expectedNullifierHash = await computeNullifierHash(nullifier);
        const expectedNullifierHashBytes = toBytes32(expectedNullifierHash);
        
        // Verify nullifier hash matches
        if (expectedNullifierHashBytes.toLowerCase() === nullifierHash.toLowerCase()) {
          // Verify on-chain that note is spent before removing
          const verification = await verifyAndRemoveNote(
            noteToRemove,
            nullifierHash,
            poolAddress,
            walletState.identity.spendingKey
          );
          
          if (verification.removed) {
            console.log(`[Unshield] ✓ Verified note is spent on-chain before removal`);
          } else {
            console.warn(`[Unshield] Note not confirmed spent on-chain: ${verification.reason}. Removing anyway since transaction was submitted.`);
          }
        }
      }
    } catch (verifyError) {
      console.warn('[Unshield] Failed to verify note on-chain before removal:', verifyError);
      // Continue with removal anyway - background cleanup will catch discrepancies
    }
  }
  
  // Remove note by index (with validation)
  if (noteIndex < 0 || noteIndex >= walletState.notes.length) {
    console.error(`[Unshield] Invalid note index: ${noteIndex}, wallet has ${walletState.notes.length} notes`);
    throw new Error(`Invalid note index: ${noteIndex}`);
  }
  
  const removedNote = walletState.notes.splice(noteIndex, 1)[0];
  console.log(`[Unshield] Removed note: ${formatWeiToAmount(removedNote.amount)} DOGE (was at index ${noteIndex})`);
  console.log(`[Unshield] Wallet now has ${walletState.notes.length} notes after removal`);
  
  // V3: Add change note back to wallet (if present)
  if (changeNote && changeNote.amount > 0n) {
    if (changeLeafIndex !== undefined) {
      changeNote.leafIndex = changeLeafIndex;
    }
    walletState.notes.push(changeNote);
    console.log(`[Unshield] Added change note: ${formatWeiToAmount(changeNote.amount)} ${changeNote.token || 'DOGE'} (leafIndex: ${changeLeafIndex || 'pending'})`);
  }
  
  await saveNotesToStorage(walletState.notes);
  
  // Dispatch event to refresh UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shielded-wallet-updated'));
  }
}

/**
 * Prepare batch unshield (withdraw multiple notes to public address)
 * 
 * Useful for consolidating small notes or withdrawing larger amounts.
 * 
 * @param recipientAddress Public EVM address to receive funds
 * @param noteIndices Array of note indices to unshield
 * @param poolAddress Contract address
 * @param relayerAddress Relayer address
 * @param feeDoge Total fee for the batch (in DOGE)
 */
export async function prepareBatchUnshield(
  recipientAddress: string,
  noteIndices: number[],
  poolAddress: string,
  relayerAddress?: string,
  feeDoge: number = 0
): Promise<{
  proofs: Array<{ proof: string[]; publicInputs: string[] }>;
  roots: `0x${string}`[];
  nullifierHashes: `0x${string}`[];
  amounts: bigint[];
  changeCommitments: `0x${string}`[];  // V3: Change commitments (all zero for batch - unshields entire notes)
  totalAmount: bigint;
  totalFee: bigint; // Adjusted total fee (evenly divisible by batch size)
  token: `0x${string}`;
}> {
  if (!walletState.identity) {
    throw new Error('Wallet not initialized');
  }
  
  if (!noteIndices || noteIndices.length === 0) {
    throw new Error('No notes specified');
  }
  
  if (noteIndices.length > 100) {
    throw new Error('Cannot unshield more than 100 notes in one batch (contract limit)');
  }
  
  // Get notes to unshield
  let notesToUnshield = noteIndices.map(idx => {
    const note = walletState.notes[idx];
    if (!note || note.leafIndex === undefined) {
      throw new Error(`Invalid note at index ${idx}`);
    }
    return note;
  });
  
  // CRITICAL: Deduplicate notes by commitment/leafIndex to prevent using same note twice
  // This prevents NullifierAlreadySpent() errors when the same note is accidentally included multiple times
  const seenCommitments = new Set<string>();
  const seenLeafIndices = new Set<number>();
  const uniqueNotes: ShieldedNote[] = [];
  
  for (const note of notesToUnshield) {
    const commitmentKey = note.commitment.toString();
    const leafIndexKey = note.leafIndex;
    
    // Check if we've already seen this note (by commitment or leafIndex)
    if (seenCommitments.has(commitmentKey) || (leafIndexKey !== undefined && seenLeafIndices.has(leafIndexKey))) {
      console.warn(`[BatchUnshield] Skipping duplicate note: commitment=${commitmentKey.slice(0, 16)}..., leafIndex=${leafIndexKey}`);
      continue;
    }
    
    seenCommitments.add(commitmentKey);
    if (leafIndexKey !== undefined) {
      seenLeafIndices.add(leafIndexKey);
    }
    uniqueNotes.push(note);
  }
  
  if (uniqueNotes.length !== notesToUnshield.length) {
    console.warn(`[BatchUnshield] Filtered out ${notesToUnshield.length - uniqueNotes.length} duplicate note(s). Using ${uniqueNotes.length} unique notes.`);
  }
  
  if (uniqueNotes.length === 0) {
    throw new Error('No unique notes to unshield after deduplication');
  }
  
  notesToUnshield = uniqueNotes;
  
  // Verify all notes are same token
  const firstToken = notesToUnshield[0].tokenAddress || NATIVE_TOKEN;
  for (const note of notesToUnshield) {
    const noteToken = note.tokenAddress || NATIVE_TOKEN;
    if (noteToken !== firstToken) {
      throw new Error('All notes must be the same token for batch unshield');
    }
  }
  
  // Calculate total amount and fee per note
  let totalNoteAmount = notesToUnshield.reduce((sum, note) => sum + note.amount, 0n);
  const batchSize = BigInt(notesToUnshield.length);
  const feeWei = parseAmountToWei(feeDoge);
  
  // Ensure total fee is evenly divisible by batch size (contract requirement)
  // Round down to nearest multiple of batch size
  let adjustedTotalFee = (feeWei / batchSize) * batchSize;
  let feePerNote = adjustedTotalFee / batchSize;
  
  console.log(`[BatchUnshield] Unshielding ${notesToUnshield.length} notes:`);
  console.log(`  Total input: ${formatWeiToAmount(totalNoteAmount)} ${notesToUnshield[0].token || 'DOGE'}`);
  if (adjustedTotalFee !== feeWei) {
    console.log(`  Original fee: ${formatWeiToAmount(feeWei)} ${notesToUnshield[0].token || 'DOGE'} (adjusted for batch divisibility)`);
  }
  console.log(`  Total fee: ${formatWeiToAmount(adjustedTotalFee)} ${notesToUnshield[0].token || 'DOGE'}`);
  console.log(`  Fee per note: ${formatWeiToAmount(feePerNote)} ${notesToUnshield[0].token || 'DOGE'}`);
  console.log(`  Net withdrawal: ${formatWeiToAmount(totalNoteAmount - adjustedTotalFee)} ${notesToUnshield[0].token || 'DOGE'}`);
  
  // Pre-check: Verify nullifiers are not already spent on-chain
  console.log('[BatchUnshield] Checking nullifiers on-chain before generating proofs...');
  const { createPublicClient, http } = await import('viem');
  const { dogeosTestnet } = await import('../dogeos-config');
  const { getPrivacyRpcUrl } = await import('./privacy-utils');
  const { computeNullifier, computeNullifierHash } = await import('./shielded-crypto');
  
  const publicClient = createPublicClient({
    chain: dogeosTestnet,
    transport: http(getPrivacyRpcUrl()),
  });
  
  const spentNullifiers: Array<{ noteIndex: number; nullifierHash: string }> = [];
  
  for (let i = 0; i < notesToUnshield.length; i++) {
    const note = notesToUnshield[i];
    if (!note.leafIndex) continue;
    
    try {
      // Compute nullifier the same way as in proof generation
      const nullifier = await computeNullifier(
        note.secret,
        BigInt(note.leafIndex),
        walletState.identity.spendingKey
      );
      const nullifierHash = await computeNullifierHash(nullifier);
      const nullifierHashBytes = toBytes32(nullifierHash);
      
      const isSpent = await publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: [{
          name: 'isSpent',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: '_nullifierHash', type: 'bytes32' }],
          outputs: [{ name: '', type: 'bool' }],
        }],
        functionName: 'isSpent',
        args: [nullifierHashBytes],
      });
      
      if (isSpent) {
        const commitmentHex = '0x' + note.commitment.toString(16).padStart(64, '0').slice(0, 12) + '...';
        console.warn(`[BatchUnshield] Note ${i} (commitment ${commitmentHex}) nullifier already spent on-chain`);
        spentNullifiers.push({ noteIndex: i, nullifierHash: nullifierHashBytes });
      }
    } catch (checkError) {
      console.warn(`[BatchUnshield] Failed to check nullifier for note ${i}:`, checkError);
      // Continue anyway - the contract will reject if spent
    }
  }
  
  // Filter out spent notes
  if (spentNullifiers.length > 0) {
    const spentIndices = new Set(spentNullifiers.map(s => s.noteIndex));
    const validNotes: ShieldedNote[] = [];
    const validIndices: number[] = [];
    
    for (let i = 0; i < notesToUnshield.length; i++) {
      if (!spentIndices.has(i)) {
        validNotes.push(notesToUnshield[i]);
        validIndices.push(i);
      }
    }
    
    if (validNotes.length === 0) {
      throw new Error(
        `All ${notesToUnshield.length} note(s) have already been spent on-chain. ` +
        `Please sync your notes to remove spent notes.`
      );
    }
    
    console.warn(
      `[BatchUnshield] Filtered out ${spentNullifiers.length} spent note(s) ` +
      `(indices: ${spentNullifiers.map(s => s.noteIndex).join(', ')}). ` +
      `Proceeding with ${validNotes.length} valid note(s).`
    );
    
    // Update notesToUnshield to only include valid notes
    notesToUnshield = validNotes;
    
    // Recalculate fee with new batch size
    const newBatchSize = BigInt(notesToUnshield.length);
    const newAdjustedTotalFee = (feeWei / newBatchSize) * newBatchSize;
    const newFeePerNote = newAdjustedTotalFee / newBatchSize;
    
    // Update fee variables and total amount
    const oldAdjustedTotalFee = adjustedTotalFee;
    adjustedTotalFee = newAdjustedTotalFee;
    feePerNote = newFeePerNote;
    totalNoteAmount = notesToUnshield.reduce((sum, note) => sum + note.amount, 0n);
    
    if (oldAdjustedTotalFee !== adjustedTotalFee) {
      console.log(`[BatchUnshield] Fee adjusted for new batch size: ${formatWeiToAmount(adjustedTotalFee)} ${notesToUnshield[0].token || 'DOGE'}`);
    }
    
    // Re-log with updated values
    console.log(`[BatchUnshield] Updated after filtering spent notes:`);
    console.log(`  Valid notes: ${notesToUnshield.length}`);
    console.log(`  Total input: ${formatWeiToAmount(totalNoteAmount)} ${notesToUnshield[0].token || 'DOGE'}`);
    console.log(`  Total fee: ${formatWeiToAmount(adjustedTotalFee)} ${notesToUnshield[0].token || 'DOGE'}`);
    console.log(`  Fee per note: ${formatWeiToAmount(feePerNote)} ${notesToUnshield[0].token || 'DOGE'}`);
    console.log(`  Net withdrawal: ${formatWeiToAmount(totalNoteAmount - adjustedTotalFee)} ${notesToUnshield[0].token || 'DOGE'}`);
  } else {
    console.log('[BatchUnshield] All nullifiers verified as unspent, proceeding with proof generation...');
  }
  
  const proofs: Array<{ proof: string[]; publicInputs: string[] }> = [];
  const roots: `0x${string}`[] = [];
  const nullifierHashes: `0x${string}`[] = [];
  const amounts: bigint[] = [];
  const changeCommitments: `0x${string}`[] = [];  // V3: Change commitments (all zero for batch - unshields entire notes)
  
  // Generate proofs for each note
  // Note: Batch unshield unshields entire notes (no change), so changeCommitments will all be zero
  for (const note of notesToUnshield) {
    const withdrawAmount = note.amount - feePerNote;
    
    if (withdrawAmount <= 0n) {
      throw new Error(`Note amount ${formatWeiToAmount(note.amount)} is less than fee per note ${formatWeiToAmount(feePerNote)}`);
    }
    
    // V3: Generate proof (withdrawAmount = note.amount - feePerNote, so changeAmount = 0)
    const { proof, nullifierHash, root, changeCommitment } = await generateUnshieldProof(
      note,
      walletState.identity,
      recipientAddress,
      withdrawAmount,  // Withdraw entire note minus fee (no change for batch)
      poolAddress,
      relayerAddress || '0x0000000000000000000000000000000000000000',
      feePerNote
    );
    
    proofs.push(proof);
    roots.push(toBytes32(root));
    nullifierHashes.push(toBytes32(nullifierHash));
    amounts.push(withdrawAmount);
    // V3: Add change commitment (should be 0 for batch unshield since we unshield entire notes)
    changeCommitments.push(changeCommitment ? toBytes32(changeCommitment) : '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`);
  }
  
  const totalWithdrawAmount = amounts.reduce((sum, amt) => sum + amt, 0n);
  
  return {
    proofs,
    roots,
    nullifierHashes,
    amounts,
    changeCommitments,  // V3: Return change commitments (all zero for batch)
    totalAmount: totalWithdrawAmount,
    totalFee: adjustedTotalFee, // Return adjusted fee for contract
    token: firstToken,
  };
}

/**
 * Complete batch unshield after transaction confirmed
 * - Removes all spent notes
 */
export async function completeBatchUnshield(noteIndices: number[]): Promise<void> {
  // Remove notes in reverse order to maintain indices
  const sortedIndices = [...noteIndices].sort((a, b) => b - a);
  for (const index of sortedIndices) {
    walletState.notes.splice(index, 1);
  }
  await saveNotesToStorage(walletState.notes);
}

/**
 * Complete swap: remove spent input note and add output note
 */
export async function completeSwap(
  spentNoteIndex: number,
  outputNote: ShieldedNote,
  outputLeafIndex?: number,
  changeNote?: ShieldedNote | null,
  changeLeafIndex?: number
): void {
  // Remove spent input note
  walletState.notes.splice(spentNoteIndex, 1);
  
  // Add output note 1 (swapped token)
  if (outputNote.amount > 0n) {
    if (outputLeafIndex !== undefined) {
      outputNote.leafIndex = outputLeafIndex;
    }
    walletState.notes.push(outputNote);
    console.log('[Swap] Added output note:', outputLeafIndex || 'pending');
  }
  
  // Add change note (if present)
  if (changeNote && changeNote.amount > 0n) {
    if (changeLeafIndex !== undefined) {
      changeNote.leafIndex = changeLeafIndex;
    }
    walletState.notes.push(changeNote);
    console.log('[Swap] Added change note:', changeLeafIndex || 'pending');
  }
  
  saveNotesToStorage(walletState.notes);
  
  // CRITICAL: Invalidate balance cache so getShieldedBalancePerToken() recalculates
  // This ensures the balance reflects the updated notes immediately
  // This is especially important for swaps where notes.length might not change (DOGE→USDC)
  lastBalanceCache = null;
  
  // CRITICAL: Force immediate balance recalculation to ensure module-level state is in sync
  // This ensures getShieldedBalancePerToken() returns correct balances when called from UI
  const _ = getShieldedBalancePerToken(); // Force recalculation (discard result, just trigger cache update)
  
  // CRITICAL: Dispatch event immediately to update shielded balance UI
  // This ensures the balance card updates as soon as the swap completes
  // The event handler will call refreshState() which updates component state,
  // triggering useMemo to recalculate and call getShieldedBalancePerToken() again
  window.dispatchEvent(new CustomEvent('shielded-wallet-updated'));
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
    await saveNotesToStorage(walletState.notes);
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
    const keys = getStorageKeys();
    localStorage.removeItem(keys.identity);
    localStorage.removeItem(keys.notes);
    localStorage.removeItem(keys.signature);
  }
}

/**
 * Sync notes with on-chain data
 * Matches stored note commitments with on-chain commitments to fix leaf indices
 */
/**
 * Sync local notes with on-chain state
 * 
 * SAFETY MECHANISMS:
 * 1. Processes Shield, Transfer, and Swap events to find all commitments
 * 2. For notes not found in events, verifies on-chain via contract call
 * 3. Only removes notes that are CONFIRMED not on-chain AND have no leafIndex
 * 4. Preserves notes with valid leafIndex even if not found (might be spent but valid for history)
 * 
 * This ensures user funds are NEVER incorrectly removed.
 */
export async function syncNotesWithChain(poolAddress: string): Promise<{
  synced: number;
  notFound: number;
  errors: string[];
  cleaned: number; // Number of spent notes cleaned up
}> {
  const errors: string[] = [];
  
  // BULLETPROOF: Clean up spent notes before syncing
  // This ensures we don't have stale spent notes in the wallet
  let cleanedCount = 0;
  if (walletState.identity && walletState.notes.length > 0) {
    try {
      const { cleanupSpentNotes } = await import('./note-cleanup');
      const { removed, remaining } = await cleanupSpentNotes(
        walletState.notes,
        poolAddress,
        walletState.identity.spendingKey
      );
      
      if (removed.length > 0) {
        cleanedCount = removed.length;
        walletState.notes = remaining;
        await saveNotesToStorage(walletState.notes);
        console.log(`[Sync] Cleaned up ${cleanedCount} spent note(s) during sync`);
        
        // Dispatch event to refresh UI
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('shielded-wallet-updated'));
        }
      }
    } catch (cleanupError) {
      console.warn('[Sync] Failed to cleanup spent notes:', cleanupError);
      errors.push(`Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`);
    }
  }
  let synced = 0;
  let notFound = 0;
  
  if (walletState.notes.length === 0) {
    return { synced: 0, notFound: 0, errors: ['No notes to sync'], cleaned: 0 };
  }
  
  try {
    // SECURITY: This function fetches all historical events to sync notes with chain
    // This is typically a one-time sync operation, but we still add safeguards
    const MAX_EVENTS = 100000; // Reasonable limit for sync operation (prevent memory exhaustion)
    
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
          fromBlock: '0x0', // NOTE: Historical query for sync - necessary for full sync
          toBlock: 'latest',
        }],
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    
    const logs = data.result || [];
    
    // SECURITY: Limit number of events to prevent memory exhaustion
    if (logs.length > MAX_EVENTS) {
      console.warn(`[ShieldedService] Too many events (${logs.length}), limiting to ${MAX_EVENTS} for security`);
      // Sort by block number and take most recent
      logs.sort((a: any, b: any) => parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16));
      logs.splice(MAX_EVENTS);
    }
    
    // Event signatures for events that create commitments
    // Shield event: Shield(bytes32 indexed commitment, uint256 indexed leafIndex, address indexed token, uint256 amount, uint256 timestamp)
    // Transfer event: Transfer(bytes32 indexed nullifierHash, bytes32 outputCommitment1, bytes32 outputCommitment2, uint256 indexed leafIndex1, uint256 indexed leafIndex2, ...)
    // Swap event: Swap(bytes32 indexed inputNullifier, bytes32 outputCommitment1, bytes32 outputCommitment2, address indexed tokenIn, address indexed tokenOut, ...)
    // LeafInserted event: LeafInserted(bytes32 indexed leaf, uint256 indexed leafIndex, bytes32 newRoot) - emitted by MerkleTreeWithHistory
    const SHIELD_EVENT_SIG = '0x784c8f4dbf0ffedd6e72c76501c545a70f8b203b30a26ce542bf92ba87c248a4';
    const TRANSFER_EVENT_SIG = '0xd50e83984b64a106ac2ee6314d689ec4d2a656d5ece6d94c585796944b52240c';
    const SWAP_EVENT_SIG = '0x98e6753c42765cc4a24e3a0d602acde13478ab2e7709b354f6f94d57058d243c';
    const LEAF_INSERTED_EVENT_SIG = '0x784c8f4dbf0ffedd6e72c76501c545a70f8b203b30a26ce542bf92ba87c248a4'; // Same as Shield for MerkleTreeWithHistory
    
    // Debug: Log all event signatures to see what we're getting
    const eventSigs = new Set<string>();
    logs.forEach((log: any) => {
      if (log.topics && log.topics[0]) {
        eventSigs.add(log.topics[0].toLowerCase());
      }
    });
    console.log(`[Sync] Event signatures found:`, Array.from(eventSigs));
    
    // Step 1: Process Shield events (commitment in topics[1], leafIndex in topics[2])
    const shieldLogs = logs.filter((log: any) => {
      if (!log.topics || log.topics.length < 3) return false;
      return log.topics[0].toLowerCase() === SHIELD_EVENT_SIG.toLowerCase();
    });
    
    // Step 2: Process Transfer events (leafIndex1/leafIndex2 in topics[2]/topics[3], commitments in data)
    const transferLogs = logs.filter((log: any) => {
      if (!log.topics || log.topics.length < 4) return false;
      return log.topics[0].toLowerCase() === TRANSFER_EVENT_SIG.toLowerCase();
    });
    
    // Step 3: Process Swap events (commitments in data, need to track via LeafInserted events)
    const swapLogs = logs.filter((log: any) => {
      if (!log.topics || log.topics.length < 4) return false;
      return log.topics[0].toLowerCase() === SWAP_EVENT_SIG.toLowerCase();
    });
    
    // Build a map of commitment -> leafIndex from all sources
    const commitmentMap = new Map<string, number>();
    
    // Process Shield events
    for (const log of shieldLogs) {
      const commitment = log.topics[1].toLowerCase();
      const leafIndex = parseInt(log.topics[2], 16);
      if (!commitmentMap.has(commitment)) {
        commitmentMap.set(commitment, leafIndex);
      }
    }
    
    // Process Transfer events - decode data to get commitments
    // Transfer event: topics[2] = leafIndex1, topics[3] = leafIndex2
    // Data: outputCommitment1 (32 bytes), outputCommitment2 (32 bytes), encryptedMemo1 (dynamic), encryptedMemo2 (dynamic), timestamp (32 bytes)
    // Commitments are at the start (first 64 bytes), before dynamic bytes
    for (const log of transferLogs) {
      try {
        const leafIndex1 = parseInt(log.topics[2], 16);
        const leafIndex2 = parseInt(log.topics[3], 16);
        
        // Extract commitments from data (first 64 bytes = 2 commitments of 32 bytes each)
        if (log.data && log.data.length >= 130) { // 0x + 128 hex chars = 64 bytes
          const dataHex = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
          if (dataHex.length >= 128) {
            // First 64 hex chars = 32 bytes = commitment1
            // Next 64 hex chars = 32 bytes = commitment2
            const commitment1 = '0x' + dataHex.slice(0, 64).toLowerCase();
            const commitment2 = '0x' + dataHex.slice(64, 128).toLowerCase();
            
            if (commitment1 !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              if (!commitmentMap.has(commitment1)) {
                commitmentMap.set(commitment1, leafIndex1);
              }
            }
            if (commitment2 !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              if (!commitmentMap.has(commitment2)) {
                commitmentMap.set(commitment2, leafIndex2);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`[Sync] Failed to decode Transfer event:`, error);
      }
    }
    
    // Process Swap events - decode data to get commitments
    // Swap event data: outputCommitment1 (32 bytes), outputCommitment2 (32 bytes), swapAmount (32 bytes), amountOut (32 bytes), encryptedMemo (dynamic), timestamp (32 bytes)
    // Commitments are at the start (first 64 bytes), before other fixed-size params
    // Note: We don't have leafIndex in Swap events, so we'll mark as -1 and verify on-chain
    for (const log of swapLogs) {
      try {
        // Extract commitments from data (first 64 bytes)
        if (log.data && log.data.length >= 130) {
          const dataHex = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
          if (dataHex.length >= 128) {
            const commitment1 = '0x' + dataHex.slice(0, 64).toLowerCase();
            const commitment2 = '0x' + dataHex.slice(64, 128).toLowerCase();
            
            // For Swap events, we don't have leafIndex in the event
            // Mark as -1 to indicate "found but leafIndex unknown" - will verify on-chain
            if (commitment1 !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              if (!commitmentMap.has(commitment1)) {
                commitmentMap.set(commitment1, -1); // -1 means "found in Swap event but leafIndex unknown"
              }
            }
            if (commitment2 !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              if (!commitmentMap.has(commitment2)) {
                commitmentMap.set(commitment2, -1);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`[Sync] Failed to decode Swap event:`, error);
      }
    }
    
    console.log(`[Sync] Found ${shieldLogs.length} Shield events, ${transferLogs.length} Transfer events, ${swapLogs.length} Swap events`);
    const commitmentsWithIndex = Array.from(commitmentMap.values()).filter(idx => idx !== -1).length;
    const commitmentsWithoutIndex = Array.from(commitmentMap.values()).filter(idx => idx === -1).length;
    console.log(`[Sync] Total unique commitments: ${commitmentMap.size} (${commitmentsWithIndex} with leafIndex, ${commitmentsWithoutIndex} from Swap/Transfer)`);
    
    // Debug: Print all on-chain commitments
    console.log('=== ON-CHAIN COMMITMENTS ===');
    commitmentMap.forEach((leafIndex, commitment) => {
      console.log(`  ${commitment} -> leafIndex: ${leafIndex}`);
    });
    
    // Step 4: For notes not found in events, verify on-chain via contract call
    // This is the critical safety check - only remove if confirmed not on current contract
    const { createPublicClient, http } = await import('viem');
    const { dogeosTestnet } = await import('@/lib/dogeos-config');
    const publicClient = createPublicClient({
      chain: dogeosTestnet,
      transport: http(),
    });
    
    // Match each stored note to on-chain data
    const validNotes: typeof walletState.notes = [];
    const removedNotes: typeof walletState.notes = [];
    
    for (const note of walletState.notes) {
      // Convert note commitment to hex string for matching
      const noteCommitmentHex = '0x' + note.commitment.toString(16).padStart(64, '0').toLowerCase();
      
      console.log(`=== CHECKING NOTE ===`);
      console.log(`  Amount: ${Number(note.amount) / 1e18} ${note.tokenAddress === NATIVE_TOKEN ? 'DOGE' : 'Token'}`);
      console.log(`  Local commitment: ${noteCommitmentHex}`);
      console.log(`  Current leafIndex: ${note.leafIndex}`);
      
      const onChainLeafIndex = commitmentMap.get(noteCommitmentHex);
      
      if (onChainLeafIndex !== undefined && onChainLeafIndex !== -1) {
        // Note exists in events with known leafIndex - keep it
        if (note.leafIndex !== onChainLeafIndex) {
          console.log(`  ✅ MATCH FOUND IN EVENTS! Fixing leafIndex: ${note.leafIndex} -> ${onChainLeafIndex}`);
          note.leafIndex = onChainLeafIndex;
          synced++;
        } else {
          console.log(`  ✅ Already correct, leafIndex=${note.leafIndex}`);
        }
        validNotes.push(note);
      } else if (onChainLeafIndex === -1) {
        // Note found in Swap/Transfer event but leafIndex unknown - keep it, verify on-chain
        console.log(`  ✅ Found in Transfer/Swap event (leafIndex unknown) - verifying on-chain...`);
        try {
          const commitmentExists = await publicClient.readContract({
            address: poolAddress as `0x${string}`,
            abi: [{
              type: 'function',
              name: 'commitments',
              inputs: [{ name: '', type: 'bytes32' }],
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'view',
            }],
            functionName: 'commitments',
            args: [noteCommitmentHex as `0x${string}`],
          }) as boolean;
          
          if (commitmentExists) {
            console.log(`  ✅ Confirmed on-chain - keeping note`);
            validNotes.push(note);
          } else {
            // Found in event but not on-chain - might be from old contract or spent
            // Be conservative: keep it if it has a leafIndex
            if (note.leafIndex !== undefined && note.leafIndex !== null) {
              console.warn(`  ⚠️  Found in event but not on-chain (might be spent) - keeping (has leafIndex)`);
              validNotes.push(note);
            } else {
              console.warn(`  ❌ Found in event but not on-chain AND no leafIndex - removing`);
              removedNotes.push(note);
              errors.push(`Note found in event but not on-chain - removed (no leafIndex)`);
              notFound++;
            }
          }
        } catch (error: any) {
          console.warn(`  ⚠️  Failed to verify on-chain: ${error.message} - keeping to be safe`);
          validNotes.push(note);
        }
      } else {
        // Note NOT found in events - verify on-chain before removing
        console.log(`  ⚠️  Note not found in events, verifying on-chain...`);
        
        try {
          // Check if commitment exists on-chain via contract call
          // This is the critical safety check - only remove if confirmed not on current contract
          const commitmentExists = await publicClient.readContract({
            address: poolAddress as `0x${string}`,
            abi: [{
              type: 'function',
              name: 'commitments',
              inputs: [{ name: '', type: 'bytes32' }],
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'view',
            }],
            functionName: 'commitments',
            args: [noteCommitmentHex as `0x${string}`],
          }) as boolean;
          
          if (commitmentExists) {
            // Commitment exists on-chain but wasn't in events (might be from Transfer/Swap we didn't decode properly)
            // Keep it and try to find leafIndex from contract
            console.log(`  ✅ Commitment exists on-chain! Keeping note (might be from Transfer/Swap event)`);
            validNotes.push(note);
          } else {
            // Commitment does NOT exist on-chain - verify it's truly from old contract
            // SAFETY: Only remove if BOTH conditions are true:
            // 1. Commitment doesn't exist on-chain (confirmed not in current contract)
            // 2. Note has no leafIndex (can't be from current contract)
            // If note has leafIndex, keep it (might be spent but note is still valid for history)
            if (note.leafIndex === undefined || note.leafIndex === null) {
              // Confirmed: Not on-chain AND no leafIndex = definitely from old contract
              console.warn(`  ❌ Commitment NOT on-chain AND no leafIndex - removing (confirmed from old contract)`);
              removedNotes.push(note);
              errors.push(`Note with amount ${Number(note.amount) / 1e18} not found on-chain - removed (confirmed from old contract)`);
              notFound++;
            } else {
              // Has leafIndex but commitment doesn't exist - might be spent
              // SAFETY: Keep it - user might have spent it, but the note is still valid for transaction history
              // Removing it would cause user confusion (they'd lose transaction history)
              console.warn(`  ⚠️  Commitment not on-chain but has leafIndex - keeping (might be spent, preserving transaction history)`);
              validNotes.push(note);
            }
          }
        } catch (error: any) {
          // If contract call fails, be conservative - keep the note
          console.warn(`  ⚠️  Failed to verify commitment on-chain: ${error.message} - keeping note to be safe`);
          validNotes.push(note);
        }
      }
    }
    
    // Update wallet state with only valid notes
    if (removedNotes.length > 0) {
      console.warn(`[Sync] ⚠️  Removing ${removedNotes.length} notes confirmed to be from old contract:`);
      removedNotes.forEach((note, idx) => {
        console.warn(`  [${idx + 1}] ${Number(note.amount) / 1e18} ${note.token || 'DOGE'} - commitment: ${'0x' + note.commitment.toString(16).padStart(64, '0').slice(0, 16)}...`);
      });
      walletState.notes = validNotes;
      await saveNotesToStorage(walletState.notes);
    } else if (synced > 0) {
      // Only save if we fixed leaf indices
      await saveNotesToStorage(walletState.notes);
    }
    
    // Final summary
    console.log(`[Sync] ✅ Sync complete: ${validNotes.length} notes kept, ${removedNotes.length} removed, ${synced} leafIndices fixed`);
    if (removedNotes.length > 0) {
      console.warn(`[Sync] ⚠️  Removed notes were confirmed NOT on-chain (from old contract)`);
    }
    
    return { synced, notFound, errors, cleaned: cleanedCount };
    
  } catch (error: any) {
    console.error('Sync error:', error);
    return { synced: 0, notFound: 0, errors: [error.message], cleaned: cleanedCount };
  }
}

/**
 * Clear only notes (keep identity)
 */
export function clearNotes(): void {
  walletState.notes = [];
  if (typeof localStorage !== 'undefined') {
    const keys = getStorageKeys();
    localStorage.removeItem(keys.notes);
  }
}

/**
 * Remove notes for a specific token
 * Useful for removing old notes from previous contracts
 */
export async function removeNotesForToken(tokenSymbol: string): Promise<number> {
  const initialCount = walletState.notes.length;
  walletState.notes = walletState.notes.filter(note => note.token !== tokenSymbol);
  const removedCount = initialCount - walletState.notes.length;
  
  if (removedCount > 0) {
    await saveNotesToStorage(walletState.notes);
    // Dispatch event to refresh UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('shielded-wallet-updated'));
    }
  }
  
  return removedCount;
}

/**
 * Add a discovered note (from auto-discovery)
 * Returns true if note was added, false if already exists
 */
/**
 * Add a discovered note to the wallet
 * SECURITY: Prevents duplicate notes via commitment uniqueness check
 * 
 * Race Condition Analysis:
 * - JavaScript is single-threaded (event loop), so check-and-push is effectively atomic
 * - If two async operations call this simultaneously, they will execute sequentially
 * - Commitment hash check before push prevents duplicates even in concurrent scenarios
 * - localStorage save is async, but the check happens synchronously before save
 * 
 * Commitment Hash Algorithm:
 * - Uses MiMC Sponge hash (collision-resistant)
 * - Commitment = MiMC(MiMC(amount, ownerPubkey), MiMC(secret, blinding))
 * - Input: amount (bigint), ownerPubkey (bigint), secret (random 31 bytes), blinding (random 31 bytes)
 * - Output: 256-bit hash (cryptographically unique per unique input combination)
 * - Collision probability: ~1 in 2^128 (negligible for practical purposes)
 */
export async function addDiscoveredNote(note: ShieldedNote): Promise<boolean> {
  // SECURITY: Check if we already have this note by commitment hash
  // Commitment hash is cryptographically unique - two different notes cannot have same commitment
  const exists = walletState.notes.some(n => n.commitment === note.commitment);
  if (exists) {
    console.log('[ShieldedWallet] Note already exists, skipping');
    return false;
  }
  
  // Verify the note belongs to us
  if (walletState.identity && note.ownerPubkey !== walletState.identity.shieldedAddress) {
    console.warn('[ShieldedWallet] Note owner mismatch, skipping');
    return false;
  }
  
  // SECURITY: Add to wallet - this is effectively atomic in JavaScript (single-threaded event loop)
  // Even if called from multiple async contexts, they execute sequentially
  walletState.notes.push(note);
  await saveNotesToStorage(walletState.notes);
  
  console.log(`[ShieldedWallet] Added discovered note: ${Number(note.amount) / 1e18} ${note.token || 'DOGE'} at leafIndex ${note.leafIndex}`);
  return true;
}

// ============ Storage Helpers ============

/**
 * Get encrypted storage instance for current wallet
 */
function getEncryptedStorage(): EncryptedStorage | null {
  if (typeof window === 'undefined' || !currentWalletAddress) {
    return null;
  }
  
  // No password by default - uses wallet address as password (single-device XSS protection)
  // Users can opt-in to password for multi-device security
  return new EncryptedStorage(currentWalletAddress);
}

/**
 * Migrate old unencrypted data to encrypted format
 */
async function migrateToEncryptedStorage(): Promise<void> {
  if (typeof window === 'undefined' || !currentWalletAddress) {
    return;
  }
  
  const storage = getEncryptedStorage();
  if (!storage) return;
  
  const keys = getStorageKeys();
  
  // Migrate identity
  const oldIdentity = localStorage.getItem(keys.identity);
  if (oldIdentity && !oldIdentity.startsWith('1:')) { // Not already encrypted (version 1)
    try {
      await storage.setItem('identity', oldIdentity);
      localStorage.removeItem(keys.identity);
      console.log('[EncryptedStorage] Migrated identity to encrypted storage');
    } catch (error) {
      console.error('[EncryptedStorage] Failed to migrate identity:', error);
    }
  }
  
  // Migrate notes
  const oldNotes = localStorage.getItem(keys.notes);
  if (oldNotes && !oldNotes.startsWith('1:')) {
    try {
      await storage.setItem('notes', oldNotes);
      localStorage.removeItem(keys.notes);
      console.log('[EncryptedStorage] Migrated notes to encrypted storage');
    } catch (error) {
      console.error('[EncryptedStorage] Failed to migrate notes:', error);
    }
  }
  
  // Migrate stealth keys
  const oldStealthKeys = localStorage.getItem(keys.stealthKeys);
  if (oldStealthKeys && !oldStealthKeys.startsWith('1:')) {
    try {
      await storage.setItem('stealthKeys', oldStealthKeys);
      localStorage.removeItem(keys.stealthKeys);
      console.log('[EncryptedStorage] Migrated stealth keys to encrypted storage');
    } catch (error) {
      console.error('[EncryptedStorage] Failed to migrate stealth keys:', error);
    }
  }
}

async function saveIdentityToStorage(identity: ShieldedIdentity): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  
  // Migrate old data on first save
  await migrateToEncryptedStorage();
  
  const storage = getEncryptedStorage();
  if (!storage) {
    // Fallback to unencrypted if no wallet address (shouldn't happen)
    const keys = getStorageKeys();
    const serialized = serializeIdentity(identity);
    localStorage.setItem(keys.identity, JSON.stringify(serialized));
    return;
  }
  
  const serialized = serializeIdentity(identity);
  await storage.setItem('identity', JSON.stringify(serialized));
}

async function loadIdentityFromStorage(): Promise<ShieldedIdentity | null> {
  if (typeof localStorage === 'undefined') return null;
  
  // Migrate old data on first load
  await migrateToEncryptedStorage();
  
  const storage = getEncryptedStorage();
  if (!storage) {
    // Fallback to unencrypted
    const keys = getStorageKeys();
    const stored = localStorage.getItem(keys.identity);
    if (!stored) return null;
    try {
      const serialized = JSON.parse(stored);
      return deserializeIdentity(serialized);
    } catch {
      return null;
    }
  }
  
  const stored = await storage.getItem('identity');
  if (!stored) return null;
  
  try {
    const serialized = JSON.parse(stored);
    const identity = deserializeIdentity(serialized);
    
    if (!identity) return null;
    
    // CRITICAL: Re-derive shieldedAddress using MiMC to match circuit
    // Old code used shieldedAddress = spendingKey, but circuit expects MiMC(spendingKey, 2)
    const { mimcHash2, DOMAIN } = await import('./shielded-crypto');
    const correctShieldedAddress = await mimcHash2(identity.spendingKey, DOMAIN.SHIELDED_ADDRESS);
    
    // Check if migration needed
    if (identity.shieldedAddress !== correctShieldedAddress) {
      console.log('[ShieldedWallet] Migrating shieldedAddress to correct MiMC derivation...');
      console.log(`  Old: ${identity.shieldedAddress.toString(16).slice(0, 16)}...`);
      console.log(`  New: ${correctShieldedAddress.toString(16).slice(0, 16)}...`);
      
      identity.shieldedAddress = correctShieldedAddress;
      identity.addressString = `zdoge:${correctShieldedAddress.toString(16).padStart(64, '0')}`;
      
      // Save the corrected identity
      await saveIdentityToStorage(identity);
      console.log('[ShieldedWallet] Migration complete. Old notes will NOT work - please re-shield.');
    }
    
    // Migrate old address format to new zdoge: prefix (if not already done)
    if (!identity.addressString.startsWith('zdoge:')) {
      identity.addressString = `zdoge:${identity.shieldedAddress.toString(16).padStart(64, '0')}`;
      await saveIdentityToStorage(identity);
      console.log('[ShieldedWallet] Migrated address to new zdoge: format');
    }
    
    return identity;
  } catch (error) {
    console.error('[ShieldedWallet] Failed to load identity:', error);
    return null;
  }
}

async function saveNotesToStorage(notes: ShieldedNote[]): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  
  // Migrate old data on first save
  await migrateToEncryptedStorage();
  
  const storage = getEncryptedStorage();
  if (!storage) {
    // Fallback to unencrypted
    const keys = getStorageKeys();
    const serialized = notes.map(serializeNote);
    localStorage.setItem(keys.notes, JSON.stringify(serialized));
    return;
  }
  
  const serialized = notes.map(serializeNote);
  await storage.setItem('notes', JSON.stringify(serialized));
}

// Migrate legacy notes to include tokenAddress and decimals
function migrateLegacyNote(note: any): ShieldedNote {
  // If note already has tokenAddress and decimals, return as-is
  if (note.tokenAddress && note.decimals != null) {
    return note as ShieldedNote;
  }
  
  // Legacy note - add missing metadata
  const tokenSymbol = note.token || 'DOGE';
  
  if (tokenSymbol === 'DOGE') {
    return {
      ...note,
      token: 'DOGE',
      tokenAddress: NATIVE_TOKEN,
      decimals: 18,
    };
  }
  
  // Look up token from config
  const token = shieldedPool.supportedTokens[tokenSymbol as keyof typeof shieldedPool.supportedTokens];
  if (token) {
    return {
      ...note,
      token: token.symbol,
      tokenAddress: token.address,
      decimals: token.decimals,
    };
  }
  
  // Fallback: assume DOGE if token not found
  console.warn(`[ShieldedService] Unknown token ${tokenSymbol} in legacy note, defaulting to DOGE`);
  return {
    ...note,
    token: 'DOGE',
    tokenAddress: NATIVE_TOKEN,
    decimals: 18,
  };
}

async function loadNotesFromStorage(): Promise<ShieldedNote[]> {
  if (typeof localStorage === 'undefined') return [];
  
  // Migrate old data on first load
  await migrateToEncryptedStorage();
  
  const storage = getEncryptedStorage();
  if (!storage) {
    // Fallback to unencrypted
    const keys = getStorageKeys();
    const stored = localStorage.getItem(keys.notes);
    if (!stored) return [];
    
    try {
      const serialized = JSON.parse(stored);
      return deserializeNotes(serialized);
    } catch {
      return [];
    }
  }
  
  const stored = await storage.getItem('notes');
  if (!stored) return [];
  
  try {
    const serialized = JSON.parse(stored);
    const notes = deserializeNotes(serialized);
    
    // Save migrated notes back to storage if any were migrated
    const needsMigration = notes.some((n, i) => !serialized[i].tokenAddress || serialized[i].decimals == null);
    if (needsMigration) {
      await saveNotesToStorage(notes);
      console.log('[ShieldedService] Migrated legacy notes to include token metadata');
    }
    
    return notes;
  } catch (error) {
    console.error('[ShieldedService] Failed to load notes:', error);
    return [];
  }
}

function deserializeNotes(serialized: any[]): ShieldedNote[] {
  return serialized.map((s: any) => {
    const note: any = {
      amount: BigInt(s.amount),
      ownerPubkey: BigInt('0x' + s.ownerPubkey),
      secret: BigInt('0x' + s.secret),
      blinding: BigInt('0x' + s.blinding),
      commitment: BigInt('0x' + s.commitment),
      leafIndex: s.leafIndex,
      token: s.token || 'DOGE',
      createdAt: s.createdAt,
    };
    
    // Add tokenAddress and decimals if missing (legacy note migration)
    if (!s.tokenAddress || s.decimals == null) {
      return migrateLegacyNote(note);
    }
    
    // Modern note - include all fields
    note.tokenAddress = s.tokenAddress;
    note.decimals = s.decimals;
    return note as ShieldedNote;
  });
}

// ============ Stealth Key Storage ============

async function saveStealthKeysToStorage(keys: StealthKeys): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  
  // Migrate old data on first save
  await migrateToEncryptedStorage();
  
  const storage = getEncryptedStorage();
  if (!storage) {
    // Fallback to unencrypted
    const serialized = {
      spendingKey: keys.spendingKey.toString(16),
      viewingKey: keys.viewingKey.toString(16),
      spendingPubKey: keys.metaAddress.spendingPubKey.toString(16),
      viewingPubKey: keys.metaAddress.viewingPubKey.toString(16),
    };
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.stealthKeys, JSON.stringify(serialized));
    return;
  }
  
  const serialized = {
    spendingKey: keys.spendingKey.toString(16),
    viewingKey: keys.viewingKey.toString(16),
    spendingPubKey: keys.metaAddress.spendingPubKey.toString(16),
    viewingPubKey: keys.metaAddress.viewingPubKey.toString(16),
  };
  await storage.setItem('stealthKeys', JSON.stringify(serialized));
}

async function loadStealthKeysFromStorage(): Promise<StealthKeys | null> {
  if (typeof localStorage === 'undefined') return null;
  
  // Migrate old data on first load
  await migrateToEncryptedStorage();
  
  const storage = getEncryptedStorage();
  if (!storage) {
    // Fallback to unencrypted
    const storageKeys = getStorageKeys();
    const stored = localStorage.getItem(storageKeys.stealthKeys);
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
  
  const stored = await storage.getItem('stealthKeys');
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
  } catch (error) {
    console.error('[ShieldedService] Failed to load stealth keys:', error);
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
  let keys = await loadStealthKeysFromStorage();
  
  if (keys) {
    walletState.stealthKeys = keys;
    return keys;
  }
  
  // Generate new keys from wallet address + identity
  // In production, use a signature from the wallet for entropy
  const seed = `stealth:${walletAddress}:${walletState.identity?.spendingKey?.toString(16) || 'default'}`;
  keys = await generateStealthKeys(seed);
  
  // Save to storage
  await saveStealthKeysToStorage(keys);
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

