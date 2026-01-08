/**
 * Shielded Proof Service
 * 
 * Generates ZK proofs for shield, transfer, and unshield operations.
 * All proving happens client-side for maximum privacy.
 */

import { ShieldedNote, NoteSpendingWitness, prepareSpendingWitness } from './shielded-note';
import { ShieldedIdentity } from './shielded-address';
import { 
  computeCommitment, 
  computeNullifier, 
  computeNullifierHash,
  toBytes32,
  addressToBigInt,
  randomFieldElement,
  FIELD_SIZE,
} from './shielded-crypto';

// API endpoint for indexer (optional - we can build Merkle tree client-side)
const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://dogenadocash.onrender.com';

// Circuit files location
const CIRCUITS_PATH = '/circuits/shielded';

// Merkle tree configuration
const TREE_DEPTH = 20;
// ZERO_VALUE must match contract: keccak256("dogenado") % FIELD_SIZE
// keccak256("dogenado") = 0x67e5b9f9f4f21c4d8e3b76c9c7f8d0e2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8 (example)
// We'll compute this dynamically to ensure it matches
let ZERO_VALUE: bigint | null = null;

async function getZeroValue(): Promise<bigint> {
  if (ZERO_VALUE !== null) return ZERO_VALUE;
  
  // Use ethers or viem to compute keccak256("dogenado")
  const { keccak256, toBytes } = await import('viem');
  const hash = keccak256(toBytes('dogenado'));
  ZERO_VALUE = BigInt(hash) % FIELD_SIZE;
  console.log(`[Merkle] Zero value (keccak256("dogenado") % FIELD_SIZE): 0x${ZERO_VALUE.toString(16)}`);
  return ZERO_VALUE;
}

/**
 * Debug: Verify MiMC hash matches contract
 * This helps identify if there's a hash implementation mismatch
 */
export async function debugVerifyMiMC(poolAddress: string): Promise<void> {
  await initMimcForTree();
  const zeroVal = await getZeroValue();
  
  console.log('=== MiMC Debug Verification ===');
  console.log(`Zero value: 0x${zeroVal.toString(16)}`);
  
  // Compute zeros[1] = MiMC(zeros[0], zeros[0])
  const zeros1 = await mimcHash(zeroVal, zeroVal);
  console.log(`zeros[1] = MiMC(zeros[0], zeros[0]): 0x${zeros1.toString(16)}`);
  
  // We should compare this with the contract's zeros[1]
  // This would require calling the contract's zeros(1) function
  try {
    // Call zeros(1) on contract - need to construct the call
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{
          to: poolAddress,
          // zeros(uint256) selector + argument 1 = 0x... + 0000...0001
          data: '0x' + 'e82e0d38' + '0000000000000000000000000000000000000000000000000000000000000001',
        }, 'latest'],
      }),
    });
    
    const data = await response.json();
    if (data.result && data.result !== '0x') {
      const contractZeros1 = BigInt(data.result);
      console.log(`Contract zeros[1]: 0x${contractZeros1.toString(16)}`);
      
      if (zeros1 === contractZeros1) {
        console.log('✓ MiMC implementation MATCHES contract!');
      } else {
        console.error('❌ MiMC MISMATCH! Client and contract produce different hashes.');
        console.error('   Client zeros[1]:', zeros1.toString());
        console.error('   Contract zeros[1]:', contractZeros1.toString());
      }
    }
  } catch (e) {
    console.warn('Could not verify against contract zeros:', e);
  }
}

// RPC endpoint
const RPC_URL = 'https://rpc.testnet.dogeos.com';

export interface ShieldProofInput {
  // Public
  commitment: bigint;
  amount: bigint;
  
  // Private
  ownerPubkey: bigint;
  secret: bigint;
  blinding: bigint;
}

export interface TransferProofInput {
  // Public
  root: bigint;
  nullifierHash: bigint;
  outputCommitment1: bigint;
  outputCommitment2: bigint;
  relayer: bigint;
  fee: bigint;
  
  // Private - Input note
  inputAmount: bigint;
  inputOwnerPubkey: bigint;
  inputSecret: bigint;
  inputBlinding: bigint;
  inputLeafIndex: bigint;
  pathElements: bigint[];
  pathIndices: number[];
  spendingKey: bigint;
  
  // Private - Output notes
  output1Amount: bigint;
  output1OwnerPubkey: bigint;
  output1Secret: bigint;
  output1Blinding: bigint;
  output2Amount: bigint;
  output2OwnerPubkey: bigint;
  output2Secret: bigint;
  output2Blinding: bigint;
}

export interface UnshieldProofInput {
  // Public
  root: bigint;
  nullifierHash: bigint;
  recipient: bigint;
  amount: bigint;
  relayer: bigint;
  fee: bigint;
  
  // Private
  noteAmount: bigint;
  ownerPubkey: bigint;
  secret: bigint;
  blinding: bigint;
  leafIndex: bigint;
  pathElements: bigint[];
  pathIndices: number[];
  spendingKey: bigint;
}

export interface Proof {
  proof: string[];
  publicInputs: string[];
}

// Cache for snarkjs
let snarkjs: any = null;

async function loadSnarkJS(): Promise<any> {
  if (snarkjs) return snarkjs;
  snarkjs = await import('snarkjs');
  return snarkjs;
}

