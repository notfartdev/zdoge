/**
 * Contract Service for Dogenado
 * 
 * Handles all smart contract interactions for deposit/withdraw
 */

import { evmWalletService } from './evm-wallet';
import { dogeosTestnet, pools, tokens, MixerPoolABI, ERC20ABI, DogeRouterABI, api, contracts } from './dogeos-config';

// Encode function call data
function encodeFunctionData(abi: readonly any[], functionName: string, args: any[]): string {
  const func = abi.find(f => f.type === 'function' && f.name === functionName);
  if (!func) throw new Error(`Function ${functionName} not found in ABI`);

  // Simple ABI encoding
  const selector = getFunctionSelector(func);
  const encodedArgs = encodeArguments(func.inputs, args);
  
  return selector + encodedArgs;
}

function getFunctionSelector(func: any): string {
  const sig = `${func.name}(${func.inputs.map((i: any) => i.type).join(',')})`;
  return keccak256(sig).slice(0, 10);
}

function encodeArguments(inputs: any[], args: any[]): string {
  return inputs.map((input, i) => {
    const arg = args[i];
    if (input.type === 'bytes32') {
      return arg.toString().replace('0x', '').padStart(64, '0');
    }
    if (input.type === 'address') {
      return arg.toString().replace('0x', '').padStart(64, '0');
    }
    if (input.type === 'uint256') {
      return BigInt(arg).toString(16).padStart(64, '0');
    }
    if (input.type === 'uint256[8]') {
      return arg.map((v: any) => BigInt(v).toString(16).padStart(64, '0')).join('');
    }
    throw new Error(`Unsupported type: ${input.type}`);
  }).join('');
}

// Simple keccak256 using SubtleCrypto isn't available for keccak
// We'll use a lightweight implementation
function keccak256(input: string): string {
  // For function selectors, we need proper keccak256
  // We'll use the pre-computed selectors for our known functions
  const selectors: Record<string, string> = {
    'deposit(bytes32)': '0xb214faa5',
    'withdraw(uint256[8],bytes32,bytes32,address,address,uint256)': '0x21a0adb6',
    'approve(address,uint256)': '0x095ea7b3',
    'balanceOf(address)': '0x70a08231',
    'allowance(address,address)': '0xdd62ed3e',
    'getPoolInfo()': '0x2f3a3d5d',
    'getLatestRoot()': '0x1bf7e13e',
    'isSpent(bytes32)': '0xe5285dcc',
    'isKnownRoot(bytes32)': '0x6d9833e3',
    // DogeRouter selectors
    'depositDoge(address,bytes32)': '0x8c3c4b35',
    'withdrawDoge(address,uint256[8],bytes32,bytes32,address,address,uint256)': '0x5a7d5b4a',
  };
  
  return selectors[input] || '0x00000000';
}

export interface PoolInfo {
  token: string;
  denomination: bigint;
  depositsCount: bigint;
  root: string;
}

export interface DepositResult {
  txHash: string;
  commitment: string;
  leafIndex: number;
}

export interface WithdrawResult {
  txHash: string;
  recipient: string;
  fee: bigint;
}

class ContractService {
  private static instance: ContractService;
  
  private constructor() {}
  
  static getInstance(): ContractService {
    if (!ContractService.instance) {
      ContractService.instance = new ContractService();
    }
    return ContractService.instance;
  }

  /**
   * Get pool information from contract
   */
  async getPoolInfo(poolAddress: string): Promise<PoolInfo> {
    const response = await fetch(`${api.indexer}/api/pool/${poolAddress}`);
    if (!response.ok) {
      throw new Error('Failed to fetch pool info');
    }
    const data = await response.json();
    return {
      token: data.token,
      denomination: BigInt(data.denomination),
      depositsCount: BigInt(data.depositsCount),
      root: data.root,
    };
  }

