/**
 * Types for Dogenado Privacy Pool
 */

// Wallet connection state (legacy - use EVMWalletConnection from evm-wallet.ts)
export interface WalletConnection {
  address: `0x${string}` | null
  chainId: number | null
  isConnected: boolean
  balance: bigint
}

// DogeOS wallet connection (EVM-compatible)
export interface DogeWalletConnection {
  address: `0x${string}`
  balance: bigint
  isConnected: boolean
}

// Deposit record
export interface MixerDeposit {
  id: string
  poolAddress: string
  token: string
  denomination: bigint
  commitment: string
  leafIndex: number
  note: string
  timestamp: number
  status: "pending" | "confirmed" | "withdrawn"
  txHash?: string
}

// Withdrawal record
export interface MixerWithdrawal {
  id: string
  poolAddress: string
  nullifierHash: string
  recipientAddress: string
  relayerAddress: string
  fee: bigint
  timestamp: number
  status: "pending" | "submitted" | "confirmed" | "failed"
  txHash?: string
  error?: string
}

// Note structure (parsed from note string)
// Note: secret, nullifier, commitment, nullifierHash are bigint in the note-service
// but can be represented as strings for serialization
export interface Note {
  version: number
  pool: string
  secret: bigint
  nullifier: bigint
  commitment: bigint
  nullifierHash: bigint
}

// Serializable version for JSON storage
export interface SerializedNote {
  version: number
  pool: string
  secret: string
  nullifier: string
  commitment: string
  nullifierHash: string
}

// Pool configuration
export interface PoolConfig {
  address: `0x${string}`
  token: {
    address: `0x${string}`
    symbol: string
    decimals: number
  }
  denomination: bigint
  displayAmount: string
}

// Pool statistics
export interface PoolStats {
  depositsCount: number
  anonymitySet: number
  currentRoot: string
  latestActivity: number
}

// Merkle path for proof generation
export interface MerklePath {
  pathElements: string[]
  pathIndices: number[]
  root: string
}

// ZK proof
export interface ZKProof {
  proof: string[]
  publicInputs: string[]
}

// Transaction status
export type TxStatus = "idle" | "approving" | "depositing" | "withdrawing" | "confirming" | "success" | "error"

// Network info
export interface NetworkInfo {
  name: string
  chainId: number
  rpcUrl: string
  wsRpcUrl: string
  blockExplorer: string
  faucet: string
}

// API responses
export interface ApiPoolInfo {
  address: string
  depositsCount: number
  withdrawalsCount: number
  currentRoot: string
}

export interface ApiMerklePath {
  pathElements: string[]
  pathIndices: number[]
  root: string
}

export interface ApiWithdrawalStatus {
  id: string
  status: "pending" | "submitted" | "confirmed" | "failed"
  txHash?: string
  error?: string
}
