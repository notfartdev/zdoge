/**
 * Transaction Simulation Service
 * 
 * Pre-validates transactions before proof submission to prevent failures.
 */

import { type Address, createPublicClient, http } from 'viem';
import { dogeosTestnet, config } from '../config.js';
import { isNullifierSpent } from './shielded-indexer.js';

const publicClient = createPublicClient({
  chain: dogeosTestnet,
  transport: http(config.rpcUrl),
});

// ShieldedPool ABI (minimal for simulation) - matching the one in shielded-routes.ts
const ShieldedPoolABI = [
  {
    type: 'function',
    name: 'unshieldNative',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_root', type: 'bytes32' },
      { name: '_nullifierHash', type: 'bytes32' },
      { name: '_recipient', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_relayer', type: 'address' },
      { name: '_fee', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isSpent',
    inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isKnownRoot',
    inputs: [{ name: 'root', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_root', type: 'bytes32' },
      { name: '_nullifierHash', type: 'bytes32' },
      { name: '_outputCommitment1', type: 'bytes32' },
      { name: '_outputCommitment2', type: 'bytes32' },
      { name: '_relayer', type: 'address' },
      { name: '_fee', type: 'uint256' },
      { name: '_memo1', type: 'bytes' },
      { name: '_memo2', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'swap',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_root', type: 'bytes32' },
      { name: '_inputNullifierHash', type: 'bytes32' },
      { name: '_outputCommitment1', type: 'bytes32' },
      { name: '_outputCommitment2', type: 'bytes32' },
      { name: '_tokenIn', type: 'address' },
      { name: '_tokenOut', type: 'address' },
      { name: '_swapAmount', type: 'uint256' },
      { name: '_outputAmount', type: 'uint256' },
      { name: '_minAmountOut', type: 'uint256' },
      { name: '_memo', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as any; // Use 'as any' to avoid TypeScript strict type checking issues with viem

export interface SimulationResult {
  wouldPass: boolean;
  decodedError?: string;
  estimatedFee: string;
  suggestion: string;
  checks: {
    proofFormat: boolean | null;
    nullifierSpent: boolean | null;
    rootValid: boolean | null;
  };
}

export interface SimulationParams {
  operation: 'transfer' | 'unshield' | 'swap';
  poolAddress: string;
  proof?: string[];
  root?: string;
  nullifierHash?: string;
  recipient?: string;
  amount?: string;
  fee?: string;
  token?: string;
  relayerAddress?: string;
  // Transfer-specific
  outputCommitment1?: string;
  outputCommitment2?: string;
  // Swap-specific
  tokenIn?: string;
  tokenOut?: string;
  swapAmount?: string;
  outputAmount?: string;
  minAmountOut?: string;
  encryptedMemo?: string;
}

export async function simulateTransaction(
  params: SimulationParams
): Promise<SimulationResult> {
  const {
    operation,
    poolAddress,
    proof,
    root,
    nullifierHash,
    recipient,
    amount,
    fee,
    token,
    relayerAddress = '0x0000000000000000000000000000000000000000',
    // Transfer-specific
    outputCommitment1,
    outputCommitment2,
    // Swap-specific
    tokenIn,
    tokenOut,
    swapAmount,
    outputAmount,
    minAmountOut,
    encryptedMemo,
  } = params;

  // Initialize checks
  const checks = {
    proofFormat: null as boolean | null,
    nullifierSpent: null as boolean | null,
    rootValid: null as boolean | null,
  };

  // Check proof format
  if (proof) {
    checks.proofFormat = Array.isArray(proof) && proof.length === 8;
    if (!checks.proofFormat) {
      return {
        wouldPass: false,
        estimatedFee: fee || '0',
        suggestion: 'Proof must be an array of 8 elements',
        checks,
      };
    }
  }

  // Check if nullifier is spent - use the helper function from shielded-indexer
  if (nullifierHash && poolAddress) {
    try {
      const spent = await isNullifierSpent(poolAddress, nullifierHash);
      checks.nullifierSpent = !spent;
      
      if (spent) {
        return {
          wouldPass: false,
          decodedError: 'Nullifier already spent',
          estimatedFee: fee || '0',
          suggestion: 'This note has already been spent. Use a different note.',
          checks,
        };
      }
    } catch (error) {
      // If check fails, continue with simulation
      console.warn('[Simulate] Failed to check nullifier:', error);
    }
  }

  // Check if root is valid - use try-catch to handle RPC issues
  if (root && poolAddress) {
    try {
      // Use type assertion to bypass strict TypeScript checking
      const isValidRoot = await (publicClient.readContract as any)({
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'isKnownRoot',
        args: [root as `0x${string}`],
      });
      checks.rootValid = isValidRoot;
      
      if (!isValidRoot) {
        return {
          wouldPass: false,
          decodedError: 'Unknown Merkle root',
          estimatedFee: fee || '0',
          suggestion: 'Root is not in the pool\'s history. Sync your notes and try again.',
          checks,
        };
      }
    } catch (error) {
      console.warn('[Simulate] Failed to check root:', error);
    }
  }

  // Simulate the actual transaction
  let wouldPass = false;
  let decodedError: string | undefined;

  try {
    const proofBigInts = proof?.map((p: string) => BigInt(p)) || [];
    const isNative = !token || token === '0x0000000000000000000000000000000000000000';

    if (operation === 'unshield' && root && nullifierHash && recipient && amount) {
      // Use type assertion to bypass strict TypeScript checking for simulateContract
      await (publicClient.simulateContract as any)({
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'unshieldNative',
        args: [
          proofBigInts as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
          root as `0x${string}`,
          nullifierHash as `0x${string}`,
          recipient as Address,
          BigInt(amount),
          relayerAddress as Address,
          BigInt(fee || '0'),
        ],
        account: relayerAddress as Address,
      });
      
      wouldPass = true;
    } else if (operation === 'transfer') {
      // Check required params for transfer
      if (!root || !nullifierHash || !outputCommitment1 || !outputCommitment2 || fee === undefined) {
        const missing: string[] = [];
        if (!root) missing.push('root');
        if (!nullifierHash) missing.push('nullifierHash');
        if (!outputCommitment1) missing.push('outputCommitment1');
        if (!outputCommitment2) missing.push('outputCommitment2');
        if (fee === undefined) missing.push('fee');
        decodedError = `Missing required parameters: ${missing.join(', ')}`;
      } else {
        // Simulate transfer
      await (publicClient.simulateContract as any)({
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'transfer',
        args: [
          proofBigInts as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
          root as `0x${string}`,
          nullifierHash as `0x${string}`,
          outputCommitment1 as `0x${string}`,
          outputCommitment2 as `0x${string}`,
          relayerAddress as Address,
          BigInt(fee),
          (encryptedMemo || '0x') as `0x${string}`,  // memo1
          '0x' as `0x${string}`,  // memo2 (placeholder)
        ],
        account: relayerAddress as Address,
      });
      
      wouldPass = true;
      }
    } else if (operation === 'swap') {
      // Check required params for swap
      if (!root || !nullifierHash || !outputCommitment1 || !tokenIn || !tokenOut || !swapAmount || !outputAmount || minAmountOut === undefined) {
        const missing: string[] = [];
        if (!root) missing.push('root');
        if (!nullifierHash) missing.push('nullifierHash');
        if (!outputCommitment1) missing.push('outputCommitment1');
        if (!tokenIn) missing.push('tokenIn');
        if (!tokenOut) missing.push('tokenOut');
        if (!swapAmount) missing.push('swapAmount');
        if (!outputAmount) missing.push('outputAmount');
        if (minAmountOut === undefined) missing.push('minAmountOut');
        decodedError = `Missing required parameters: ${missing.join(', ')}`;
        console.warn('[Simulate] Swap missing params:', { 
          missing, 
          received: { 
            root: !!root, 
            nullifierHash: !!nullifierHash, 
            outputCommitment1: !!outputCommitment1, 
            tokenIn: !!tokenIn, 
            tokenOut: !!tokenOut, 
            swapAmount: !!swapAmount, 
            outputAmount: !!outputAmount, 
            minAmountOut: minAmountOut !== undefined 
          },
          values: {
            root: root?.slice(0, 20),
            nullifierHash: nullifierHash?.slice(0, 20),
            outputCommitment1: outputCommitment1?.slice(0, 20),
            tokenIn,
            tokenOut,
            swapAmount,
            outputAmount,
            minAmountOut,
          }
        });
      } else {
        // Simulate swap
        console.log('[Simulate] Simulating swap transaction...');
        await (publicClient.simulateContract as any)({
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'swap',
        args: [
          proofBigInts as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
          root as `0x${string}`,
          nullifierHash as `0x${string}`,
          outputCommitment1 as `0x${string}`,
          (outputCommitment2 || '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
          tokenIn as Address,
          tokenOut as Address,
          BigInt(swapAmount),
          BigInt(outputAmount),
          BigInt(minAmountOut),
          (encryptedMemo || '0x') as `0x${string}`,
        ],
        account: relayerAddress as Address,
      });
      
      wouldPass = true;
      }
    } else {
      // Missing required parameters - log for debugging
      const missingParams: string[] = [];
      if (!root) missingParams.push('root');
      if (!nullifierHash) missingParams.push('nullifierHash');
      if (operation === 'transfer' || operation === 'swap') {
        if (!outputCommitment1) missingParams.push('outputCommitment1');
        if (operation === 'transfer' && !outputCommitment2) missingParams.push('outputCommitment2');
      }
      if (operation === 'unshield') {
        if (!recipient) missingParams.push('recipient');
        if (!amount) missingParams.push('amount');
      }
      if (operation === 'swap') {
        if (!tokenIn) missingParams.push('tokenIn');
        if (!tokenOut) missingParams.push('tokenOut');
        if (!swapAmount) missingParams.push('swapAmount');
        if (!outputAmount) missingParams.push('outputAmount');
        if (minAmountOut === undefined) missingParams.push('minAmountOut');
      }
      
      console.warn('[Simulate] Missing required parameters for operation:', {
        operation,
        missingParams,
        received: {
          root: !!root,
          nullifierHash: !!nullifierHash,
          outputCommitment1: !!outputCommitment1,
          outputCommitment2: !!outputCommitment2,
          recipient: !!recipient,
          amount: !!amount,
          tokenIn: !!tokenIn,
          tokenOut: !!tokenOut,
          swapAmount: !!swapAmount,
          outputAmount: !!outputAmount,
          minAmountOut: minAmountOut !== undefined,
        },
      });
    }

  } catch (simError: any) {
    wouldPass = false;
    
    // Extract error message
    if (simError.shortMessage) {
      decodedError = simError.shortMessage;
    } else if (simError.message) {
      decodedError = simError.message;
    }

    // Try to decode revert reason
    if (simError.cause?.data) {
      try {
        const errorData = simError.cause.data;
        // Map common error selectors to messages
        if (typeof errorData === 'string' && errorData.startsWith('0x')) {
          // Decode known errors
          if (errorData.includes('InvalidProof')) {
            decodedError = 'Invalid proof';
          } else if (errorData.includes('NullifierAlreadySpent')) {
            decodedError = 'Note already spent';
          } else if (errorData.includes('InvalidMerkleRoot')) {
            decodedError = 'Invalid Merkle root';
          }
        }
      } catch (e) {
        // Fallback to generic error
      }
    }
  }

  // Calculate estimated fee if not provided
  let estimatedFee = fee || '0';
  if (amount && !fee) {
    // Default 0.5% fee
    const feePercent = 0.5;
    const calculatedFee = (BigInt(amount) * BigInt(Math.floor(feePercent * 100))) / 10000n;
    const minFee = BigInt('1000000000000000'); // 0.001 tokens (18 decimals)
    estimatedFee = (calculatedFee < minFee ? minFee : calculatedFee).toString();
  }

  return {
    wouldPass,
    decodedError,
    estimatedFee,
    suggestion: wouldPass
      ? 'Transaction would succeed. You can proceed with submission.'
      : decodedError
        ? `Transaction would fail: ${decodedError}`
        : 'Transaction may fail. Please check your inputs.',
    checks,
  };
}
