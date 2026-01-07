/**
 * Shielded Note System for Dogenado
 * 
 * A note represents shielded value. It's like a UTXO but private.
 * 
 * Note structure:
 * - amount: The value (in wei for native DOGE)
 * - ownerPubkey: The shielded address that owns this note
 * - secret: Random value known only to owner
 * - blinding: Additional randomness for hiding
 * 
 * Commitment (on-chain): C = MiMC(MiMC(amount, ownerPubkey), MiMC(secret, blinding))
 * Nullifier (for spending): N = MiMC(MiMC(secret, leafIndex), spendingKey)
 */

import {
  randomFieldElement,
  computeCommitment,
  computeNullifier,
  computeNullifierHash,
  toBytes32,
  FIELD_SIZE,
} from './shielded-crypto';

/**
 * A shielded note containing private value
 */
export interface ShieldedNote {
  // Value
  amount: bigint;           // Amount in token base units (e.g., wei for 18 decimals)
  
  // Ownership
  ownerPubkey: bigint;      // Shielded address that owns this note
  
  // Randomness (for privacy)
  secret: bigint;           // Random secret
  blinding: bigint;         // Random blinding factor
  
  // Computed values
  commitment: bigint;       // On-chain commitment
  
  // Position in Merkle tree (set after shielding)
  leafIndex?: number;
  
  // Token metadata (REQUIRED - do not default to DOGE)
  token: string;            // Token symbol (e.g., "DOGE", "USDC")
  tokenAddress: `0x${string}`; // Token address (0x0...0 for native DOGE)
  decimals: number;        // Token decimals (18 for DOGE, 6 for USDC, etc.)
  createdAt: number;        // Unix timestamp
}

/**
 * Spending witness for a note
 * Contains all data needed to spend a note in a ZK proof
 */
export interface NoteSpendingWitness {
  // The note
  note: ShieldedNote;
  
  // Merkle path
  pathElements: bigint[];
  pathIndices: number[];
  merkleRoot: bigint;
  
  // Spending authority
  spendingKey: bigint;
  
  // Computed for proof
  nullifier: bigint;
  nullifierHash: bigint;
}

/**
 * Serialized note for storage/transfer
 */
export interface SerializedNote {
  amount: string;
  ownerPubkey: string;
  secret: string;
  blinding: string;
  commitment: string;
  leafIndex?: number;
  token: string;
  createdAt: number;
  version: number;
}

// Note format version
const NOTE_VERSION = 1;

/**
 * Create a new shielded note
 * 
 * @param amount - Amount in token base units
 * @param ownerPubkey - Recipient's shielded address (public key)
 * @param token - Token symbol (e.g., 'DOGE', 'USDC')
 * @param tokenAddress - Token address (0x0...0 for native DOGE)
 * @param decimals - Token decimals (18 for DOGE, 6 for USDC, etc.)
 * @returns The new note
 */
export async function createNote(
  amount: bigint,
  ownerPubkey: bigint,
  token: string,
  tokenAddress: `0x${string}`,
  decimals: number
): Promise<ShieldedNote> {
  // Validate amount
  if (amount <= 0n) {
    throw new Error('Amount must be positive');
  }
  if (amount >= FIELD_SIZE) {
    throw new Error('Amount exceeds field size');
  }
  
  // Validate token metadata
  if (!token || !tokenAddress || decimals == null) {
    throw new Error('Token metadata (token, tokenAddress, decimals) is required');
  }
  
  // Generate random values
  const secret = randomFieldElement();
  const blinding = randomFieldElement();
  
  // Compute commitment
  const commitment = await computeCommitment(amount, ownerPubkey, secret, blinding);
  
  return {
    amount,
    ownerPubkey,
    secret,
    blinding,
    commitment,
    token,
    tokenAddress,
    decimals,
    createdAt: Date.now(),
  };
}

/**
 * Create a note with specific randomness (for deterministic testing)
 */
export async function createNoteWithRandomness(
  amount: bigint,
  ownerPubkey: bigint,
  secret: bigint,
  blinding: bigint,
  token: string,
  tokenAddress: `0x${string}`,
  decimals: number
): Promise<ShieldedNote> {
  // Validate token metadata
  if (!token || !tokenAddress || decimals == null) {
    throw new Error('Token metadata (token, tokenAddress, decimals) is required');
  }
  
  const commitment = await computeCommitment(amount, ownerPubkey, secret, blinding);
  
  return {
    amount,
    ownerPubkey,
    secret,
    blinding,
    commitment,
    token,
    tokenAddress,
    decimals,
    createdAt: Date.now(),
  };
}

/**
 * Prepare spending witness for a note
 * This gathers all data needed to create a ZK proof for spending
 */
