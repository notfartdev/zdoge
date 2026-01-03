/**
 * Cryptographic primitives for Shielded Transactions
 * 
 * Uses MiMC Sponge for all hashing (compatible with Circom circuits).
 */

// Field size for BN254 curve (same as circomlibjs)
export const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

// Domain separators for different hash contexts
export const DOMAIN = {
  SPENDING_KEY: BigInt(0),
  VIEWING_KEY: BigInt(1),
  SHIELDED_ADDRESS: BigInt(2),
  COMMITMENT: BigInt(3),
  NULLIFIER: BigInt(4),
} as const;

// MiMC Sponge instance (lazy loaded)
let mimcSponge: any = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize MiMC from circomlibjs
 */
export async function initMimc(): Promise<void> {
  if (mimcSponge) return;
  if (initPromise) {
    await initPromise;
    return;
  }
  
  initPromise = (async () => {
    const circomlibjs = await import('circomlibjs');
    mimcSponge = await circomlibjs.buildMimcSponge();
    console.log('[Shielded] MiMC initialized from circomlibjs');
  })();
  
  await initPromise;
}

/**
 * MiMC Hash with 2 inputs
 * Uses circomlibjs multiHash which is compatible with MiMCSponge(2, 220, 1) in circomlib
 * 
 * IMPORTANT: The deployed contract MUST use the same MiMC implementation (circomlibjs bytecode)
 * via HasherAdapter for this to work correctly.
 */
export async function mimcHash2(left: bigint, right: bigint): Promise<bigint> {
  await initMimc();
  const result = mimcSponge.multiHash([left, right]);
  return mimcSponge.F.toObject(result);
}

/**
 * MiMC Hash with 3 inputs
 */
export async function mimcHash3(a: bigint, b: bigint, c: bigint): Promise<bigint> {
  await initMimc();
  const result = mimcSponge.multiHash([a, b, c]);
  return mimcSponge.F.toObject(result);
}

/**
 * MiMC Hash with 4 inputs
 */
export async function mimcHash4(a: bigint, b: bigint, c: bigint, d: bigint): Promise<bigint> {
  await initMimc();
  const result = mimcSponge.multiHash([a, b, c, d]);
  return mimcSponge.F.toObject(result);
}

/**
 * Generate cryptographically secure random field element
 * Uses 31 bytes to ensure value is less than field size
 */
export function randomFieldElement(): bigint {
  const bytes = new Uint8Array(31);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    // Node.js environment
    const crypto = require('crypto');
    crypto.randomFillSync(bytes);
  }
  
  let value = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    value = (value << BigInt(8)) | BigInt(bytes[i]);
  }
  return value % FIELD_SIZE;
}

/**
 * Convert bigint to bytes32 hex string
 */
export function toBytes32(value: bigint): `0x${string}` {
  const hex = value.toString(16).padStart(64, '0');
  return `0x${hex}`;
}

/**
 * Convert hex string to bigint
 */
export function fromHex(hex: string): bigint {
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }
  return BigInt('0x' + hex);
}

/**
 * Convert Ethereum address to bigint
 */
export function addressToBigInt(address: string): bigint {
  return fromHex(address);
}

/**
 * Convert bigint to Ethereum address
 */
export function bigIntToAddress(value: bigint): `0x${string}` {
  const hex = value.toString(16).padStart(40, '0');
  return `0x${hex}`;
}

/**
 * Compute note commitment
 * C = MiMC(MiMC(amount, ownerPubkey), MiMC(secret, blinding))
 * 
 * This structure:
 * - Hides amount and owner in first hash
 * - Adds randomness via secret and blinding
 * - Makes it impossible to link commitments
 */
export async function computeCommitment(
  amount: bigint,
  ownerPubkey: bigint,
  secret: bigint,
  blinding: bigint
): Promise<bigint> {
  const leftHash = await mimcHash2(amount, ownerPubkey);
  const rightHash = await mimcHash2(secret, blinding);
  return mimcHash2(leftHash, rightHash);
}

/**
 * Compute nullifier for spending a note
 * N = MiMC(MiMC(secret, leafIndex), spendingKey)
 * 
 * This ensures:
 * - Only the owner (with spending key) can compute the nullifier
 * - The nullifier is unique per note (includes leafIndex)
 * - Cannot be computed without knowing the secret
 */
export async function computeNullifier(
  secret: bigint,
  leafIndex: bigint,
  spendingKey: bigint
): Promise<bigint> {
  const innerHash = await mimcHash2(secret, leafIndex);
  return mimcHash2(innerHash, spendingKey);
}

/**
 * Compute nullifier hash (what's published on-chain)
 * NH = MiMC(nullifier, nullifier)
 */
export async function computeNullifierHash(nullifier: bigint): Promise<bigint> {
  return mimcHash2(nullifier, nullifier);
}


