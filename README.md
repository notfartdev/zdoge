# Dogenado 🌪️

**Privacy Pool for DogeOS** — A Tornado Cash-style mixer for the Dogecoin ecosystem.

Dogenado enables unlinkable transfers of ERC20 tokens (USDC, WDOGE) on DogeOS using zero-knowledge proofs. Users deposit fixed amounts into privacy pools and later withdraw to fresh addresses, breaking the on-chain link between sender and recipient.

## 🌟 Features

- **Non-custodial**: Your funds, your keys. No trusted third party.
- **ZK Proofs**: Cryptographic privacy using Groth16 zero-knowledge proofs.
- **Fixed Denominations**: Pool-based mixing for maximum anonymity sets.
- **Relayer Support**: Gasless withdrawals for enhanced privacy.
- **DogeOS Native**: Built for the Dogecoin L2 ecosystem.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Deposit   │  │  Withdraw   │  │   Note Management       │  │
│  │  Interface  │  │  Interface  │  │  (Generate/Parse/Save)  │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Smart Contracts (Solidity)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ MixerPool   │  │  Hasher     │  │   Verifier              │  │
│  │ (Deposit/   │  │  (MiMC)     │  │   (Groth16)             │  │
│  │  Withdraw)  │  │             │  │                         │  │
│  └──────┬──────┘  └─────────────┘  └─────────────────────────┘  │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Services                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Indexer   │  │   Relayer   │  │   Merkle Tree           │  │
│  │  (Events)   │  │  (Gas Payer)│  │   Service               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ZK Circuits (Circom)                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  withdraw.circom                                             ││
│  │  - Merkle membership proof                                   ││
│  │  - Nullifier derivation                                      ││
│  │  - Public input binding                                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
dogenado/
├── app/                    # Next.js frontend
│   ├── page.tsx           # Landing page
│   ├── dashboard/         # User dashboard
│   └── api/               # API routes
├── components/            # React components
│   ├── deposit-interface.tsx
│   ├── withdraw-interface.tsx
│   └── mixer-interface.tsx
├── lib/                   # Frontend utilities
│   ├── dogeos-config.ts   # DogeOS chain config
│   ├── note-service.ts    # Note generation/parsing
│   ├── proof-service.ts   # ZK proof generation
│   └── types.ts           # TypeScript types
├── contracts/             # Smart contracts
│   ├── src/
│   │   ├── MixerPool.sol
│   │   ├── MerkleTreeWithHistory.sol
│   │   ├── Hasher.sol
│   │   └── Verifier.sol
│   ├── scripts/           # Deployment scripts
│   └── hardhat.config.ts
├── circuits/              # ZK circuits
│   ├── withdraw.circom
│   └── package.json
└── backend/               # Backend services
    ├── src/
    │   ├── indexer/       # Event indexer
    │   ├── relayer/       # Withdrawal relayer
    │   └── merkle/        # Merkle tree service
    └── package.json
```

## 🔧 DogeOS Testnet Configuration

| Property | Value |
|----------|-------|
| Network Name | DogeOS Chikyū Testnet |
| RPC URL | https://rpc.testnet.dogeos.com |
| WebSocket | wss://ws.rpc.testnet.dogeos.com |
| Chain ID | 6281971 |
| Symbol | DOGE |
| Block Explorer | https://blockscout.testnet.dogeos.com |
| Faucet | https://faucet.testnet.dogeos.com |

### Official Tokens

| Token | Address |
|-------|---------|
| WDOGE | `0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE` |
| USDC | `0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925` |
| USDT | `0xC81800b77D91391Ef03d7868cB81204E753093a9` |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm or npm
- Rust (for Circom)

### Frontend

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Smart Contracts

```bash
cd contracts

# Install dependencies
npm install

# Compile contracts
npm run compile

# Deploy to DogeOS testnet
npm run deploy:testnet
```

### ZK Circuits

```bash
cd circuits

# Install dependencies
npm install

# Download Powers of Tau
npm run download:ptau

# Compile circuit
npm run compile

# Generate verifier
npm run export:verifier
```

### Backend

```bash
cd backend

# Install dependencies
npm install

# Run combined indexer + relayer
npm run dev
```

## 📖 How It Works

### 1. Deposit

1. User selects a pool denomination (e.g., 100 USDC)
2. Frontend generates a secret note: `dogenado-1-usdc100-<secret>-<nullifier>`
3. Commitment = Hash(secret, nullifier) is computed
4. User approves token spending and calls `deposit(commitment)`
5. User saves the secret note securely (CRITICAL!)

### 2. Mixing

- Commitment is added to the Merkle tree
- User's funds join the anonymity set
- No link between deposit and future withdrawal

### 3. Withdraw

1. User enters their secret note and a fresh recipient address
2. Frontend fetches Merkle path from indexer
3. ZK proof is generated client-side
4. Proof is submitted (directly or via relayer)
5. Contract verifies proof and releases funds

## 🔐 Security Model

### What the ZK proof proves:
- User knows the secret and nullifier for a valid commitment
- The commitment exists in the Merkle tree
- The nullifier hasn't been used before
- The withdrawal parameters match the proof

### What is NOT revealed:
- Which deposit is being withdrawn
- The depositor's address
- The secret values

### Trust assumptions:
- Contract code is correct (auditable)
- ZK circuit is sound (auditable)
- Trusted setup ceremony was honest (Powers of Tau)

## ⚠️ Important Notes

1. **SAVE YOUR NOTE**: If you lose your deposit note, your funds are **PERMANENTLY LOST**. There is no recovery mechanism.

2. **Privacy Tips**:
   - Wait before withdrawing (increases anonymity set)
   - Use fresh addresses for withdrawals
   - Don't withdraw the same amount you deposited at the same time

3. **Testnet Only**: This is currently deployed on DogeOS testnet. Do not use real funds.

## 🛣️ Roadmap

- [x] Smart contract development
- [x] ZK circuit design
- [x] Frontend integration
- [x] Backend services
- [ ] Contract deployment to testnet
- [ ] Circuit trusted setup
- [ ] Security audit
- [ ] Mainnet deployment

## 📄 License

MIT

## 🙏 Acknowledgments

- [Tornado Cash](https://github.com/tornadocash) - Original privacy pool design
- [DogeOS](https://docs.dogeos.com) - EVM-compatible L2 for Dogecoin
- [Circom](https://github.com/iden3/circom) - ZK circuit compiler
- [snarkjs](https://github.com/iden3/snarkjs) - ZK proof library