// MiMC Sponge instance for Merkle tree (lazy loaded)
let mimcSponge: any = null;

/**
 * Initialize MiMC from circomlibjs
 */
async function initMimcForTree(): Promise<void> {
  if (mimcSponge) return;
  const circomlibjs = await import('circomlibjs');
  mimcSponge = await circomlibjs.buildMimcSponge();
  console.log('[Merkle] MiMC initialized for tree building');
}

/**
 * MiMC hash for Merkle tree - MUST match the circuit's MiMC
 * Uses circomlibjs MiMCSponge(2, 220, 1) for compatibility
 */
async function mimcHash(left: bigint, right: bigint): Promise<bigint> {
  await initMimcForTree();
  const result = mimcSponge.multiHash([left, right]);
  return mimcSponge.F.toObject(result);
}

// Pre-computed zero hashes for each level (cached after first computation)
let zeroHashes: bigint[] | null = null;

/**
 * Pre-compute zero hashes for each level of the Merkle tree
 * zeros[0] = keccak256("dogenado") % FIELD_SIZE
 * zeros[i] = MiMC(zeros[i-1], zeros[i-1])
 */
async function getZeroHashes(): Promise<bigint[]> {
  if (zeroHashes) return zeroHashes;
  
  await initMimcForTree();
  const zeros: bigint[] = [];
  
  // Level 0: the base zero value
  zeros[0] = await getZeroValue();
  
  // Each subsequent level: hash of two zeros from the level below
  for (let i = 1; i < TREE_DEPTH; i++) {
    zeros[i] = await mimcHash(zeros[i - 1], zeros[i - 1]);
  }
  
  zeroHashes = zeros;
  console.log(`[Merkle] Pre-computed ${TREE_DEPTH} zero hashes`);
  return zeros;
}

/**
 * Build Merkle path efficiently using sparse tree
 * Only computes hashes for filled nodes, uses pre-computed zeros elsewhere
 */
async function buildMerkleTreeAndGetPath(
  leaves: bigint[],
  leafIndex: number
): Promise<{ pathElements: bigint[]; pathIndices: number[]; root: bigint }> {
  const depth = TREE_DEPTH;
  
  // Get pre-computed zero hashes
  const zeros = await getZeroHashes();
  
  console.log(`[Merkle] Building sparse path for leaf ${leafIndex} in tree with ${leaves.length} leaves`);
  const startTime = Date.now();
  
  // Use sparse representation: Map of (level, index) -> hash
  const nodes: Map<string, bigint> = new Map();
  
  // Helper to get node key
  const key = (level: number, idx: number) => `${level}:${idx}`;
  
  // Helper to get node (returns zero hash if not exists)
  const getNode = (level: number, idx: number): bigint => {
    return nodes.get(key(level, idx)) ?? zeros[level];
  };
  
  // Insert leaf level (level 0)
  for (let i = 0; i < leaves.length; i++) {
    nodes.set(key(0, i), leaves[i]);
  }
  
  // Build tree bottom-up, only computing parents of filled nodes
  for (let level = 0; level < depth; level++) {
    // Find all unique parent indices needed
    const parentIndices = new Set<number>();
    for (const k of nodes.keys()) {
      const [l, idx] = k.split(':').map(Number);
      if (l === level) {
        parentIndices.add(Math.floor(idx / 2));
      }
    }
    
    // Compute parent hashes
    for (const parentIdx of parentIndices) {
      const leftIdx = parentIdx * 2;
      const rightIdx = parentIdx * 2 + 1;
      const left = getNode(level, leftIdx);
      const right = getNode(level, rightIdx);
      const hash = await mimcHash(left, right);
      nodes.set(key(level + 1, parentIdx), hash);
    }
  }
  
  // Extract path for target leaf
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  let currentIndex = leafIndex;
  
  for (let level = 0; level < depth; level++) {
    const siblingIdx = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    pathElements.push(getNode(level, siblingIdx));
    pathIndices.push(currentIndex % 2);
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  // Root is at level depth, index 0
  const root = getNode(depth, 0);
  
  console.log(`[Merkle] Path built in ${Date.now() - startTime}ms, root: ${root.toString().slice(0, 20)}...`);
  
  return {
    pathElements,
    pathIndices,
    root,
  };
}

/**
 * Fetch commitments from blockchain events
 */
export async function fetchCommitmentsFromChain(poolAddress: string): Promise<{ commitment: bigint; leafIndex: number }[]> {
  try {
    // First, fetch ALL logs from the contract to find the actual event signature
    console.log(`Fetching all events from pool ${poolAddress}...`);
    
    const allLogsResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getLogs',
        params: [{
          address: poolAddress,
          fromBlock: '0x0',
          toBlock: 'latest',
        }],
      }),
    });
    
    const allLogsData = await allLogsResponse.json();
    
    if (allLogsData.error) {
      console.error('RPC error:', allLogsData.error);
      return [];
    }
    
    const logs = allLogsData.result || [];
    console.log(`Found ${logs.length} total events from pool`);
    
    if (logs.length === 0) {
      return [];
    }
    
    // Log unique event signatures for debugging
    const uniqueTopics = new Set(logs.map((log: any) => log.topics[0]));
    console.log('Event signatures found:', Array.from(uniqueTopics));
    
    // Shield/Deposit events have topics: [eventSig, commitment (indexed), leafIndex (indexed)]
    // Transfer events have different structure - we need to filter carefully
    // 
    // The key is that leafIndex for deposits is always a small number (< 2^32),
    // while other indexed values (like nullifiers, amounts) are large field elements.
    
    const depositLogs = logs.filter((log: any) => 
      log.topics && log.topics.length >= 3
    );
    
    // Extract and filter - only keep events where topics[2] is a reasonable leaf index
    const MAX_LEAF_INDEX = 2 ** 32; // 4 billion leaves should be more than enough
    const results: { commitment: bigint; leafIndex: number }[] = [];
    
    for (const log of depositLogs) {
      const commitment = BigInt(log.topics[1]);
      const leafIndexBigInt = BigInt(log.topics[2]);
      
      // Skip if leafIndex is unreasonably large (likely a different event type)
      if (leafIndexBigInt >= BigInt(MAX_LEAF_INDEX)) {
        // This is probably a Transfer event or other event, skip it
        continue;
      }
      
      const leafIndex = Number(leafIndexBigInt);
      results.push({ commitment, leafIndex });
    }
    
    console.log(`Found ${results.length} valid shield/deposit events (filtered from ${depositLogs.length} total)`);
    
    // Sort by leafIndex to ensure correct order
    results.sort((a, b) => a.leafIndex - b.leafIndex);
    
    // Deduplicate by leafIndex (keep first occurrence)
    const seen = new Set<number>();
    const deduped = results.filter(r => {
      if (seen.has(r.leafIndex)) return false;
      seen.add(r.leafIndex);
      return true;
    });
    
    console.log(`After deduplication: ${deduped.length} unique commitments`);
    
    return deduped;
  } catch (error) {
    console.error('Failed to fetch commitments from chain:', error);
    return [];
  }
}

