/**
 * Transaction Tracker
 * 
 * Tracks transaction status and polls blockchain for confirmations
 */

import { createPublicClient, http, type Address } from 'viem';
import { dogeosTestnet } from '../dogeos-config';
import { getPrivacyRpcUrl } from './privacy-utils';

const BLOCK_EXPLORER_URL = 'https://blockscout.testnet.dogeos.com';

export type TransactionStatus = 'idle' | 'proving' | 'relaying' | 'pending' | 'confirmed' | 'failed';

export interface TransactionTracker {
  status: TransactionStatus;
  txHash: string | null;
  blockNumber: number | null;
  confirmations: number;
  error: string | null;
}

export type StatusUpdateCallback = (tracker: TransactionTracker) => void;

/**
 * Create public client for transaction tracking
 * Uses privacy-focused RPC rotation (currently just one RPC, but ready for expansion)
 */
function getPublicClient() {
  return createPublicClient({
    chain: dogeosTestnet,
    transport: http(getPrivacyRpcUrl()), // Rotates through available RPCs
  });
}

/**
 * Track transaction status with polling
 */
export class TransactionTrackerClass {
  private txHash: string | null = null;
  private status: TransactionStatus = 'idle';
  private blockNumber: number | null = null;
  private confirmations: number = 0;
  private error: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private callbacks: StatusUpdateCallback[] = [];
  private requiredConfirmations: number = 1;

  constructor(requiredConfirmations: number = 1) {
    this.requiredConfirmations = requiredConfirmations;
  }

  /**
   * Subscribe to status updates
   */
  onUpdate(callback: StatusUpdateCallback) {
    this.callbacks.push(callback);
    // Immediately call with current status
    callback(this.getTracker());
  }

  /**
   * Unsubscribe from updates
   */
  offUpdate(callback: StatusUpdateCallback) {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  /**
   * Notify all subscribers
   */
  private notify() {
    const tracker = this.getTracker();
    this.callbacks.forEach(cb => cb(tracker));
  }

  /**
   * Get current tracker state
   */
  getTracker(): TransactionTracker {
    return {
      status: this.status,
      txHash: this.txHash,
      blockNumber: this.blockNumber,
      confirmations: this.confirmations,
      error: this.error,
    };
  }

  /**
   * Start tracking a transaction
   */
  async track(txHash: string) {
    this.txHash = txHash;
    this.status = 'pending';
    this.error = null;
    this.notify();

    const client = getPublicClient();

    // Poll every 2 seconds
    this.pollingInterval = setInterval(async () => {
      try {
        const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

        if (receipt) {
          if (receipt.status === 'success') {
            this.status = 'confirmed';
            this.blockNumber = Number(receipt.blockNumber);
            
            // Calculate confirmations
            const currentBlock = await client.getBlockNumber();
            this.confirmations = Number(currentBlock - receipt.blockNumber + 1n);

            // Stop polling once we have required confirmations
            if (this.confirmations >= this.requiredConfirmations) {
              this.stop();
            }
          } else {
            this.status = 'failed';
            this.error = 'Transaction reverted';
            this.stop();
          }

          this.notify();
        }
      } catch (error: any) {
        // Transaction not found yet - still pending
        if (!error.message?.includes('not found')) {
          console.error('[TransactionTracker] Error polling:', error);
        }
      }
    }, 2000);

    // Timeout after 5 minutes
    setTimeout(() => {
      if (this.status === 'pending') {
        this.status = 'failed';
        this.error = 'Transaction timeout';
        this.stop();
        this.notify();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Update status manually (for proving/relaying stages)
   */
  setStatus(status: TransactionStatus, message?: string) {
    this.status = status;
    if (message) {
      this.error = message;
    }
    this.notify();
  }

  /**
   * Stop tracking
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Reset tracker
   */
  reset() {
    this.stop();
    this.txHash = null;
    this.status = 'idle';
    this.blockNumber = null;
    this.confirmations = 0;
    this.error = null;
    this.notify();
  }

  /**
   * Get block explorer URL
   */
  getExplorerUrl(): string | null {
    if (!this.txHash) return null;
    return `${BLOCK_EXPLORER_URL}/tx/${this.txHash}`;
  }
}

/**
 * Hook-friendly transaction tracker
 */
export function useTransactionTracker(requiredConfirmations: number = 1) {
  return new TransactionTrackerClass(requiredConfirmations);
}
