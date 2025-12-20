/**
 * MiMC Sponge Hash Implementation
 * 
 * Uses circomlibjs for exact compatibility with Circom circuits.
 * This ensures the same hash values in the ZK circuit and JavaScript.
 */

// Dynamic import for browser compatibility
let mimcSponge: any = null;
let initPromise: Promise<void> | null = null;

export const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

/**
 * Initialize MiMC from circomlibjs
 */
async function initMimc(): Promise<void> {
  if (mimcSponge) return;
  if (initPromise) {
    await initPromise;
    return;
  }
  
  initPromise = (async () => {
    // Dynamic import of circomlibjs
    const circomlibjs = await import('circomlibjs');
    mimcSponge = await circomlibjs.buildMimcSponge();
    console.log('[MiMC] Frontend initialized');
  })();
  
  await initPromise;
}

/**
 * MiMC Sponge Hash
 * Compatible with MiMCSponge(2, 220, 1) from circomlib
 * 
 * This uses multiHash which matches the circomlib MiMCSponge template:
 * - For 2 inputs: Feistel(ins[0], 0, k) -> then Feistel(xL + ins[1], xR, k)
 * - Returns final xL as output
 */
export async function mimcHash(left: bigint, right: bigint): Promise<bigint> {
  await initMimc();
  
  const result = mimcSponge.multiHash([left, right]);
  return mimcSponge.F.toObject(result);
}

/**
 * Compute commitment = MiMC(secret, nullifier)
 */
export async function computeCommitment(secret: bigint, nullifier: bigint): Promise<bigint> {
  return mimcHash(secret, nullifier);
}

/**
 * Compute nullifier hash = MiMC(nullifier, nullifier)
 */
export async function computeNullifierHash(nullifier: bigint): Promise<bigint> {
  return mimcHash(nullifier, nullifier);
}

/**
 * Generate random field element (31 bytes to stay under field size)
 */
export function randomFieldElement(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
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
  return `0x${value.toString(16).padStart(64, '0')}`;
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