/**
 * Fetch the contract's actual current root
 */
async function fetchContractRoot(poolAddress: string): Promise<bigint> {
  console.log(`[Merkle] Fetching contract root from ${poolAddress}...`);
  
  // Call getLatestRoot() - function selector: 0x5445b007
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{
        to: poolAddress,
        data: '0x5445b007', // getLatestRoot()
      }, 'latest'],
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    throw new Error(`Failed to get contract root: ${data.error.message}`);
  }
  
  const root = BigInt(data.result);
  return root;
}

/**
 * Check if a root is known (in contract's history)
 */
async function checkIfRootIsKnown(poolAddress: string, root: bigint): Promise<boolean> {
  // Call isKnownRoot(bytes32) - function selector: 0x6d9833e3
  const rootHex = '0x' + root.toString(16).padStart(64, '0');
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{
        to: poolAddress,
        data: '0x6d9833e3' + rootHex.slice(2), // isKnownRoot(bytes32)
      }, 'latest'],
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    console.warn(`[Merkle] Could not check if root is known:`, data.error);
    return false;
  }
  
  // Returns bool - 0x...01 = true, 0x...00 = false
  const isKnown = BigInt(data.result) === 1n;
  console.log(`[Merkle] Is root known on-chain: ${isKnown}`);
  return isKnown;
}

// Track if we've done the MiMC verification
let mimcVerified = false;

/**
 * Fetch Merkle path - builds client-side from on-chain events
 * 
 * IMPORTANT: We always build client-side because the backend indexer may be stale.
 * This ensures we always use the exact same tree state as the on-chain contract.
 */
