/**
 * Dogenado Indexer Service
 *
 * Listens to blockchain events and maintains:
 * - Merkle tree state
 * - Deposit history
 * - Root history
 * - Nullifier tracking
 */
import { MerkleTree } from '../merkle/MerkleTree.js';
interface PoolState {
    address: string;
    tree: MerkleTree;
    deposits: Map<string, {
        leafIndex: number;
        timestamp: number;
        blockNumber: bigint;
    }>;
    nullifiers: Set<string>;
    rootHistory: string[];
}
declare const pools: Map<string, PoolState>;
declare const app: import("express-serve-static-core").Express;
export { app, pools };
