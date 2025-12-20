/**
 * MiMC Sponge Hash for Node.js backend
 *
 * Uses circomlibjs for exact compatibility with:
 * - The deployed HasherAdapter contract (which wraps circomlibjs bytecode)
 * - The Circom ZK circuits
 */
/**
 * Initialize MiMC hasher
 */
declare function initMimc(): Promise<void>;
/**
 * MiMC hash function compatible with Circom MiMCSponge(2, 220, 1)
 *
 * Uses multiHash which matches the circomlib MiMCSponge template:
 * - For 2 inputs: Feistel(ins[0], 0, k) -> then Feistel(xL + ins[1], xR, k)
 * - Returns final xL as output
 */
export declare function mimcHash(left: bigint, right: bigint): Promise<bigint>;
/**
 * Get initialized MiMC hasher for Merkle tree
 */
export declare function getMimcHasher(): Promise<(left: bigint, right: bigint) => Promise<bigint>>;
/**
 * Convert bigint to bytes32 hex string
 */
export declare function toBytes32(value: bigint): string;
/**
 * Initialize and warm up the hasher
 */
export { initMimc };
