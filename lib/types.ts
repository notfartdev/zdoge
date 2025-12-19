export interface DogeWalletConnection {
  address: string
  balance: number
  isConnected: boolean
}

export interface MixerDeposit {
  id: string
  amount: number
  token: "DOGE"
  commitment: string
  nullifier: string
  secret: string
  timestamp: number
  status: "pending" | "confirmed" | "withdrawn"
}

export interface MixerWithdrawal {
  id: string
  amount: number
  recipientAddress: string
  proof: string
  timestamp: number
  status: "pending" | "confirmed"
}

export interface NoteAccount {
  address: string
  encryptedNotes: string[]
  backupKey?: string
  isSetup: boolean
}

export interface MixerPool {
  amount: number
  anonymitySet: number
  totalDeposits: number
}
