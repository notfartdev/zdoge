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
  console.log(`[Merkle] Zero value: ${ZERO_VALUE}`);
  return ZERO_VALUE;
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
async function fetchCommitmentsFromChain(poolAddress: string): Promise<{ commitment: bigint; leafIndex: number }[]> {
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
    
    // The Shielded/Deposit event has 3 topics: [eventSig, commitment, leafIndex]
    // Filter logs that have exactly 3 topics (deposit-style events)
    const depositLogs = logs.filter((log: any) => 
      log.topics && log.topics.length >= 3
    );
    
    console.log(`Found ${depositLogs.length} deposit-style events`);
    
    // Extract commitments from logs
    // commitment is topics[1], leafIndex is topics[2]
    const results: { commitment: bigint; leafIndex: number }[] = depositLogs.map((log: any) => {
      const commitment = BigInt(log.topics[1]);
      const leafIndex = parseInt(log.topics[2], 16);
      console.log(`  Commitment: ${log.topics[1].slice(0, 20)}... leafIndex: ${leafIndex}`);
      return { commitment, leafIndex };
    });
    
    // Sort by leafIndex to ensure correct order
    results.sort((a, b) => a.leafIndex - b.leafIndex);
    
    return results;
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

/**
 * Fetch Merkle path - tries indexer first, falls back to client-side
 */
export async function fetchMerklePath(
  poolAddress: string,
  leafIndex: number,
  forceClientSide: boolean = false
): Promise<{ pathElements: bigint[]; pathIndices: number[]; root: bigint }> {
  // Always use client-side for freshest data (indexer may lag)
  // This ensures newly shielded notes can be immediately spent
  if (!forceClientSide) {
    // Try indexer first but with short timeout
    try {
      const response = await fetch(
        `${INDEXER_URL}/api/shielded/pool/${poolAddress}/path/${leafIndex}`,
        { signal: AbortSignal.timeout(3000) } // 3 second timeout
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Verify the indexer has this leaf
        if (data.pathElements && data.pathElements.length > 0) {
          console.log('[Merkle] Got path from indexer');
          
          // Double-check: verify this root exists on-chain
          const indexerRoot = BigInt(data.root);
          const isKnown = await checkIfRootIsKnown(poolAddress, indexerRoot);
          
          if (isKnown) {
            return {
              pathElements: data.pathElements.map((e: string) => BigInt(e)),
              pathIndices: data.pathIndices,
              root: indexerRoot,
            };
          } else {
            console.log('[Merkle] Indexer root not known on-chain, using client-side...');
          }
        } else {
          console.log('[Merkle] Indexer returned empty path, using client-side...');
        }
      } else {
        console.log(`[Merkle] Indexer returned ${response.status}, falling back to client-side...`);
      }
    } catch (error) {
      console.log('[Merkle] Indexer timeout/error, building Merkle tree client-side...');
    }
  } else {
    console.log('[Merkle] Forced client-side Merkle tree building...');
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
  const result = await buildMerkleTreeAndGetPath(commitments, leafIndex);
  
  // Log computed root for debugging
  console.log(`[Merkle] Computed root: ${result.root.toString(16).slice(0, 20)}...`);
  
  // Verify against contract root - CRITICAL for proof to work
  try {
    const contractRoot = await fetchContractRoot(poolAddress);
    console.log(`[Merkle] Contract root: 0x${contractRoot.toString(16)}`);
    console.log(`[Merkle] Computed root: 0x${result.root.toString(16)}`);
    
    if (contractRoot !== result.root) {
      console.error(`[Merkle] ❌ ROOT MISMATCH!`);
      console.error(`[Merkle] Contract: 0x${contractRoot.toString(16)}`);
      console.error(`[Merkle] Computed: 0x${result.root.toString(16)}`);
      console.error(`[Merkle] This means the MiMC hash implementation differs between client and contract.`);
      
      // Check if it's a known root (might be old)
      const isKnown = await checkIfRootIsKnown(poolAddress, result.root);
      if (!isKnown) {
        throw new Error(`ROOT MISMATCH: Computed root does not exist on-chain. The MiMC implementation may differ.`);
      }
    } else {
      console.log(`[Merkle] ✓ Roots match perfectly!`);
    }
  } catch (e: any) {
    if (e.message?.includes('ROOT MISMATCH')) {
      throw e; // Re-throw root mismatch errors
    }
    console.warn(`[Merkle] Could not verify against contract root:`, e);
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