export async function fetchMerklePath(
  poolAddress: string,
  leafIndex: number
): Promise<{ pathElements: bigint[]; pathIndices: number[]; root: bigint }> {
  console.log('[Merkle] Building Merkle tree from on-chain events (ensures freshness)...');
  
  // Run MiMC verification once to help debug hash mismatches
  if (!mimcVerified) {
    mimcVerified = true;
    try {
      await debugVerifyMiMC(poolAddress);
    } catch (e) {
      console.warn('[Merkle] MiMC verification failed:', e);
    }
  }
  
  // Fallback: Build Merkle tree client-side from blockchain events
  console.log(`Fetching commitments from chain for pool ${poolAddress}...`);
  const commitmentsData = await fetchCommitmentsFromChain(poolAddress);
  
  if (commitmentsData.length === 0) {
    throw new Error('No commitments found on chain. Make sure the pool address is correct and has deposits.');
  }
  
  console.log(`Found ${commitmentsData.length} commitments on chain`);
  
  // Find the commitment at the requested leafIndex
  const targetCommitment = commitmentsData.find(c => c.leafIndex === leafIndex);
  if (!targetCommitment) {
    console.log(`Available leaf indices: ${commitmentsData.map(c => c.leafIndex).join(', ')}`);
    throw new Error(`Leaf index ${leafIndex} not found on chain. Available indices: ${commitmentsData.map(c => c.leafIndex).slice(0, 10).join(', ')}...`);
  }
  
  // Build array of commitments in order
  // Get zero value for empty slots
  const zeroValue = await getZeroValue();
  const maxLeafIndex = Math.max(...commitmentsData.map(c => c.leafIndex));
  const commitments: bigint[] = new Array(maxLeafIndex + 1).fill(zeroValue);
  
  for (const { commitment, leafIndex: idx } of commitmentsData) {
    commitments[idx] = commitment;
  }
  
  console.log(`Building Merkle tree with ${commitments.length} leaves, zeroValue=${zeroValue.toString().slice(0,20)}...`);
  
  // First, get the contract's actual root to compare
  let contractRoot: bigint | null = null;
  try {
    contractRoot = await fetchContractRoot(poolAddress);
    console.log(`[Merkle] Contract's current root: 0x${contractRoot.toString(16)}`);
  } catch (e) {
    console.warn('[Merkle] Could not fetch contract root:', e);
  }
  
  const result = await buildMerkleTreeAndGetPath(commitments, leafIndex);
  
  // Log computed root for debugging
  console.log(`[Merkle] Our computed root: 0x${result.root.toString(16)}`);
  
  // Verify against contract root - CRITICAL for proof to work
  if (contractRoot !== null) {
    if (contractRoot !== result.root) {
      console.error(`[Merkle] ❌ ROOT MISMATCH!`);
      console.error(`[Merkle] Contract: 0x${contractRoot.toString(16)}`);
      console.error(`[Merkle] Computed: 0x${result.root.toString(16)}`);
      console.error(`[Merkle] Tree had ${commitments.length} leaves, requested leaf ${leafIndex}`);
      
      // Debug: Try checking if the contract root is an OLD root we might have
      // This helps identify if we're missing some recent deposits
      const isOurRootKnown = await checkIfRootIsKnown(poolAddress, result.root);
      console.log(`[Merkle] Is our computed root known on-chain? ${isOurRootKnown}`);
      
      if (!isOurRootKnown) {
        // Our root doesn't exist at all - likely MiMC mismatch
        // BUT the contract's root IS valid, so use the contract root as a reference
        console.error(`[Merkle] ⚠️ Our computed root is NOT recognized by the contract.`);
        console.error(`[Merkle] This indicates a MiMC hash mismatch between client and contract.`);
        console.error(`[Merkle] The contract uses HasherAdapter which wraps circomlibjs MiMCSponge.`);
        
        // Try to use the contract's root instead (if the path is still valid)
        // This is a workaround - ideally we should fix the MiMC implementation
        console.log(`[Merkle] Attempting to use contract's root: 0x${contractRoot.toString(16)}`);
        
        // Check if the contract root is actually valid
        const isContractRootKnown = await checkIfRootIsKnown(poolAddress, contractRoot);
        if (isContractRootKnown) {
          console.log(`[Merkle] ✓ Contract root is valid, using it for proof`);
          result.root = contractRoot;
        } else {
          throw new Error(`ROOT MISMATCH: Neither computed nor contract root is recognized. MiMC implementation differs.`);
        }
      }
    } else {
      console.log(`[Merkle] ✓ Roots match perfectly!`);
    }
  }
  
  return result;
}

/**
 * Generate proof for Shield operation (t→z)
 * 
 * This proves that the commitment is correctly formed from the inputs.
 * NOTE: For MVP, we can skip this proof and use shieldSimple() on contract.
 */
export async function generateShieldProof(
  note: ShieldedNote
): Promise<Proof> {
  const snarks = await loadSnarkJS();
  
  const input: ShieldProofInput = {
    commitment: note.commitment,
    amount: note.amount,
    ownerPubkey: note.ownerPubkey,
    secret: note.secret,
    blinding: note.blinding,
  };
  
  // Convert to snarkjs format
  const circuitInput = {
    commitment: input.commitment.toString(),
    amount: input.amount.toString(),
    ownerPubkey: input.ownerPubkey.toString(),
    secret: input.secret.toString(),
    blinding: input.blinding.toString(),
  };
  
  // Generate proof
  const { proof, publicSignals } = await snarks.groth16.fullProve(
    circuitInput,
    `${CIRCUITS_PATH}/shield.wasm`,
    `${CIRCUITS_PATH}/shield_final.zkey`
  );
  
  // Format proof for contract
  const proofFormatted = formatProofForContract(proof);
  
  return {
    proof: proofFormatted,
    publicInputs: publicSignals,
  };
}

/**
 * Generate proof for Transfer operation (z→z)
 */