  /**
   * Get latest Merkle root from indexer
   */
  async getLatestRoot(poolAddress: string): Promise<string> {
    const response = await fetch(`${api.indexer}/api/pool/${poolAddress}/root`);
    if (!response.ok) {
      throw new Error('Failed to fetch root');
    }
    const data = await response.json();
    return data.root;
  }

  /**
   * Get Merkle path for a leaf index
   */
  async getMerklePath(poolAddress: string, leafIndex: number): Promise<{
    pathElements: string[];
    pathIndices: number[];
    root: string;
  }> {
    const response = await fetch(`${api.indexer}/api/pool/${poolAddress}/path/${leafIndex}`);
    if (!response.ok) {
      throw new Error('Failed to fetch Merkle path');
    }
    return await response.json();
  }

  /**
   * Check if nullifier is spent
   */
  async isNullifierSpent(poolAddress: string, nullifierHash: string): Promise<boolean> {
    const response = await fetch(`${api.indexer}/api/pool/${poolAddress}/nullifier/${nullifierHash}`);
    if (!response.ok) {
      throw new Error('Failed to check nullifier');
    }
    const data = await response.json();
    return data.isSpent;
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<bigint> {
    const connection = evmWalletService.getConnection();
    if (!connection) throw new Error('Wallet not connected');

    const data = encodeFunctionData(ERC20ABI, 'balanceOf', [userAddress]);
    
    const result = await window.ethereum!.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data }, 'latest'],
    });
    
    return BigInt(result);
  }

  /**
   * Get token allowance
   */
  async getAllowance(tokenAddress: string, ownerAddress: string, spenderAddress: string): Promise<bigint> {
    const data = encodeFunctionData(ERC20ABI, 'allowance', [ownerAddress, spenderAddress]);
    
    const result = await window.ethereum!.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data }, 'latest'],
    });
    
    return BigInt(result);
  }

  /**
   * Approve token spending
   */
  async approveToken(tokenAddress: string, spenderAddress: string, amount: bigint): Promise<string> {
    const connection = evmWalletService.getConnection();
    if (!connection) throw new Error('Wallet not connected');

    const data = encodeFunctionData(ERC20ABI, 'approve', [spenderAddress, amount]);
    
    const txHash = await evmWalletService.sendTransaction({
      to: tokenAddress,
      data,
    });
    
    // Wait for confirmation
    await this.waitForTransaction(txHash);
    
    return txHash;
  }

  /**
   * Deposit to pool
   */
  async deposit(poolAddress: string, commitment: string): Promise<DepositResult> {
    const connection = evmWalletService.getConnection();
    if (!connection) throw new Error('Wallet not connected');

    // Ensure commitment is properly formatted as bytes32
    const formattedCommitment = commitment.startsWith('0x') ? commitment : '0x' + commitment;
    
    const data = encodeFunctionData(MixerPoolABI, 'deposit', [formattedCommitment]);
    
    console.log('[Contract] Submitting deposit...');
    console.log('[Contract] Pool:', poolAddress);
    console.log('[Contract] Commitment:', formattedCommitment);
    
    const txHash = await evmWalletService.sendTransaction({
      to: poolAddress,
      data,
    });
    
    console.log('[Contract] TX Hash:', txHash);
    
    // Wait for confirmation and get receipt
    const receipt = await this.waitForTransaction(txHash);
    
    // Parse leaf index from logs (Deposit event)
    let leafIndex = 0;
    if (receipt.logs && receipt.logs.length > 0) {
      // Deposit event: commitment (indexed), leafIndex (indexed), timestamp
      // The leafIndex is the second indexed parameter
      const depositLog = receipt.logs.find((log: any) => 
        log.topics && log.topics.length >= 3
      );
      if (depositLog) {
        leafIndex = parseInt(depositLog.topics[2], 16);
      }
    }
    
    return {
      txHash,
      commitment: formattedCommitment,
      leafIndex,
    };
  }

  /**
   * Deposit native DOGE via DogeRouter (auto-wraps to wDOGE)
   */
  async depositDoge(poolAddress: string, commitment: string, amount: bigint): Promise<DepositResult> {
    const connection = evmWalletService.getConnection();
    if (!connection) throw new Error('Wallet not connected');

    // Ensure commitment is properly formatted as bytes32
    const formattedCommitment = commitment.startsWith('0x') ? commitment : '0x' + commitment;
    
    const data = encodeFunctionData(DogeRouterABI, 'depositDoge', [poolAddress, formattedCommitment]);
    
    console.log('[Contract] Submitting DOGE deposit via router...');
    console.log('[Contract] Router:', contracts.dogeRouter);
    console.log('[Contract] Pool:', poolAddress);
    console.log('[Contract] Commitment:', formattedCommitment);
    console.log('[Contract] Amount:', amount.toString());
    
    // Send native DOGE with the transaction
    const txHash = await evmWalletService.sendTransaction({
      to: contracts.dogeRouter,
      data,
      value: amount, // Send native DOGE
    });
    
    console.log('[Contract] TX Hash:', txHash);
    
    // Wait for confirmation and get receipt
    const receipt = await this.waitForTransaction(txHash);
    
    // Parse leaf index from logs (Deposit event from the wDOGE pool)
    let leafIndex = 0;
    if (receipt.logs && receipt.logs.length > 0) {
      // Look for Deposit event from the pool
      const depositLog = receipt.logs.find((log: any) => 
        log.topics && log.topics.length >= 3
      );
      if (depositLog) {
        leafIndex = parseInt(depositLog.topics[2], 16);
      }
    }
    
    return {
      txHash,
      commitment: formattedCommitment,
      leafIndex,
    };
  }

  /**
   * Get native DOGE balance for an address
   */
  async getNativeBalance(userAddress: string): Promise<bigint> {
    const result = await window.ethereum!.request({
      method: 'eth_getBalance',
      params: [userAddress, 'latest'],
    });
    
    return BigInt(result);
  }

  /**
   * Withdraw from pool (direct - not recommended for privacy)
   */
  async withdrawDirect(
    poolAddress: string,
    proof: bigint[],
    root: string,
    nullifierHash: string,
    recipient: string,
    relayer: string,
    fee: bigint
  ): Promise<WithdrawResult> {
    const connection = evmWalletService.getConnection();
    if (!connection) throw new Error('Wallet not connected');

    const data = encodeFunctionData(MixerPoolABI, 'withdraw', [
      proof,
      root,
      nullifierHash,
      recipient,
      relayer,
      fee,
    ]);
    
    const txHash = await evmWalletService.sendTransaction({
      to: poolAddress,
      data,
    });
    
    await this.waitForTransaction(txHash);
    
    return { txHash, recipient, fee };
  }

  /**
   * Withdraw via relayer (recommended for privacy)
   */
  async withdrawViaRelayer(
    poolAddress: string,
    proof: string[],
    root: string,
    nullifierHash: string,
    recipient: string,
    fee: bigint
  ): Promise<WithdrawResult> {
    console.log('[Contract] Submitting to relayer...');

    // Normalize bytes32-ish fields (common cause of 400)
    const norm32 = (v: string) => (v.startsWith('0x') ? v : `0x${v}`);

    const payload = {
      pool: poolAddress,
      proof,
      root: norm32(root),
      nullifierHash: norm32(nullifierHash),
      recipient,
      fee: fee.toString(),
    };

    const response = await fetch(`${api.indexer}/api/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Read once, always safe
    const raw = await response.text();

    // Try parse JSON, but don't assume
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      console.error('[Relayer] Submission failed', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        payload,
        raw,
        parsed,
      });

      const msg =
        parsed?.message ||
        parsed?.error ||
        (typeof parsed === 'string' ? parsed : null) ||
        raw ||
        `Relayer submission failed (HTTP ${response.status})`;

      throw new Error(msg);
    }

    // Success path
    const txHash = parsed?.txHash;
    if (!txHash) {
      console.error('[Relayer] Unexpected success response', { raw, parsed });
      throw new Error('Relayer returned success but missing txHash');
    }

    return { txHash, recipient, fee };
  }

  /**
   * Schedule a delayed withdrawal (V2 pools only)
   */
  async scheduleWithdrawal(
    poolAddress: string,
    proof: string[],
    root: string,
    nullifierHash: string,
    recipient: string,
    fee: bigint,
    delaySeconds: number
  ): Promise<{ txHash: string; unlockTime: Date; nullifierHash: string }> {
    console.log('[Contract] Scheduling withdrawal with delay:', delaySeconds, 'seconds');

    const norm32 = (v: string) => (v.startsWith('0x') ? v : `0x${v}`);

    const payload = {
      pool: poolAddress,
      proof,
      root: norm32(root),
      nullifierHash: norm32(nullifierHash),
      recipient,
      fee: fee.toString(),
      delay: delaySeconds,
    };

    const response = await fetch(`${api.indexer}/api/relay/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      console.error('[Relayer] Schedule failed', { status: response.status, raw, parsed });
      throw new Error(parsed?.message || parsed?.error || raw || 'Failed to schedule withdrawal');
    }

    const txHash = parsed?.txHash;
    const unlockTime = new Date(parsed?.unlockTime || Date.now() + delaySeconds * 1000);
    
    return { txHash, unlockTime, nullifierHash: norm32(nullifierHash) };
  }

  /**
   * Execute a scheduled withdrawal that's ready
   */
  async executeScheduledWithdrawal(
    poolAddress: string,
    nullifierHash: string
  ): Promise<{ txHash: string }> {
    console.log('[Contract] Executing scheduled withdrawal:', nullifierHash);

    const response = await fetch(`${api.indexer}/api/relay/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pool: poolAddress,
        nullifierHash: nullifierHash.startsWith('0x') ? nullifierHash : `0x${nullifierHash}`,
      }),
    });

    const raw = await response.text();
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      console.error('[Relayer] Execute failed', { status: response.status, raw, parsed });
      throw new Error(parsed?.message || parsed?.error || raw || 'Failed to execute withdrawal');
    }

    return { txHash: parsed?.txHash };
  }

  /**
   * Get status of a scheduled withdrawal
   */
  async getScheduledWithdrawalStatus(
    poolAddress: string,
    nullifierHash: string
  ): Promise<{
    exists: boolean;
    timeRemaining: number;
    unlockTime: Date | null;
    isReady: boolean;
    executed: boolean;
  }> {
    const response = await fetch(
      `${api.indexer}/api/pool/${poolAddress}/scheduled/${nullifierHash}`
    );

    if (!response.ok) {
      return { exists: false, timeRemaining: 0, unlockTime: null, isReady: false, executed: false };
    }

    const data = await response.json();
    return {
      exists: data.exists,
      timeRemaining: data.timeRemaining || 0,
      unlockTime: data.unlockTime ? new Date(data.unlockTime * 1000) : null,
      isReady: data.isReady || false,
      executed: data.executed || false,
    };
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForTransaction(txHash: string, maxAttempts = 60): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      const receipt = await window.ethereum!.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });
      
      if (receipt) {
        if (receipt.status === '0x0') {
          throw new Error('Transaction reverted');
        }
        return receipt;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Transaction confirmation timeout');
  }

  /**
   * Get relayer info from backend
   */
  async getRelayerInfo(): Promise<{ relayerAddress: string } | null> {
    try {
      const response = await fetch(`${api.indexer}/api/health`);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.relayerAvailable && data.relayerAddress) {
        return { relayerAddress: data.relayerAddress };
      }
      return null;
    } catch (error) {
      console.error('[Contract] Failed to get relayer info:', error);
      return null;
    }
  }
}

export const contractService = ContractService.getInstance();

