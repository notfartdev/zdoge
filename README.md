# zDoge.cash - Private Doge Transactions

**A Zcash-style privacy-preserving shielded transaction system for the DogeOS blockchain.**

Enable private token transfers using zero-knowledge proofs and Merkle tree commitments. Shield tokens, transfer privately, and unshield—all with full privacy guarantees.

---

## 🎯 Overview

zDoge.cash implements a **Zcash-style shielded transaction system** on DogeOS. Users can:

- **Shield (t→z)**: Convert public tokens to private shielded notes
- **Transfer (z→z)**: Send tokens privately between shielded addresses
- **Unshield (z→t)**: Withdraw shielded tokens back to public addresses
- **Swap (z→z token exchange)**: ⚠️ Coming soon (requires DEX integration)

The system uses **Groth16 zero-knowledge proofs** to enable private transactions without revealing sender, recipient, or amount on-chain. All transactions are fully private and unlinkable.

---

## ✨ Features

### ✅ Core Privacy Features (Production Ready)

- **Shield (t→z)**: Deposit any amount of DOGE or ERC20 tokens into shielded notes
- **Transfer (z→z)**: Private transfers between shielded addresses with stealth addresses
- **Unshield (z→t)**: Withdraw shielded tokens to any public address
- **Auto-Discovery**: Recipients automatically discover incoming transfers via encrypted memos
- **Consolidation**: Combine multiple small notes into larger ones
- **Transaction History**: Client-side tracking of all shielded transactions
- **Gasless Transactions**: Relayer pays gas fees for transfers and unshields

### 🎨 User Experience

- **Modern UI**: Clean, minimal interface focused on privacy
- **Multi-Token Support**: DOGE, USDC, USDT, USD1, WETH, LBTC
- **Variable Amounts**: Shield any amount (not limited to fixed denominations)
- **Real-Time Balance**: Automatic balance updates after transactions
- **USD Value Display**: See token values in USD
- **Note Management**: View and manage all shielded notes

### 🔐 Privacy Guarantees

- **Zero-Knowledge Proofs**: Transactions verified without revealing details
- **Merkle Tree Anonymity Set**: Blend with other users' transactions
- **Stealth Addresses**: Recipient addresses are hidden
- **Unlinkable Transactions**: No connection between deposit and withdrawal
- **Encrypted Memos**: Private note discovery for recipients

---

## 🏗️ Architecture

The system consists of four main components:

### 1. Smart Contracts

**Main Contract: `ShieldedPoolMultiToken`**
- **Address**: `0xc5F64faee07A6EFE235C12378101D62e370c0cD5` (DogeOS Testnet)
- **Functions**:
  - `shieldNative()` - Deposit native DOGE
  - `shieldToken()` - Deposit ERC20 tokens
  - `transfer()` - Private z→z transfer
  - `unshieldNative()` - Withdraw native DOGE
  - `unshieldToken()` - Withdraw ERC20 tokens
  - `swap()` - Token exchange (⚠️ needs DEX integration)

**Verifier Contracts:**
- `ShieldVerifier`: `0x8D5e77fa3FFc93dAf83F2A6B89D8a5C40aF850d2`
- `TransferVerifier`: `0x4827a3CCAbFCbFaf320099363505FeBa8bb63b46`
- `UnshieldVerifier`: `0x8DCBd817377d0ECB334a460ad220D2112d54c41C`
- `SwapVerifier`: `0x96F8d2DFDb14B789397CBb9F810A158d60E996D3` (not used yet)

**Supporting Contracts:**
- `MerkleTreeWithHistory`: Merkle tree with historical root tracking
- `Hasher`: MiMC hasher for Merkle tree operations

### 2. Frontend

**Next.js Web Application** (`components/shielded/`)

- **Shield Interface**: Deposit tokens into shielded pool
- **Transfer Interface**: Send tokens privately to other shielded addresses
- **Unshield Interface**: Withdraw tokens to public addresses
- **Swap Interface**: Token exchange (placeholder - coming soon)