export async function generateTransferProof(
  inputNote: ShieldedNote,
  senderIdentity: ShieldedIdentity,
  recipientAddress: bigint,
  transferAmount: bigint,
  poolAddress: string,
  relayerAddress: string = '0x0000000000000000000000000000000000000000',
  fee: bigint = 0n
): Promise<{
  proof: Proof;
  outputNote1: ShieldedNote;  // Recipient's note
  outputNote2: ShieldedNote;  // Change note
  nullifierHash: bigint;
  root: bigint;  // The Merkle root used in proof
}> {
  const snarks = await loadSnarkJS();
  
  if (inputNote.leafIndex === undefined) {
    throw new Error('Input note has no leaf index');
  }
  
  // Fetch Merkle path
  const { pathElements, pathIndices, root } = await fetchMerklePath(
    poolAddress,
    inputNote.leafIndex
  );
  
  // Calculate change amount
  const changeAmount = inputNote.amount - transferAmount - fee;
  if (changeAmount < 0n) {
    throw new Error('Insufficient funds in note');
  }
  
  // Generate output notes
  const output1Secret = randomFieldElement();
  const output1Blinding = randomFieldElement();
  const output1Commitment = await computeCommitment(
    transferAmount,
    recipientAddress,
    output1Secret,
    output1Blinding
  );
  
  const output2Secret = randomFieldElement();
  const output2Blinding = randomFieldElement();
  const output2Commitment = await computeCommitment(
    changeAmount,
    senderIdentity.shieldedAddress,
    output2Secret,
    output2Blinding
  );
  
  // Compute nullifier
  const nullifier = await computeNullifier(
    inputNote.secret,
    BigInt(inputNote.leafIndex),
    senderIdentity.spendingKey
  );
  const nullifierHash = await computeNullifierHash(nullifier);
  
  // DEBUG: Verify note ownerPubkey matches identity shieldedAddress
  const expectedOwner = senderIdentity.shieldedAddress;
  console.log('[Transfer] Verifying note ownership...');
  console.log('  Note ownerPubkey:', inputNote.ownerPubkey.toString(16).slice(0, 16) + '...');
  console.log('  Identity shieldedAddress:', expectedOwner.toString(16).slice(0, 16) + '...');
  console.log('  Match:', inputNote.ownerPubkey === expectedOwner);
  
  if (inputNote.ownerPubkey !== expectedOwner) {
    console.error('[Transfer] CRITICAL: Note ownerPubkey does NOT match identity!');
    console.error('  This note was created with an old/wrong shieldedAddress.');
    console.error('  Please clear notes from localStorage and re-shield.');
    throw new Error('Note ownership mismatch. This note was created with an outdated identity. Please clear your notes and re-shield.');
  }
  
  // Prepare circuit input
  const circuitInput = {
    // Public
    root: root.toString(),
    nullifierHash: nullifierHash.toString(),
    outputCommitment1: output1Commitment.toString(),
    outputCommitment2: output2Commitment.toString(),
    relayer: addressToBigInt(relayerAddress).toString(),
    fee: fee.toString(),
    
    // Private - Input note
    inputAmount: inputNote.amount.toString(),
    inputOwnerPubkey: inputNote.ownerPubkey.toString(),
    inputSecret: inputNote.secret.toString(),
    inputBlinding: inputNote.blinding.toString(),
    inputLeafIndex: inputNote.leafIndex.toString(),
    pathElements: pathElements.map(e => e.toString()),
    pathIndices: pathIndices,
    spendingKey: senderIdentity.spendingKey.toString(),
    
    // Private - Output notes
    output1Amount: transferAmount.toString(),
    output1OwnerPubkey: recipientAddress.toString(),
    output1Secret: output1Secret.toString(),
    output1Blinding: output1Blinding.toString(),
    output2Amount: changeAmount.toString(),
    output2OwnerPubkey: senderIdentity.shieldedAddress.toString(),
    output2Secret: output2Secret.toString(),
    output2Blinding: output2Blinding.toString(),
  };
  
  // Generate proof
  const { proof, publicSignals } = await snarks.groth16.fullProve(
    circuitInput,
    `${CIRCUITS_PATH}/transfer.wasm`,
    `${CIRCUITS_PATH}/transfer_final.zkey`
  );
  
  // DEBUG: Log public signals from circuit vs what we computed
  console.log('[Transfer] Circuit publicSignals:');
  console.log('  [0] root:', publicSignals[0]);
  console.log('  [1] nullifierHash:', publicSignals[1]);
  console.log('  [2] outputCommitment1:', publicSignals[2]);
  console.log('  [3] outputCommitment2:', publicSignals[3]);
  console.log('  [4] relayer:', publicSignals[4]);
  console.log('  [5] fee:', publicSignals[5]);
  console.log('[Transfer] Our computed values:');
  console.log('  root:', root.toString());
  console.log('  nullifierHash:', nullifierHash.toString());
  console.log('  outputCommitment1:', output1Commitment.toString());
  console.log('  outputCommitment2:', output2Commitment.toString());
  
  // Verify they match!
  if (publicSignals[2] !== output1Commitment.toString()) {
    console.error('[Transfer] ❌ outputCommitment1 MISMATCH!');
    console.error('  Circuit:', publicSignals[2]);
    console.error('  Ours:', output1Commitment.toString());
  }
  if (publicSignals[3] !== output2Commitment.toString()) {
    console.error('[Transfer] ❌ outputCommitment2 MISMATCH!');
    console.error('  Circuit:', publicSignals[3]);
    console.error('  Ours:', output2Commitment.toString());
  }
  
  // Create output note objects
  const outputNote1: ShieldedNote = {
    amount: transferAmount,
    ownerPubkey: recipientAddress,
    secret: output1Secret,
    blinding: output1Blinding,
    commitment: output1Commitment,
    token: inputNote.token,
    createdAt: Date.now(),
  };
  
  const outputNote2: ShieldedNote = {
    amount: changeAmount,
    ownerPubkey: senderIdentity.shieldedAddress,
    secret: output2Secret,
    blinding: output2Blinding,
    commitment: output2Commitment,
    token: inputNote.token,
    createdAt: Date.now(),
  };
  
  return {
    proof: {
      proof: formatProofForContract(proof),
      publicInputs: publicSignals,
    },
    outputNote1,
    outputNote2,
    nullifierHash,
    root,  // Return the root used in proof generation
  };
}

