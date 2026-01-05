# Dogenado

Privacy-preserving shielded transaction system for the DogeOS blockchain. Enables private token transfers using zero-knowledge proofs and Merkle tree commitments.

## Overview

Dogenado implements a Zcash-style shielded transaction system on DogeOS. Users can shield tokens (convert public tokens to private shielded notes), transfer tokens privately between shielded addresses, swap tokens within the shielded layer, and unshield tokens back to public addresses.

The system uses Groth16 zero-knowledge proofs to enable private transactions without revealing sender, recipient, or amount on-chain. All transactions are fully private and unlinkable.

## Architecture

The system consists of four main components:

- **Smart Contracts**: MixerPool contracts that manage deposits, withdrawals, and Merkle tree state
- **Frontend**: Next.js web application for user interactions, note management, and proof generation
- **Backend**: Indexer service for Merkle tree state management and optional relayer for gasless withdrawals
- **ZK Circuits**: Circom circuits that generate proofs of valid withdrawals

### Smart Contracts

- **ShieldedPoolMultiToken**: Main shielded pool contract for shield/transfer/unshield/swap operations
- **ShieldVerifier**: Shield proof verifier contract
- **TransferVerifier**: Transfer proof verifier contract
- **UnshieldVerifier**: Unshield proof verifier contract
- **SwapVerifier**: Swap proof verifier contract
- **MerkleTreeWithHistory**: Merkle tree implementation with historical root tracking
- **Hasher**: MiMC hasher for Merkle tree operations

### Frontend

The frontend handles:
- Wallet connection and transaction signing
- Shielded identity and key management
- Shielded note generation and management
- Zero-knowledge proof generation (client-side)
- Auto-discovery of incoming transfers
- Transaction history tracking
- Merkle path fetching from indexer
- Transaction submission (direct or via relayer)

### Backend

The backend provides:
- Event indexing from blockchain (Shield, Transfer, Unshield, Swap events)
- Shielded Merkle tree state synchronization
- Auto-discovery support via encrypted memos
- REST API for shielded pool information and Merkle paths
- Transaction history persistence (PostgreSQL)
- Optional relayer service for gasless transactions

## Network Configuration

### DogeOS Testnet (Chikyū)

- Chain ID: 6281971
- RPC URL: https://rpc.testnet.dogeos.com
- WebSocket: wss://ws.rpc.testnet.dogeos.com
- Block Explorer: https://blockscout.testnet.dogeos.com
- Faucet: https://faucet.testnet.dogeos.com

### Supported Tokens

The system supports multiple token types with variable amounts (any amount can be shielded):

- Native DOGE
- USDC (18 decimals on DogeOS)
- USDT (18 decimals on DogeOS)
- USD1
- WETH
- LBTC

Token addresses are configured in `lib/dogeos-config.ts` for the frontend and `backend/src/config.ts` for the backend.

## Project Structure

```
dogenado/
├── app/                    # Next.js application
│   ├── dashboard/         # User dashboard routes
│   └── api/               # API routes
├── components/            # React components
│   ├── deposit-interface.tsx
│   ├── withdraw-interface.tsx
│   ├── statistics.tsx
│   └── dashboard-nav.tsx
├── lib/                   # Frontend libraries
│   ├── dogeos-config.ts   # Chain and contract configuration
│   ├── note-service.ts    # Note generation and parsing
│   ├── proof-service.ts   # ZK proof generation
│   ├── contract-service.ts # Contract interaction utilities
│   └── token-context.tsx  # Token selection and pricing
├── contracts/             # Smart contracts
│   ├── src/
│   │   ├── MixerPoolV2.sol
│   │   ├── MixerPoolNative.sol
│   │   ├── MerkleTreeWithHistory.sol
│   │   └── interfaces/
│   ├── scripts/           # Deployment scripts
│   └── hardhat.config.ts
├── backend/               # Backend services
│   ├── src/
│   │   ├── index.ts       # Combined indexer and relayer
│   │   ├── config.ts      # Configuration
│   │   ├── merkle/        # Merkle tree implementation
│   │   └── database/      # Database storage layer
│   └── package.json
└── docs/                  # Documentation
    └── docs/              # Docusaurus documentation site
```

## Development Setup

### Prerequisites

- Node.js 18 or higher
- pnpm or npm
- PostgreSQL (for backend database)
- Rust (required for Circom circuit compilation)

### Frontend Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