**Key Features:**
- Wallet connection (MetaMask, WalletConnect)
- Shielded identity generation (permanent, deterministic)
- Note management and storage
- Client-side ZK proof generation
- Auto-discovery of incoming transfers
- Transaction history tracking

### 3. Backend

**Indexer & Relayer Service** (`backend/src/`)

**Indexer Service:**
- Event indexing from blockchain (Shield, Transfer, Unshield events)
- Merkle tree state synchronization
- Commitment tracking
- Nullifier checking
- Transfer memo storage/retrieval for auto-discovery

**Relayer Service:**
- Gasless transactions (relayer pays gas)
- Transaction validation
- Proof verification
- Rate limiting

**API Endpoints:**
- `GET /api/shielded/pool/:address` - Pool information
- `GET /api/shielded/pool/:address/root` - Latest Merkle root
- `GET /api/shielded/pool/:address/path/:leafIndex` - Merkle path for proof
- `GET /api/shielded/pool/:address/memos` - Transfer memos for discovery
- `GET /api/shielded/pool/:address/nullifier/:hash` - Check if nullifier spent
- `POST /api/shielded/relay/unshield` - Relay unshield transaction
- `POST /api/shielded/relay/transfer` - Relay transfer transaction
- `GET /api/shielded/relay/info` - Relayer information

### 4. ZK Circuits

**Circom Circuits** (for proof generation)

- Shield circuit: Proves valid shield operation
- Transfer circuit: Proves valid private transfer
- Unshield circuit: Proves valid withdrawal
- Swap circuit: Proves valid token swap (not used yet)

---

## 🌐 Network Configuration

### DogeOS Testnet (Chikyū)

- **Chain ID**: `6281971`
- **RPC URL**: `https://rpc.testnet.dogeos.com`
- **WebSocket**: `wss://ws.rpc.testnet.dogeos.com`
- **Block Explorer**: `https://blockscout.testnet.dogeos.com`
- **Faucet**: `https://faucet.testnet.dogeos.com`

### Supported Tokens

All tokens support **variable amounts** (any amount can be shielded):

| Token | Symbol | Address | Decimals | Status |
|-------|--------|---------|----------|--------|
| Dogecoin | DOGE | `0x0000...0000` (native) | 18 | ✅ Fully Supported |
| USD Coin | USDC | `0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925` | 18 | ✅ Fully Supported |
| Tether USD | USDT | `0xC81800b77D91391Ef03d7868cB81204E753093a9` | 18 | ✅ Fully Supported |
| USD1 | USD1 | `0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F` | 18 | ✅ Fully Supported |
| Wrapped ETH | WETH | `0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000` | 18 | ✅ Fully Supported |
| Liquid BTC | LBTC | `0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E` | 18 | ✅ Fully Supported |

**Note**: All tokens on DogeOS testnet use 18 decimals (not the same as mainnet).

---

## 📁 Project Structure

