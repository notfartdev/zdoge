/**
 * EVM Wallet Service for DogeOS
 * 
 * Connects to MetaMask or other EVM-compatible wallets.
 * DogeOS is an EVM L2, so we use standard Ethereum wallet interfaces.
 */

import { dogeosTestnet } from './dogeos-config';

export interface EVMWalletConnection {
  address: `0x${string}`;
  chainId: number;
  balance: bigint;
  isConnected: boolean;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

class EVMWalletService {
  private static instance: EVMWalletService;
  private connection: EVMWalletConnection | null = null;
  private listeners: Set<(connection: EVMWalletConnection | null) => void> = new Set();

  private constructor() {}

  static getInstance(): EVMWalletService {
    if (!EVMWalletService.instance) {
      EVMWalletService.instance = new EVMWalletService();
    }
    return EVMWalletService.instance;
  }

  /**
   * Check if MetaMask or similar wallet is installed
   */
  isWalletInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  /**
   * Connect to wallet
   */
  async connect(): Promise<EVMWalletConnection | null> {
    if (!this.isWalletInstalled()) {
      throw new Error('No Ethereum wallet found. Please install MetaMask.');
    }

    try {
      // Request account access
      const accounts = await window.ethereum!.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0] as `0x${string}`;
      
      // Get chain ID
      const chainIdHex = await window.ethereum!.request({
        method: 'eth_chainId',
      });
      const chainId = parseInt(chainIdHex, 16);

      // Check if we're on DogeOS testnet, if not prompt to switch
      if (chainId !== dogeosTestnet.id) {
        await this.switchToDogeOS();
      }

      // Get balance
      const balance = await this.getBalance(address);

      this.connection = {
        address,
        chainId: dogeosTestnet.id,
        balance,
        isConnected: true,
      };

      // Set up event listeners
      this.setupEventListeners();

      this.notifyListeners();
      return this.connection;
    } catch (error: any) {
      console.error('[EVMWallet] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Request account selection (for changing wallets)
   * This attempts to revoke and re-request permissions to show account picker
   */
  async requestAccountSelection(): Promise<EVMWalletConnection | null> {
    if (!this.isWalletInstalled()) {
      throw new Error('No Ethereum wallet found. Please install MetaMask.');
    }

    try {
      // Try to revoke existing permissions first to force account selection
      try {
        await window.ethereum!.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch (revokeError) {
        // If revocation fails, that's okay - continue with normal connection
        console.log('[EVMWallet] Could not revoke permissions, continuing...');
      }

      // Now request accounts - this should show the account picker
      return await this.connect();
    } catch (error: any) {
      console.error('[EVMWallet] Account selection failed:', error);
      throw error;
    }
  }

  /**
   * Switch to DogeOS Testnet
   */
  async switchToDogeOS(): Promise<void> {
    if (!this.isWalletInstalled()) return;

    try {
      await window.ethereum!.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${dogeosTestnet.id.toString(16)}` }],
      });
    } catch (switchError: any) {
      // Chain not added, let's add it
      if (switchError.code === 4902) {
        await window.ethereum!.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${dogeosTestnet.id.toString(16)}`,
              chainName: dogeosTestnet.name,
              nativeCurrency: dogeosTestnet.nativeCurrency,
              rpcUrls: dogeosTestnet.rpcUrls.default.http,
              blockExplorerUrls: [dogeosTestnet.blockExplorers.default.url],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.connection = null;
    this.notifyListeners();
  }

  /**
   * Get balance for an address
   */
  async getBalance(address: string): Promise<bigint> {
    if (!this.isWalletInstalled()) return 0n;

    try {
      const balanceHex = await window.ethereum!.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      return BigInt(balanceHex);
    } catch (error) {
      console.error('[EVMWallet] Failed to get balance:', error);
      return 0n;
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<string> {
    if (!this.connection) {
      throw new Error('Wallet not connected');
    }

    const signature = await window.ethereum!.request({
      method: 'personal_sign',
      params: [message, this.connection.address],
    });

    return signature;
  }

  /**
   * Send a transaction
   */
  async sendTransaction(tx: {
    to: string;
    data?: string;
    value?: bigint;
  }): Promise<string> {
    if (!this.connection) {
      throw new Error('Wallet not connected');
    }

    const txHash = await window.ethereum!.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: this.connection.address,
          to: tx.to,
          data: tx.data,
          value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
        },
      ],
    });

    return txHash;
  }

  /**
   * Get current connection
   */
  getConnection(): EVMWalletConnection | null {
    return this.connection;
  }

  /**
   * Subscribe to connection changes
   */
  subscribe(callback: (connection: EVMWalletConnection | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.connection);
    }
  }

  private setupEventListeners(): void {
    if (!this.isWalletInstalled()) return;

    window.ethereum!.on('accountsChanged', async (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        const address = accounts[0] as `0x${string}`;
        const balance = await this.getBalance(address);
        this.connection = {
          ...this.connection!,
          address,
          balance,
        };
        this.notifyListeners();
      }
    });

    window.ethereum!.on('chainChanged', async (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      if (chainId !== dogeosTestnet.id) {
        console.warn('[EVMWallet] Wrong network, please switch to DogeOS Testnet');
      }
      if (this.connection) {
        this.connection = {
          ...this.connection,
          chainId,
        };
        this.notifyListeners();
      }
    });
  }
}

export const evmWalletService = EVMWalletService.getInstance();