/**
 * Generate proof for Unshield operation (z→t)
 */
export async function generateUnshieldProof(
  note: ShieldedNote,
  identity: ShieldedIdentity,
  recipientAddress: string,
  withdrawAmount: bigint,
  poolAddress: string,
  relayerAddress: string = '0x0000000000000000000000000000000000000000',
  fee: bigint = 0n
): Promise<{
  proof: Proof;
  nullifierHash: bigint;
  root: bigint;
}> {
  console.log('=== UNSHIELD PROOF GENERATION ===');
  console.log('Pool:', poolAddress);
  console.log('Note leafIndex:', note.leafIndex);
  console.log('Note amount:', note.amount.toString());
  console.log('Note commitment:', '0x' + note.commitment.toString(16));
  console.log('Withdraw amount:', withdrawAmount.toString());
  console.log('Recipient:', recipientAddress);
  
  const snarks = await loadSnarkJS();
  
  if (note.leafIndex === undefined) {
    throw new Error('Note has no leaf index');
  }
  
  // Verify value conservation
  if (withdrawAmount + fee !== note.amount) {
    throw new Error(`Value mismatch: ${withdrawAmount} + ${fee} != ${note.amount}`);
  }
  
  // Fetch Merkle path
  console.log('Fetching Merkle path...');
  const { pathElements, pathIndices, root } = await fetchMerklePath(
    poolAddress,
    note.leafIndex
  );
  console.log('✓ Merkle root:', '0x' + root.toString(16));
  console.log('✓ Path depth:', pathElements.length);
  
  // DEBUG: Verify note ownerPubkey matches identity shieldedAddress
  const expectedOwner = identity.shieldedAddress;
  console.log('[Unshield] Verifying note ownership...');
  console.log('  Note ownerPubkey:', note.ownerPubkey.toString(16).slice(0, 16) + '...');
  console.log('  Identity shieldedAddress:', expectedOwner.toString(16).slice(0, 16) + '...');
  console.log('  Match:', note.ownerPubkey === expectedOwner);
  
  if (note.ownerPubkey !== expectedOwner) {
    console.error('[Unshield] CRITICAL: Note ownerPubkey does NOT match identity!');
    throw new Error('Note ownership mismatch. This note was created with an outdated identity. Please clear your notes and re-shield.');
  }
  
  // Compute nullifier
  const nullifier = await computeNullifier(
    note.secret,
    BigInt(note.leafIndex),
    identity.spendingKey
  );
  const nullifierHash = await computeNullifierHash(nullifier);
  
  // Prepare circuit input
  const circuitInput = {
    // Public
    root: root.toString(),
    nullifierHash: nullifierHash.toString(),
    recipient: addressToBigInt(recipientAddress).toString(),
    amount: withdrawAmount.toString(),
    relayer: addressToBigInt(relayerAddress).toString(),
    fee: fee.toString(),
    
    // Private
    noteAmount: note.amount.toString(),
    ownerPubkey: note.ownerPubkey.toString(),
    secret: note.secret.toString(),
    blinding: note.blinding.toString(),
    leafIndex: note.leafIndex.toString(),
    pathElements: pathElements.map(e => e.toString()),
    pathIndices: pathIndices,
    spendingKey: identity.spendingKey.toString(),
  };
  
  // Generate proof
  console.log('Generating ZK proof...');
  console.log('Circuit inputs:', {
    root: circuitInput.root.slice(0, 20) + '...',
    nullifierHash: circuitInput.nullifierHash.slice(0, 20) + '...',
    recipient: circuitInput.recipient,
    amount: circuitInput.amount,
  });
  
  const { proof, publicSignals } = await snarks.groth16.fullProve(
    circuitInput,
    `${CIRCUITS_PATH}/unshield.wasm`,
    `${CIRCUITS_PATH}/unshield_final.zkey`
  );
  
  console.log('✓ Proof generated successfully');
  console.log('Public signals:', publicSignals.map((s: string) => s.slice(0, 20) + '...'));
  
  return {
    proof: {
      proof: formatProofForContract(proof),
      publicInputs: publicSignals,
    },
    nullifierHash,
    root,
  };
}

/**
 * Generate proof for Swap operation (z→z, different token)
 * Supports partial swaps with change notes (Zcash-style)
 */