```
dogenado/
├── app/                          # Next.js application
│   ├── dashboard/               # User dashboard routes
│   └── api/                     # API routes
├── components/                   # React components
│   ├── shielded/
│   │   ├── shield-interface.tsx      # Shield UI
│   │   ├── transfer-interface.tsx    # Transfer UI
│   │   ├── unshield-interface.tsx    # Unshield UI
│   │   ├── swap-interface.tsx        # Swap UI (placeholder)
│   │   ├── shielded-header.tsx        # Wallet initialization
│   │   ├── shielded-wallet.tsx        # Main wallet view
│   │   └── shielded-notes-list.tsx   # Note display
│   └── ...
├── lib/                         # Frontend libraries
│   ├── dogeos-config.ts         # Chain and contract configuration
│   ├── shielded/
│   │   ├── shielded-service.ts        # High-level shielded operations
│   │   ├── shielded-note.ts            # Note management
│   │   ├── shielded-address.ts        # Shielded identity
│   │   ├── shielded-proof-service.ts   # ZK proof generation
│   │   ├── shielded-receiving.ts      # Auto-discovery
│   │   └── transaction-history.ts    # Transaction tracking
│   └── ...
├── contracts/                   # Smart contracts
│   ├── src/
│   │   ├── ShieldedPoolMultiToken.sol  # Main pool contract
│   │   ├── MerkleTreeWithHistory.sol    # Merkle tree
│   │   ├── Hasher.sol                   # MiMC hasher
│   │   └── interfaces/                 # Verifier interfaces
│   ├── scripts/                 # Deployment scripts
│   └── hardhat.config.ts
├── backend/                     # Backend services
│   ├── src/
│   │   ├── index.ts             # Main server
│   │   ├── config.ts            # Configuration
│   │   ├── shielded/
│   │   │   ├── shielded-indexer.ts     # Merkle tree indexing
│   │   │   └── shielded-routes.ts      # API routes
│   │   └── database/            # Database storage
│   └── package.json
└── docs/                        # Documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18 or higher
- **pnpm** or **npm**
- **PostgreSQL** (for backend database)
- **MetaMask** or compatible wallet (for frontend)

### Frontend Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_INDEXER_URL=http://localhost:3001  # For local backend
# NEXT_PUBLIC_INDEXER_URL=https://dogenadocash.onrender.com  # For production

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Configure:
# DATABASE_URL=postgresql://...
# DOGEOS_RPC_URL=https://rpc.testnet.dogeos.com
# RELAYER_PRIVATE_KEY=0x...  # Optional, for relayer

# Initialize database
npm run db:setup

# Run development server
npm run dev
```

The backend will be available at `http://localhost:3001`

### Smart Contract Development

```bash
cd contracts

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy.ts --network dogeosTestnet
```

**Required Environment Variables:**
- `PRIVATE_KEY`: Deployer private key
- `DOGEOS_RPC_URL`: RPC endpoint (optional, defaults to public testnet)

---

## 🔄 How It Works

### Shield Flow (t→z: Public → Private)

1. **User connects wallet** and generates shielded identity (permanent, deterministic)
2. **User selects token and amount** (any amount, variable)
3. **Frontend generates shielded note** with:
   - Secret (random 31 bytes)
   - Nullifier (random 31 bytes)
   - Commitment = MiMC(secret, nullifier)
   - Token metadata (address, decimals)
4. **For ERC20 tokens**: User approves token spending
5. **Contract call**: `shieldNative()` or `shieldToken()`
6. **Contract adds commitment** to Merkle tree
7. **Note stored locally** and balance updates

**Privacy**: No link between deposit address and shielded note.

### Transfer Flow (z→z: Private → Private)

1. **User selects note** to spend (finds best note covering amount + fee)
2. **User enters recipient's shielded address** (stealth address)
3. **Frontend generates**:
   - Output commitment for recipient
   - Change commitment for sender
   - Encrypted memo for auto-discovery
4. **ZK proof generated** proving:
   - User owns the input note
   - Note exists in Merkle tree
   - Output commitments are valid
   - Amounts balance correctly
5. **Relayer submits transaction** (user pays no gas)
6. **Recipient auto-discovers** incoming transfer via encrypted memo
7. **Both balances update** automatically

**Privacy**: Sender, recipient, and amount are all hidden. Only commitments visible on-chain.

### Unshield Flow (z→t: Private → Public)

1. **User selects note** to unshield
2. **User enters recipient public address**
3. **Frontend generates ZK proof** proving:
   - User owns the note
   - Note exists in Merkle tree
   - Amount is correct
4. **Relayer calls** `unshieldNative()` or `unshieldToken()`
5. **Contract verifies proof** and transfers funds
6. **Nullifier recorded** to prevent double-spending
7. **Note marked as spent** locally

**Privacy**: No link to original deposit. Amount and recipient visible (by design for withdrawals).

### Consolidation Flow

1. **User selects token** to consolidate
2. **System finds all spendable notes** for that token
3. **For each note**:
   - Generates unshield proof
   - Relayer submits transaction
   - Note marked as spent
4. **All amounts accumulate** into one larger note
5. **Progress shown** (X of Y notes processed)