The frontend will be available at http://localhost:3000

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
npx hardhat run scripts/deploy-all-tokens.ts --network dogeosTestnet
```

Environment variables required:
- `PRIVATE_KEY`: Deployer private key
- `DOGEOS_RPC_URL`: RPC endpoint (optional, defaults to public testnet)

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Configure database and network settings

# Initialize database
npm run db:setup

# Run development server
npm run dev
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `DOGEOS_RPC_URL`: RPC endpoint for blockchain access
- `DOGEOS_WS_RPC_URL`: WebSocket RPC endpoint (optional, for real-time events)
- `RELAYER_PRIVATE_KEY`: Private key for relayer wallet (optional)

### Circuit Compilation

The ZK circuits are compiled separately. See the circuits directory for compilation instructions.

## Configuration

### Frontend Configuration

Pool addresses and token configurations are defined in `lib/dogeos-config.ts`. This includes:
- Token contract addresses
- Pool contract addresses for each denomination
- Chain configuration
- API endpoints

### Backend Configuration

Backend configuration is in `backend/src/config.ts`. This includes:
- Pool contract addresses
- Merkle tree depth
- Relayer settings
- Rate limiting configuration

Both configurations must be kept in sync when deploying new pools.

## Deployment

### Smart Contracts

Contracts are deployed using Hardhat deployment scripts. Each token type has its own deployment script in `contracts/scripts/`.

After deployment, update:
- `lib/dogeos-config.ts` (frontend)
- `backend/src/config.ts` (backend)

### Frontend

The frontend can be deployed to Vercel or any static hosting service. Set the following environment variables:

- `NEXT_PUBLIC_INDEXER_URL`: Backend API URL
- `NEXT_PUBLIC_RELAYER_URL`: Relayer API URL (usually same as indexer)

### Backend

The backend should be deployed as a persistent service (Render, Railway, or similar) with:
- PostgreSQL database
- Persistent storage for Merkle tree state
- WebSocket support for real-time event indexing

## How It Works

### Shield Flow (Public → Private)

1. User connects wallet and generates shielded identity
2. User selects token and amount (any amount)
3. Frontend generates a shielded note with commitment
4. User approves token spending (ERC20) or sends native value (native DOGE)
5. Shield transaction is submitted with the commitment
6. Contract adds commitment to Merkle tree
7. Note is stored locally and synced to backend

### Transfer Flow (Private → Private)

1. User selects a shielded note to spend
2. User enters recipient's shielded address
3. Frontend generates encrypted memo for auto-discovery
4. Zero-knowledge proof is generated client-side
5. Transfer transaction is submitted (directly or via relayer)
6. Recipient's wallet auto-discovers the incoming transfer via encrypted memo
7. Recipient's balance updates automatically

### Unshield Flow (Private → Public)

1. User selects a shielded note to unshield
2. User enters recipient public address
3. Zero-knowledge proof is generated client-side
4. Unshield transaction is submitted (directly or via relayer)
5. Contract verifies proof and transfers funds to recipient
6. Nullifier is recorded to prevent double-spending

### Merkle Tree State

The backend indexer maintains Merkle tree state by:
- Watching Deposit events from contracts
- Inserting commitments into the Merkle tree
- Serving Merkle paths to frontend for proof generation
- Tracking nullifiers to prevent double-spends

## Security Considerations

### Trust Assumptions

- Smart contracts are deployed correctly and audited
- Zero-knowledge circuits are correctly implemented
- Trusted setup ceremony was conducted honestly
- Users properly secure their secret notes

### Limitations

- Anonymity set size depends on pool usage
- Time correlation between deposit and withdrawal can reduce privacy
- Large withdrawals may be linkable through amount analysis
- Relayer transactions reveal relayer address (use direct transactions for maximum privacy)

### Best Practices

- Wait between deposit and withdrawal to increase anonymity set
- Use fresh addresses for withdrawals
- Avoid withdrawing immediately after deposit
- Store secret notes securely offline
- For maximum privacy, submit withdrawal transactions directly rather than through relayer

## API Documentation

The backend provides REST API endpoints:

- `GET /api/pools` - List all pools
- `GET /api/pool/:address` - Get pool information
- `GET /api/pool/:address/root` - Get latest Merkle root
- `GET /api/pool/:address/path/:leafIndex` - Get Merkle path for leaf
- `POST /api/relay` - Submit withdrawal via relayer
- `GET /api/health` - Health check

See the backend source code for detailed API documentation.

## Testing

### Smart Contracts

```bash
cd contracts
npx hardhat test
```

### Frontend

```bash
npm run test
```

### Backend

```bash
cd backend
npm run test
```

## Contributing

Contributions are welcome. Please ensure:
- Code follows existing style conventions
- Tests are added for new features
- Documentation is updated
- Security considerations are addressed

## License

MIT License

## Acknowledgments

This project is based on the privacy pool design pioneered by Tornado Cash. The implementation adapts the design for the DogeOS blockchain and adds improvements such as native token support and scheduled withdrawals.

Key technologies:
- [DogeOS](https://docs.dogeos.com) - EVM-compatible L2 blockchain
- [Circom](https://github.com/iden3/circom) - Zero-knowledge circuit compiler
- [snarkjs](https://github.com/iden3/snarkjs) - JavaScript library for ZK proofs
- [Hardhat](https://hardhat.org) - Ethereum development environment
