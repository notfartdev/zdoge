/**
 * Note Service for Dogenado
 * 
 * Handles generation and parsing of secret notes.
 * Notes contain the secret and nullifier needed for withdrawal.
 * 
 * Uses MiMC hashing for commitment/nullifierHash to match the ZK circuit.
 */

import { 
  mimcHash, 
  computeCommitment as mimcCommitment, 
  computeNullifierHash as mimcNullifierHash,
  randomFieldElement,
  toBytes32,
  fromHex,
  FIELD_SIZE
} from './mimc';

// Note format: dogenado-<version>-<pool>-<secret>-<nullifier>
// Example: dogenado-1-usdc100-abc123...-def456...

export interface Note {
  version: number;
  pool: string;
  secret: bigint;
  nullifier: bigint;
  commitment: bigint;
  nullifierHash: bigint;
}

export interface SerializedNote {
  version: number;
  pool: string;
  secret: string;
  nullifier: string;
  commitment: string;
  nullifierHash: string;
}

/**
 * Generate a new deposit note
 */
export async function generateNote(pool: string): Promise<Note> {
  // Generate random field elements (31 bytes each)
  const secret = randomFieldElement();
  const nullifier = randomFieldElement();
  
  // Compute MiMC hashes
  const commitment = await mimcCommitment(secret, nullifier);
  const nullifierHash = await mimcNullifierHash(nullifier);
  
  return {
    version: 1,
    pool,
    secret,
    nullifier,
    commitment,
    nullifierHash,
  };
}

/**
 * Serialize note to string format for storage
 */
export function serializeNote(note: Note): string {
  const secretHex = note.secret.toString(16).padStart(62, '0');
  const nullifierHex = note.nullifier.toString(16).padStart(62, '0');
  return `dogenado-${note.version}-${note.pool}-${secretHex}-${nullifierHex}`;
}

/**
 * Parse note from string format
 */
export async function parseNote(noteString: string): Promise<Note> {
  const parts = noteString.split('-');
  
  if (parts.length !== 5 || parts[0] !== 'dogenado') {
    throw new Error('Invalid note format');
  }
  
  const version = parseInt(parts[1]);
  const pool = parts[2];
  const secretHex = parts[3];
  const nullifierHex = parts[4];
  
  if (version !== 1) {
    throw new Error('Unsupported note version');
  }
  
  // Parse hex to bigint
  const secret = BigInt('0x' + secretHex);
  const nullifier = BigInt('0x' + nullifierHex);
  
  // Validate field elements
  if (secret >= FIELD_SIZE || nullifier >= FIELD_SIZE) {
    throw new Error('Invalid secret or nullifier: exceeds field size');
  }
  
  // Recompute hashes
  const commitment = await mimcCommitment(secret, nullifier);
  const nullifierHash = await mimcNullifierHash(nullifier);
  
  return {
    version,
    pool,
    secret,
    nullifier,
    commitment,
    nullifierHash,
  };
}

/**
 * Validate note format without full parsing
 */
export function isValidNoteFormat(noteString: string): boolean {
  try {
    const parts = noteString.split('-');
    if (parts.length !== 5 || parts[0] !== 'dogenado' || parts[1] !== '1') {
      return false;
    }
    // Check hex format (62 chars = 31 bytes)
    const secretHex = parts[3];
    const nullifierHex = parts[4];
    return secretHex.length === 62 && nullifierHex.length === 62;
  } catch {
    return false;
  }
}

/**
 * Get commitment as bytes32 for contract call
 */
export function getCommitmentBytes(note: Note): `0x${string}` {
  return toBytes32(note.commitment);
}

/**
 * Get nullifier hash as bytes32 for contract call
 */
export function getNullifierHashBytes(note: Note): `0x${string}` {
  return toBytes32(note.nullifierHash);
}

/**
 * Convert note to serialized format (for JSON storage)
 */
export function noteToSerializable(note: Note): SerializedNote {
  return {
    version: note.version,
    pool: note.pool,
    secret: note.secret.toString(),
    nullifier: note.nullifier.toString(),
    commitment: note.commitment.toString(),
    nullifierHash: note.nullifierHash.toString(),
  };
}

/**
 * Convert serialized note back to Note
 */
export async function serializableToNote(data: SerializedNote): Promise<Note> {
  const secret = BigInt(data.secret);
  const nullifier = BigInt(data.nullifier);
  
  // Recompute hashes to verify
  const commitment = await mimcCommitment(secret, nullifier);
  const nullifierHash = await mimcNullifierHash(nullifier);
  
  return {
    version: data.version,
    pool: data.pool,
    secret,
    nullifier,
    commitment,
    nullifierHash,
  };
}
