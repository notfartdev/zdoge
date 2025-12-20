/**
 * Incremental MerkleTree implementation for the indexer
 *
 * Uses on-chain hasher for exact compatibility with deployed contracts.
 */
export interface MerklePath {
    pathElements: bigint[];
    pathIndices: number[];
    root: bigint;
}
export declare class MerkleTree {
    private depth;
    private leaves;
    private zeroValues;
    private filledSubtrees;
    private hashFn;
    private currentRoot;
    private initialized;
    constructor(depth: number);
    /**
     * Initialize the tree (must be called before use)
     */
    initialize(): Promise<void>;
    /**
     * Compute zero values for empty tree using circomlibjs hasher
     * Uses keccak256("dogenado") % FIELD_SIZE as initial zero value (matches contract)
     */
    private computeZeroValues;
    /**
     * Insert a new leaf
     */
    insert(leaf: bigint): Promise<number>;
    /**
     * Get the current root
     */
    getRoot(): bigint;
    /**
     * Get Merkle path for a leaf
     */
    getPath(leafIndex: number): Promise<MerklePath>;
    /**
     * Get the size of subtree at a given level
     */
    private getSubtreeSize;
    /**
     * Get the hash of a node at a given level and index
     * This reconstructs hashes on-the-fly to avoid storing the full tree
     */
    private getNodeHash;
    /**
     * Get number of leaves
     */
    getLeafCount(): number;
    /**
     * Get all leaves
     */
    getLeaves(): bigint[];
    /**
     * Check if leaf exists
     */
    hasLeaf(leaf: bigint): boolean;
    /**
     * Get leaf index
     */
    getLeafIndex(leaf: bigint): number;
}
