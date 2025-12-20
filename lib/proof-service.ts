/**
 * Proof Service for Dogenado
 * 
 * Handles ZK proof generation for withdrawals using snarkjs.
 * Proofs are generated client-side for maximum privacy.
 * 
 * Security: Circuit files are verified via hash checks before use
 * to prevent tampering (SRI for circuit files).
 */

import type { Note } from './note-service';
import { toBytes32 } from './mimc';
import { api, tokenPools, tokens } from './dogeos-config';
import { verifyCircuitFile } from './circuit-verification';

export interface MerklePath {
  pathElements: string[];
  pathIndices: number[];
  root: string;
}

export interface ProofInput {
  // Public inputs
  root: bigint;
  nullifierHash: bigint;
  recipient: bigint;
  relayer: bigint;
  fee: bigint;
  denomination: bigint;
  
  // Private inputs
  secret: bigint;
  nullifier: bigint;
  pathElements: bigint[];
  pathIndices: number[];
}

export interface Proof {
  proof: string[];
  publicInputs: string[];
}

// Cache for loaded snarkjs
let snarkjsLoaded = false;
let snarkjs: any = null;

// Cache for circuit artifacts
let wasmLoaded = false;
let zkeyLoaded = false;

/**
 * Load snarkjs library dynamically
 */
async function loadSnarkJS(): Promise<any> {
  if (snarkjsLoaded && snarkjs) {
    return snarkjs;
  }
  
  // Dynamic import for browser
  snarkjs = await import('snarkjs');
  snarkjsLoaded = true;
  return snarkjs;
}

/**
 * Fetch Merkle path from indexer
 */
export async function fetchMerklePath(
  poolAddress: string,
  leafIndex: number
): Promise<MerklePath> {
  const response = await fetchWithTimeout(
    `${api.indexer}/api/pool/${poolAddress}/path/${leafIndex}`,
    {},
    10000 // 10 second timeout
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch Merkle path');
  }
  
  return response.json();
}

/**
 * Fetch latest root from indexer
 */
export async function fetchLatestRoot(poolAddress: string): Promise<string> {
  const response = await fetch(`${api.indexer}/api/pool/${poolAddress}/root`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch root');
  }
  
  const data = await response.json();
  return data.root;
}

/**
 * Fetch deposit info from indexer
 */
export async function fetchDepositInfo(
  poolAddress: string, 
  commitment: string
): Promise<{ leafIndex: number; timestamp: number } | null> {
  try {
    const response = await fetchWithTimeout(
      `${api.indexer}/api/pool/${poolAddress}/deposit/${commitment}`,
      {},
      10000 // 10 second timeout
    );
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error('Failed to fetch deposit info');
    }
    
    return response.json();
  } catch (err: any) {
    console.error('[Proof] Fetch deposit info error:', err.message);
    return null;
  }
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if nullifier is spent
 */