**Use Case**: Combine many small notes into fewer large ones for easier management.

---

## 🔐 Privacy Model

### Zcash-Style Privacy Guarantees

**t→z (Shield):**
- ✅ Public deposit → Private note
- ✅ No link between deposit address and note
- ✅ Commitment added to Merkle tree (anonymous)

**z→z (Transfer):**
- ✅ Private note → Private note
- ✅ Sender identity hidden (nullifier prevents linking)
- ✅ Recipient identity hidden (stealth address)
- ✅ Amount hidden (only commitments visible)
- ✅ Unlinkable (no connection to previous transactions)

**z→t (Unshield):**
- ✅ Private note → Public withdrawal
- ✅ No link to original deposit
- ✅ Amount visible (by design)
- ✅ Recipient address visible (by design)

### Anonymity Set

The **anonymity set** is the number of other users' transactions in the Merkle tree. Larger anonymity sets provide better privacy:

- **Shield**: Joins the anonymity set of all shielded notes
- **Transfer**: Uses the anonymity set of all previous transfers
- **Unshield**: Uses the anonymity set of all previous unshields

**Best Practices:**
- Wait between deposit and withdrawal to increase anonymity set
- Use fresh addresses for withdrawals
- Avoid withdrawing immediately after deposit
- Store secret notes securely offline

---

## 🔧 Configuration

### Frontend Configuration

Pool addresses and token configurations are defined in `lib/dogeos-config.ts`:

```typescript
export const shieldedPool = {
  address: '0xc5F64faee07A6EFE235C12378101D62e370c0cD5',
  shieldVerifier: '0x8D5e77fa3FFc93dAf83F2A6B89D8a5C40aF850d2',
  transferVerifier: '0x4827a3CCAbFCbFaf320099363505FeBa8bb63b46',
  unshieldVerifier: '0x8DCBd817377d0ECB334a460ad220D2112d54c41C',
  // ...
}
```

### Backend Configuration

Backend configuration is in `backend/src/config.ts`:

- Pool contract addresses
- Merkle tree depth
- Relayer settings
- Rate limiting configuration

**Both configurations must be kept in sync** when deploying new contracts.

---

## 📊 API Documentation

### Shielded Pool API

**Base URL**: `https://dogenadocash.onrender.com/api/shielded`

#### Pool Information

```http
GET /pool/:address
```

Get pool information and statistics.

#### Merkle Root

```http
GET /pool/:address/root
```

Get the latest Merkle root for proof generation.

#### Merkle Path

```http
GET /pool/:address/path/:leafIndex
```

Get Merkle path for a specific leaf index (required for proof generation).

#### Transfer Memos

```http
GET /pool/:address/memos?since=<timestamp>
```

Get encrypted transfer memos for auto-discovery (since timestamp).

#### Nullifier Check

```http
GET /pool/:address/nullifier/:hash
```

Check if a nullifier hash has been spent.

#### Relay Unshield

```http
POST /relay/unshield
Content-Type: application/json

{
  "poolAddress": "0x...",
  "proof": [...],
  "root": "0x...",
  "nullifierHash": "0x...",
  "recipient": "0x...",
  "amount": "1000000000000000000",
  "fee": "5000000000000000",
  "token": "0x0000000000000000000000000000000000000000"  // or ERC20 address
}
```

Submit an unshield transaction via relayer (gasless).

#### Relay Transfer

```http
POST /relay/transfer
Content-Type: application/json

{
  "poolAddress": "0x...",
  "proof": [...],
  "root": "0x...",
  "nullifierHash": "0x...",
  "outputCommitment1": "0x...",
  "outputCommitment2": "0x...",
  "encryptedMemo1": "0x...",
  "encryptedMemo2": "0x...",
  "fee": "5000000000000000"
}
```

Submit a private transfer via relayer (gasless).

#### Relayer Info

```http
GET /relay/info
```

Get relayer information (fee percentage, minimum fee, address).

---

## 🧪 Testing

### Manual Testing

