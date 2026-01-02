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

/**
 * Build Merkle tree from leaves and get path
 * Uses proper MiMC hash matching the circuit
 */
async function buildMerkleTreeAndGetPath(
  leaves: bigint[],
  leafIndex: number
): Promise<{ pathElements: bigint[]; pathIndices: number[]; root: bigint }> {
  const depth = TREE_DEPTH;
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  
  // Initialize MiMC and get zero value
  await initMimcForTree();
  const zeroValue = await getZeroValue();
  
  // Pad leaves to power of 2
  const treeSize = Math.pow(2, depth);
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < treeSize) {
    paddedLeaves.push(zeroValue);
  }
  
  let currentLevel = paddedLeaves;
  let currentIndex = leafIndex;
  
  for (let level = 0; level < depth; level++) {
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    pathElements.push(currentLevel[siblingIndex] || zeroValue);
    pathIndices.push(currentIndex % 2);
    
    // Build next level with proper MiMC hashing
    const nextLevel: bigint[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || zeroValue;
      nextLevel.push(await mimcHash(left, right));
    }
    
    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  return {
    pathElements,
    pathIndices,
    root: currentLevel[0],
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
 * Fetch Merkle path - tries indexer first, falls back to client-side
 */
export async function fetchMerklePath(
  poolAddress: string,
  leafIndex: number
): Promise<{ pathElements: bigint[]; pathIndices: number[]; root: bigint }> {
  // Try indexer first
  try {
    const response = await fetch(
      `${INDEXER_URL}/api/pool/${poolAddress}/path/${leafIndex}`,
      { signal: AbortSignal.timeout(3000) } // 3 second timeout
    );
    
    if (response.ok) {
      const data = await response.json();
      return {
        pathElements: data.pathElements.map((e: string) => BigInt(e)),
        pathIndices: data.pathIndices,
        root: BigInt(data.root),
      };
    }
  } catch (error) {
    console.log('Indexer not available, building Merkle tree client-side...');
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
  return await buildMerkleTreeAndGetPath(commitments, leafIndex);
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
  const snarks = await loadSnarkJS();
  
  if (note.leafIndex === undefined) {
    throw new Error('Note has no leaf index');
  }
  
  // Verify value conservation
  if (withdrawAmount + fee !== note.amount) {
    throw new Error(`Value mismatch: ${withdrawAmount} + ${fee} != ${note.amount}`);
  }
  
  // Fetch Merkle path
  const { pathElements, pathIndices, root } = await fetchMerklePath(
    poolAddress,
    note.leafIndex
  );
  
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
  const { proof, publicSignals } = await snarks.groth16.fullProve(
    circuitInput,
    `${CIRCUITS_PATH}/unshield.wasm`,
    `${CIRCUITS_PATH}/unshield_final.zkey`
  );
  
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