export async function isNullifierSpent(
  poolAddress: string,
  nullifierHash: string
): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${api.indexer}/api/pool/${poolAddress}/nullifier/${nullifierHash}`,
      {},
      5000 // 5 second timeout
    );
    
    if (!response.ok) {
      console.warn('[Proof] Nullifier check failed:', response.status);
      return false; // Assume not spent if we can't check
    }
    
    const data = await response.json();
    return data.isSpent;
  } catch (err: any) {
    console.warn('[Proof] Nullifier check error:', err.message);
    return false; // Assume not spent if we can't check
  }
}

/**
 * Generate ZK proof for withdrawal
 */
export async function generateProof(input: ProofInput): Promise<Proof> {
  console.log('[Proof] Generating proof...');
  
  const snarkjs = await loadSnarkJS();
  
  // Prepare circuit input
  const circuitInput = {
    // Public inputs
    root: input.root.toString(),
    nullifierHash: input.nullifierHash.toString(),
    recipient: input.recipient.toString(),
    relayer: input.relayer.toString(),
    fee: input.fee.toString(),
    denomination: input.denomination.toString(),
    
    // Private inputs
    secret: input.secret.toString(),
    nullifier: input.nullifier.toString(),
    pathElements: input.pathElements.map(e => e.toString()),
    pathIndices: input.pathIndices,
  };
  
  console.log('[Proof] Circuit input prepared');
  
  try {
    // Load circuit artifacts from public folder
    const wasmPath = '/circuits/withdraw.wasm';
    const zkeyPath = '/circuits/withdraw_final.zkey';
    
    // Verify circuit files before use (SRI check)
    console.log('[Proof] Verifying circuit file integrity...');
    
    const wasmVerification = await verifyCircuitFile(wasmPath);
    if (!wasmVerification.valid) {
      throw new Error(`Circuit WASM verification failed: ${wasmVerification.error}`);
    }
    
    const zkeyVerification = await verifyCircuitFile(zkeyPath);
    if (!zkeyVerification.valid) {
      throw new Error(`Circuit ZKey verification failed: ${zkeyVerification.error}`);
    }
    
    console.log('[Proof] Circuit files verified ✓');
    
    // Generate proof using snarkjs
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInput,
      wasmPath,
      zkeyPath
    );
    
    console.log('[Proof] Proof generated successfully');
    
    // Convert proof to contract format [a.x, a.y, b[0][0], b[0][1], b[1][0], b[1][1], c.x, c.y]
    const proofForContract = [
      proof.pi_a[0],
      proof.pi_a[1],
      proof.pi_b[0][1], // Note: pi_b is reversed in snarkjs
      proof.pi_b[0][0],
      proof.pi_b[1][1],
      proof.pi_b[1][0],
      proof.pi_c[0],
      proof.pi_c[1],
    ];
    
    return {
      proof: proofForContract,
      publicInputs: publicSignals,
    };
  } catch (error: any) {
    console.error('[Proof] Error generating proof:', error);
    throw new Error(`Proof generation failed: ${error.message}`);
  }
}

/**
 * Generate mock proof for development/testing
 * Works with the mock verifier that accepts any non-zero proof
 */
export function generateMockProof(input: ProofInput): Proof {
  console.log('[Proof] Generating mock proof (development mode)');
  
  // 8 non-zero values for proof
  const mockProof = [
    '0x1111111111111111111111111111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333333333333333333333333333',
    '0x4444444444444444444444444444444444444444444444444444444444444444',
    '0x5555555555555555555555555555555555555555555555555555555555555555',
    '0x6666666666666666666666666666666666666666666666666666666666666666',
    '0x7777777777777777777777777777777777777777777777777777777777777777',
    '0x8888888888888888888888888888888888888888888888888888888888888888',
  ];
  
  return {
    proof: mockProof,
    publicInputs: [
      toBytes32(input.root),
      toBytes32(input.nullifierHash),
      `0x${input.recipient.toString(16).padStart(40, '0')}`,
      `0x${input.relayer.toString(16).padStart(40, '0')}`,
      input.fee.toString(),
      input.denomination.toString(),
    ],
  };
}

/**
 * Submit withdrawal via relayer
 */
export async function submitWithdrawal(
  poolAddress: string,
  proof: Proof,
  root: string,
  nullifierHash: string,
  recipient: string,
  fee: string
): Promise<{ txHash: string; requestId: string }> {
  console.log('[Proof] Submitting withdrawal to relayer...');
  
  const response = await fetch(`${api.relayer}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      poolAddress,
      proof: proof.proof,
      root,
      nullifierHash,
      recipient,
      fee,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Relayer error' }));
    throw new Error(error.error || 'Withdrawal failed');
  }
  
  const result = await response.json();
  console.log('[Proof] Withdrawal submitted:', result.txHash);
  
  return result;
}

/**
 * Check withdrawal status
 */
export async function checkWithdrawalStatus(
  nullifierHash: string
): Promise<{ status: string; txHash?: string; error?: string }> {
  const response = await fetch(
    `${api.relayer}/withdraw/${nullifierHash}/status`
  );
  
  if (!response.ok) {
    throw new Error('Failed to check status');
  }
  
  return response.json();
}

/**
 * Prepare withdrawal input from note
 */
export async function prepareWithdrawalInput(
  note: Note,
  poolAddress: string,
  recipientAddress: string,
  relayerAddress: string = '0x0000000000000000000000000000000000000000',
  fee: bigint = 0n
): Promise<ProofInput> {
  // Get commitment bytes
  const commitmentHex = toBytes32(note.commitment);
  
  // Fetch deposit info from indexer
  const depositInfo = await fetchDepositInfo(poolAddress, commitmentHex);
  if (!depositInfo) {
    throw new Error('Deposit not found. Has it been indexed?');
  }
  
  // Fetch Merkle path
  const merklePath = await fetchMerklePath(poolAddress, depositInfo.leafIndex);
  
  // Get pool denomination by searching all token pools
  let poolDenomination: bigint | null = null;
  
  for (const [tokenSymbol, config] of Object.entries(tokenPools)) {
    for (const [amount, address] of Object.entries(config.pools)) {
      if ((address as string).toLowerCase() === poolAddress.toLowerCase()) {
        const tokenInfo = tokens[tokenSymbol as keyof typeof tokens];
        poolDenomination = BigInt(Math.round(parseFloat(amount) * (10 ** tokenInfo.decimals)));
        break;
      }
    }
    if (poolDenomination) break;
  }
  
  if (!poolDenomination) {
    throw new Error('Unknown pool address');
  }
  
  // Parse addresses to bigint
  const recipient = BigInt(recipientAddress);
  const relayer = BigInt(relayerAddress);
  
  return {
    root: BigInt(merklePath.root),
    nullifierHash: note.nullifierHash,
    recipient,
    relayer,
    fee,
    denomination: poolDenomination,
    secret: note.secret,
    nullifier: note.nullifier,
    pathElements: merklePath.pathElements.map(e => BigInt(e)),
    pathIndices: merklePath.pathIndices,
  };
}