export async function prepareSpendingWitness(
  note: ShieldedNote,
  spendingKey: bigint,
  pathElements: bigint[],
  pathIndices: number[],
  merkleRoot: bigint
): Promise<NoteSpendingWitness> {
  if (note.leafIndex === undefined) {
    throw new Error('Note has no leaf index - was it shielded?');
  }
  
  // Compute nullifier
  const nullifier = await computeNullifier(
    note.secret,
    BigInt(note.leafIndex),
    spendingKey
  );
  
  // Compute nullifier hash (what goes on-chain)
  const nullifierHash = await computeNullifierHash(nullifier);
  
  return {
    note,
    pathElements,
    pathIndices,
    merkleRoot,
    spendingKey,
    nullifier,
    nullifierHash,
  };
}

/**
 * Serialize note for storage or transfer
 */
export function serializeNote(note: ShieldedNote): SerializedNote {
  return {
    amount: note.amount.toString(),
    ownerPubkey: note.ownerPubkey.toString(16).padStart(64, '0'),
    secret: note.secret.toString(16).padStart(64, '0'),
    blinding: note.blinding.toString(16).padStart(64, '0'),
    commitment: note.commitment.toString(16).padStart(64, '0'),
    leafIndex: note.leafIndex,
    token: note.token,
    createdAt: note.createdAt,
    version: NOTE_VERSION,
  };
}

/**
 * Deserialize note from storage
 */
export async function deserializeNote(serialized: SerializedNote): Promise<ShieldedNote> {
  if (serialized.version !== NOTE_VERSION) {
    throw new Error(`Unsupported note version: ${serialized.version}`);
  }
  
  const amount = BigInt(serialized.amount);
  const ownerPubkey = BigInt('0x' + serialized.ownerPubkey);
  const secret = BigInt('0x' + serialized.secret);
  const blinding = BigInt('0x' + serialized.blinding);
  
  // Recompute commitment to verify
  const commitment = await computeCommitment(amount, ownerPubkey, secret, blinding);
  const storedCommitment = BigInt('0x' + serialized.commitment);
  
  if (commitment !== storedCommitment) {
    throw new Error('Note commitment verification failed');
  }
  
  return {
    amount,
    ownerPubkey,
    secret,
    blinding,
    commitment,
    leafIndex: serialized.leafIndex,
    token: serialized.token,
    createdAt: serialized.createdAt,
  };
}

/**
 * Create a shareable note string (for off-chain transfer)
 * Format: dogenado-note-v1-<base64_json>
 * 
 * WARNING: Anyone with this string can claim the note!
 * Only share with the intended recipient.
 */
export function noteToShareableString(note: ShieldedNote): string {
  const serialized = serializeNote(note);
  const json = JSON.stringify(serialized);
  
  // Use base64 encoding
  let base64: string;
  if (typeof window !== 'undefined' && window.btoa) {
    base64 = window.btoa(json);
  } else {
    base64 = Buffer.from(json).toString('base64');
  }
  
  return `dogenado-note-v1-${base64}`;
}

/**
 * Parse note from shareable string
 */
export async function noteFromShareableString(shareableString: string): Promise<ShieldedNote> {
  const prefix = 'dogenado-note-v1-';
  
  if (!shareableString.startsWith(prefix)) {
    throw new Error('Invalid note format: wrong prefix');
  }
  
  const base64 = shareableString.slice(prefix.length);
  
  // Decode base64
  let json: string;
  if (typeof window !== 'undefined' && window.atob) {
    json = window.atob(base64);
  } else {
    json = Buffer.from(base64, 'base64').toString('utf-8');
  }
  
  const serialized = JSON.parse(json) as SerializedNote;
  return deserializeNote(serialized);
}

/**
 * Get commitment as bytes32 for contract calls
 */
export function getCommitmentBytes(note: ShieldedNote): `0x${string}` {
  return toBytes32(note.commitment);
}

/**
 * Format amount for display (from wei to DOGE)
 */
export function formatNoteAmount(note: ShieldedNote): string {
  const dogeAmount = Number(note.amount) / 1e18;
  return `${dogeAmount} ${note.token}`;
}

/**
 * Parse amount from user input to wei
 */
export function parseAmountToWei(amount: string | number, decimals: number = 18): bigint {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num < 0) {
    throw new Error('Invalid amount');
  }
  // Allow 0 for fee-less transactions
  if (num === 0) {
    return 0n;
  }
  return BigInt(Math.floor(num * (10 ** decimals)));
}

/**
 * Format wei to human-readable amount
 */
export function formatWeiToAmount(wei: bigint, decimals: number = 18): number {
  return Number(wei) / (10 ** decimals);
}