1. **Shield**: Deposit tokens into shielded pool
2. **Transfer**: Send tokens privately to another shielded address
3. **Unshield**: Withdraw tokens to a public address
4. **Consolidation**: Combine multiple notes

### Test Tokens

Get test tokens from the [DogeOS Testnet Faucet](https://faucet.testnet.dogeos.com).

---

## 🚢 Deployment

### Smart Contracts

Contracts are deployed using Hardhat deployment scripts. After deployment, update:
- `lib/dogeos-config.ts` (frontend)
- `backend/src/config.ts` (backend)

### Frontend

Deploy to **Vercel** or any static hosting service:

**Environment Variables:**
- `NEXT_PUBLIC_INDEXER_URL`: Backend API URL

### Backend

Deploy to **Render**, **Railway**, or similar with:
- PostgreSQL database
- Persistent storage for Merkle tree state
- WebSocket support for real-time event indexing

**Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `DOGEOS_RPC_URL`: RPC endpoint
- `RELAYER_PRIVATE_KEY`: Relayer wallet private key (optional)

---

## ⚠️ Security Considerations

### Trust Assumptions

- ✅ Smart contracts are deployed correctly
- ✅ Zero-knowledge circuits are correctly implemented
- ✅ Trusted setup ceremony was conducted honestly
- ✅ Users properly secure their secret notes

### Limitations

- ⚠️ Anonymity set size depends on pool usage
- ⚠️ Time correlation between deposit and withdrawal can reduce privacy
- ⚠️ Large withdrawals may be linkable through amount analysis
- ⚠️ Relayer transactions reveal relayer address (use direct transactions for maximum privacy)

### Best Practices

- ✅ Wait between deposit and withdrawal to increase anonymity set
- ✅ Use fresh addresses for withdrawals
- ✅ Avoid withdrawing immediately after deposit
- ✅ Store secret notes securely offline
- ✅ For maximum privacy, submit transactions directly rather than through relayer

---

## 📈 Current Status

### ✅ Working Features

- **Shield (t→z)**: ✅ Fully functional for all tokens
- **Transfer (z→z)**: ✅ Fully functional for all tokens
- **Unshield (z→t)**: ✅ Fully functional for all tokens
- **Consolidation**: ✅ Working correctly
- **Auto-Discovery**: ✅ Recipients find incoming transfers
- **Transaction History**: ✅ Client-side tracking

### ⚠️ Not Yet Implemented

- **Swap (z→z token exchange)**: ❌ Requires DEX integration
  - Contract function exists but needs DEX router
  - Frontend shows "Coming Soon"
  - Backend route not implemented

### 🐛 Recent Fixes

- ✅ ERC20 unshield support added
- ✅ Consolidation index mismatch fixed
- ✅ USD calculation fixed (uses correct token)
- ✅ Token metadata stored in notes
- ✅ Legacy note migration support
- ✅ Balance refresh after transactions

---

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Code follows existing style conventions
- Tests are added for new features
- Documentation is updated
- Security considerations are addressed

---

## 📄 License

MIT License

---

## 🙏 Acknowledgments

This project implements a **Zcash-style privacy model** adapted for the DogeOS blockchain. Key technologies:

- **[DogeOS](https://docs.dogeos.com)** - EVM-compatible L2 blockchain
- **[Circom](https://github.com/iden3/circom)** - Zero-knowledge circuit compiler
- **[snarkjs](https://github.com/iden3/snarkjs)** - JavaScript library for ZK proofs
- **[Hardhat](https://hardhat.org)** - Ethereum development environment
- **[viem](https://viem.sh)** - TypeScript Ethereum library

**Privacy Model**: Inspired by Zcash's shielded pool design, adapted for multi-token support and variable amounts.

---

## 📞 Support

- **GitHub**: [Repository](https://github.com/yourusername/dogenado)
- **Documentation**: See `PROJECT_STATUS_REPORT.md` for detailed status
- **Issues**: Report bugs and feature requests on GitHub

---

**Built with ❤️ for privacy on DogeOS**