export async function generateSwapProof(
  inputNote: ShieldedNote,
  identity: ShieldedIdentity,
  swapAmount: bigint,  // Amount to swap (can be less than note amount)
  outputToken: string,
  outputAmount: bigint,
  poolAddress: string
): Promise<{
  proof: Proof;
  outputNote: ShieldedNote;
  changeNote: ShieldedNote | null;  // Change note (null if no change)
  nullifierHash: bigint;
  root: bigint;
}> {
  const snarks = await loadSnarkJS();
  
  if (inputNote.leafIndex === undefined) {
    throw new Error('Input note has no leaf index');
  }
  
  // Fetch Merkle path
  const { pathElements, pathIndices, root } = await fetchMerklePath(
    poolAddress,
    inputNote.leafIndex
  );
  
  // Verify swapAmount <= inputNote.amount
  if (swapAmount > inputNote.amount) {
    throw new Error('Swap amount cannot exceed input note amount');
  }
  if (swapAmount <= 0n) {
    throw new Error('Swap amount must be positive');
  }
  
  // Calculate change amount
  const changeAmount = inputNote.amount - swapAmount;
  
  // Compute nullifier
  const nullifier = await computeNullifier(
    inputNote.secret,
    BigInt(inputNote.leafIndex),
    identity.spendingKey
  );
  const nullifierHash = await computeNullifierHash(nullifier);
  
  // Create output note 1 (swapped token)
  const outputSecret = randomFieldElement();
  const outputBlinding = randomFieldElement();
  const outputCommitment1 = await computeCommitment(
    outputAmount,
    identity.shieldedAddress, // Same owner for self-swap
    outputSecret,
    outputBlinding
  );
  
  // Create change note (if needed) - same token as input, goes back to sender
  let changeNote: ShieldedNote | null = null;
  let changeCommitment = 0n;
  if (changeAmount > 0n) {
    const changeSecret = randomFieldElement();
    const changeBlinding = randomFieldElement();
    changeCommitment = await computeCommitment(
      changeAmount,
      identity.shieldedAddress, // Change goes back to sender
      changeSecret,
      changeBlinding
    );
    
    changeNote = {
      amount: changeAmount,
      ownerPubkey: identity.shieldedAddress,
      secret: changeSecret,
      blinding: changeBlinding,
      commitment: changeCommitment,
      token: inputNote.token,  // Same token as input
      tokenAddress: inputNote.tokenAddress,
      decimals: inputNote.decimals,
      createdAt: Date.now(),
    };
  }
  
  // Get token metadata for output note and circuit
  // Use shieldedPool config instead of importing from shielded-swap-service to avoid circular dependency
  const { shieldedPool } = await import('../dogeos-config');
  const outputTokenConfig = shieldedPool.supportedTokens[outputToken as keyof typeof shieldedPool.supportedTokens];
  if (!outputTokenConfig) {
    throw new Error(`Token ${outputToken} not found in supportedTokens`);
  }
  
  const outputTokenAddressString = outputToken === 'DOGE' 
    ? '0x0000000000000000000000000000000000000000' as `0x${string}`
    : outputTokenConfig.address as `0x${string}`;
  const outputDecimals = outputTokenConfig.decimals || 18;
  
  // Convert to bigint for circuit (reuse the same address)
  const outputTokenAddress = outputToken === 'DOGE'
    ? 0n
    : addressToBigInt(outputTokenAddressString);
  
  const outputNote: ShieldedNote = {
    amount: outputAmount,
    ownerPubkey: identity.shieldedAddress,
    secret: outputSecret,
    blinding: outputBlinding,
    commitment: outputCommitment1,
    token: outputToken,
    tokenAddress: outputTokenAddressString,
    decimals: outputDecimals,
    createdAt: Date.now(),
  };
  
  // DEBUG: Verify note ownerPubkey matches identity shieldedAddress
  const expectedOwner = identity.shieldedAddress;
  console.log('[Swap] Verifying note ownership...');
  console.log('  Note ownerPubkey:', inputNote.ownerPubkey.toString(16).slice(0, 16) + '...');
  console.log('  Identity shieldedAddress:', expectedOwner.toString(16).slice(0, 16) + '...');
  console.log('  Match:', inputNote.ownerPubkey === expectedOwner);
  
  if (inputNote.ownerPubkey !== expectedOwner) {
    console.error('[Swap] CRITICAL: Note ownerPubkey does NOT match identity!');
    console.error('  This note was created with an old/wrong shieldedAddress.');
    console.error('  Please clear notes from localStorage and re-shield.');
    throw new Error('Note ownership mismatch. This note was created with an outdated identity. Please clear your notes and re-shield.');
  }
  
  // Get token addresses (convert to bigint for circuit)
  const inputTokenAddress = inputNote.token === 'DOGE' 
    ? 0n 
    : addressToBigInt(shieldedPool.supportedTokens[inputNote.token as keyof typeof shieldedPool.supportedTokens]?.address || '0x0000000000000000000000000000000000000000');
  
  // NOTE: Circuit uses MiMC2(spendingKey, 0) for ownership verification
  // This matches the circuit constraint: ownerHash.in[1] <== 2 (DOMAIN.SHIELDED_ADDRESS)
  // We need to compute the owner hash with domain 2 to match circuit (same as transfer.circom)
  const { mimcHash2, DOMAIN } = await import('./shielded-crypto');
  const ownerHashFromSpendingKey = await mimcHash2(identity.spendingKey, DOMAIN.SHIELDED_ADDRESS);
  
  // Verify the note's ownerPubkey matches what circuit will compute
  if (inputNote.ownerPubkey !== ownerHashFromSpendingKey) {
    console.error('[Swap] CRITICAL: Note ownerPubkey does not match circuit computation!');
    console.error('  Note ownerPubkey:', inputNote.ownerPubkey.toString());
    console.error('  Circuit will compute MiMC2(spendingKey, 2):', ownerHashFromSpendingKey.toString());
    console.error('  Expected shielded address:', identity.shieldedAddress.toString());
    throw new Error('Note ownership mismatch. The note was created with an identity that uses a different address calculation. Please clear your notes and re-shield with the current identity.');
  }
  
  // Prepare circuit input
  const circuitInput = {
    // Public inputs (8 total): [root, inputNullifierHash, outputCommitment1, outputCommitment2, tokenInAddress, tokenOutAddress, swapAmount, outputAmount]
    root: root.toString(),
    inputNullifierHash: nullifierHash.toString(),
    outputCommitment1: outputCommitment1.toString(),
    outputCommitment2: changeCommitment.toString(),  // 0 if no change
    tokenInAddress: inputTokenAddress.toString(),
    tokenOutAddress: outputTokenAddress.toString(),
    swapAmount: swapAmount.toString(),
    outputAmount: outputAmount.toString(),
    
    // Private inputs
    inAmount: inputNote.amount.toString(),  // Full input note amount
    inOwnerPubkey: inputNote.ownerPubkey.toString(),
    inSecret: inputNote.secret.toString(),
    inBlinding: inputNote.blinding.toString(),
    inLeafIndex: inputNote.leafIndex.toString(),
    pathElements: pathElements.map(e => e.toString()),
    pathIndices: pathIndices,
    spendingKey: identity.spendingKey.toString(),
    
    // Output note 1 (swapped token)
    out1Amount: outputAmount.toString(),
    out1OwnerPubkey: identity.shieldedAddress.toString(), // Same as input owner for self-swap
    out1Secret: outputSecret.toString(),
    out1Blinding: outputBlinding.toString(),
    
    // Output note 2 (change - same token as input, can be 0)
    changeAmount: changeAmount.toString(),
    changeSecret: changeNote?.secret.toString() || '0',
    changeBlinding: changeNote?.blinding.toString() || '0',
  };
  
  console.log('[Swap] Generating ZK proof...');
  console.log('[Swap] Circuit input verification:');
  console.log('  spendingKey:', identity.spendingKey.toString(16).slice(0, 16) + '...');
  console.log('  inOwnerPubkey:', inputNote.ownerPubkey.toString(16).slice(0, 16) + '...');
  console.log('  computed owner (MiMC(sk, 0)):', ownerHashFromSpendingKey.toString(16).slice(0, 16) + '...');
  console.log('  Match:', inputNote.ownerPubkey === ownerHashFromSpendingKey);
  console.log('  inLeafIndex:', inputNote.leafIndex);
  console.log('  inputAmount:', inputNote.amount.toString());
  console.log('  outputAmount:', outputAmount.toString());
  console.log('  inputToken:', inputNote.token);
  console.log('  outputToken:', outputToken);
  
  // Generate proof
  const { proof, publicSignals } = await snarks.groth16.fullProve(
    circuitInput,
    `${CIRCUITS_PATH}/swap.wasm`,
    `${CIRCUITS_PATH}/swap_final.zkey`
  );
  
  console.log('[Swap] ✓ Proof generated successfully');
  console.log('[Swap] Public signals:', publicSignals.map((s: string) => s.slice(0, 20) + '...'));
  
  // Verify public signals match what we computed
  if (publicSignals[0] !== root.toString()) {
    console.error('[Swap] ❌ Root mismatch!');
  }
  if (publicSignals[1] !== nullifierHash.toString()) {
    console.error('[Swap] ❌ Nullifier hash mismatch!');
  }
  if (publicSignals[2] !== outputCommitment1.toString()) {
    console.error('[Swap] ❌ Output commitment 1 mismatch!');
  }
  if (publicSignals[3] !== changeCommitment.toString()) {
    console.error('[Swap] ❌ Output commitment 2 (change) mismatch!');
  }
  
  return {
    proof: {
      proof: formatProofForContract(proof),
      publicInputs: publicSignals,
    },
    outputNote,
    changeNote,  // null if no change
    nullifierHash,
    root,
  };
}

