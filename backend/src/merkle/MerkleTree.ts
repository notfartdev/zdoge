/**
 * Incremental MerkleTree implementation for the indexer
 * 
 * Uses on-chain hasher for exact compatibility with deployed contracts.
 */

import { getMimcHasher } from '../mimc.js';

export interface MerklePath {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
}

export class MerkleTree {
  private depth: number;
  private leaves: bigint[];
  private zeroValues: bigint[];
  private filledSubtrees: bigint[];
  private hashFn: ((left: bigint, right: bigint) => Promise<bigint>) | null = null;
  private currentRoot: bigint = 0n;
  private initialized: boolean = false;

  constructor(depth: number) {
    this.depth = depth;
    this.leaves = [];
    this.zeroValues = [];
    this.filledSubtrees = [];
  }

  /**
   * Initialize the tree (must be called before use)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Get MiMC hasher (uses on-chain contract)
    this.hashFn = await getMimcHasher();
    
    // Pre-compute zero values for each level using on-chain hasher
    this.zeroValues = await this.computeZeroValues();
    
    // Initialize filled subtrees to zero values
    this.filledSubtrees = [...this.zeroValues];
    
    // Set initial root (empty tree)
    this.currentRoot = this.zeroValues[this.depth];
    
    this.initialized = true;
    console.log(`[MerkleTree] Initialized with depth ${this.depth}`);
  }

  /**
   * Compute zero values for empty tree using circomlibjs hasher
   * Uses keccak256("dogenado") % FIELD_SIZE as initial zero value (matches contract)
   */
  private async computeZeroValues(): Promise<bigint[]> {
    const zeros: bigint[] = [];
    const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    
    // Initial zero value - keccak256("dogenado") % FIELD_SIZE
    // Computed: BigInt(keccak256("dogenado")) % FIELD_SIZE = 3512769630288680559645302610519666697532237706805419307048497632728525155565
    let currentZero = BigInt('3512769630288680559645302610519666697532237706805419307048497632728525155565');
    zeros.push(currentZero);
    
    for (let i = 1; i <= this.depth; i++) {
      currentZero = await this.hashFn!(currentZero, currentZero);
      zeros.push(currentZero);
    }
    
    console.log(`[MerkleTree] Computed ${zeros.length} zero values using circomlibjs`);
    console.log(`[MerkleTree] Zero[0]: 0x${zeros[0].toString(16).padStart(64, '0').slice(0, 16)}...`);
    console.log(`[MerkleTree] Zero[${this.depth}]: 0x${zeros[this.depth].toString(16).padStart(64, '0').slice(0, 16)}...`);
    
    return zeros;
  }

  /**
   * Insert a new leaf
   */
  async insert(leaf: bigint): Promise<number> {
    if (!this.initialized) {
      throw new Error('MerkleTree not initialized - call initialize() first');
    }
    
    const index = this.leaves.length;
    this.leaves.push(leaf);
    
    // Update the tree incrementally
    let currentHash = leaf;
    let currentIndex = index;
    
    for (let level = 0; level < this.depth; level++) {
      const isRight = currentIndex % 2 === 1;
      
      if (isRight) {
        // Current node is on right, sibling is on left (already filled)
        currentHash = await this.hashFn!(this.filledSubtrees[level], currentHash);
      } else {
        // Current node is on left, sibling is zero (empty subtree)
        this.filledSubtrees[level] = currentHash;
        currentHash = await this.hashFn!(currentHash, this.zeroValues[level]);
      }
      
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    this.currentRoot = currentHash;
    return index;
  }

  /**
   * Get the current root
   */
  getRoot(): bigint {
    return this.currentRoot;
  }

  /**
   * Get Merkle path for a leaf
   */
  async getPath(leafIndex: number): Promise<MerklePath> {
    if (!this.initialized) {
      throw new Error('MerkleTree not initialized');
    }
    
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} out of bounds (have ${this.leaves.length} leaves)`);
    }

    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    
    // We need to reconstruct the path by walking up the tree
    // For each level, find the sibling
    let currentIndex = leafIndex;
    
    for (let level = 0; level < this.depth; level++) {
      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
      
      // Get sibling hash
      let sibling: bigint;
      if (siblingIndex < this.getSubtreeSize(level)) {
        // Sibling exists in filled tree
        sibling = await this.getNodeHash(level, siblingIndex);
      } else {
        // Sibling is in empty subtree
        sibling = this.zeroValues[level];
      }
      
      pathElements.push(sibling);
      pathIndices.push(isRight ? 1 : 0);
      
      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      pathElements,
      pathIndices,
      root: this.currentRoot,
    };
  }

  /**
   * Get the size of subtree at a given level
   */
  private getSubtreeSize(level: number): number {
    return Math.ceil(this.leaves.length / (2 ** level));
  }

  /**
   * Get the hash of a node at a given level and index
   * This reconstructs hashes on-the-fly to avoid storing the full tree
   */
  private async getNodeHash(level: number, index: number): Promise<bigint> {
    if (level === 0) {
      // Leaf level - return the leaf or zero
      return index < this.leaves.length ? this.leaves[index] : this.zeroValues[0];
    }
    
    // Recursively compute hash from children
    const leftIndex = index * 2;
    const rightIndex = index * 2 + 1;
    
    const left = await this.getNodeHash(level - 1, leftIndex);
    const right = await this.getNodeHash(level - 1, rightIndex);
    
    return this.hashFn!(left, right);
  }

  /**
   * Get number of leaves
   */
  getLeafCount(): number {
    return this.leaves.length;
  }

  /**
   * Get all leaves
   */
  getLeaves(): bigint[] {
    return [...this.leaves];
  }

  /**
   * Check if leaf exists
   */
  hasLeaf(leaf: bigint): boolean {
    return this.leaves.some(l => l === leaf);
  }

  /**
   * Get leaf index
   */
  getLeafIndex(leaf: bigint): number {
    return this.leaves.findIndex(l => l === leaf);
  }
}