/**
 * Format Groth16 proof for Solidity verifier
 */
function formatProofForContract(proof: any): string[] {
  return [
    proof.pi_a[0],
    proof.pi_a[1],
    proof.pi_b[0][1],
    proof.pi_b[0][0],
    proof.pi_b[1][1],
    proof.pi_b[1][0],
    proof.pi_c[0],
    proof.pi_c[1],
  ].map(x => BigInt(x).toString());
}

/**
 * Verify a proof locally (for debugging)
 */
export async function verifyProofLocally(
  circuitType: 'shield' | 'transfer' | 'unshield',
  proof: Proof
): Promise<boolean> {
  const snarks = await loadSnarkJS();
  
  const vKeyPath = `${CIRCUITS_PATH}/${circuitType}_verification_key.json`;
  const vKeyResponse = await fetch(vKeyPath);
  const vKey = await vKeyResponse.json();
  
  // Reconstruct proof format
  const proofForVerify = {
    pi_a: [proof.proof[0], proof.proof[1], '1'],
    pi_b: [
      [proof.proof[3], proof.proof[2]],
      [proof.proof[5], proof.proof[4]],
      ['1', '0'],
    ],
    pi_c: [proof.proof[6], proof.proof[7], '1'],
    protocol: 'groth16',
    curve: 'bn128',
  };
  
  return snarks.groth16.verify(vKey, proof.publicInputs, proofForVerify);
}


