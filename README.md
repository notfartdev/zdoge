# zDoge.cash

Privacy-preserving shielded transaction system for DogeOS. Enables private token transfers using zero-knowledge proofs.

## Features

- **Shield (t→z)**: Deposit DOGE or ERC20 tokens into shielded notes
- **Transfer (z→z)**: Private transfers between shielded addresses
- **Unshield (z→t)**: Withdraw shielded tokens to public addresses
- **Auto-Discovery**: Recipients automatically discover incoming transfers
- **Consolidation**: Combine multiple small notes into larger ones
- **Gasless Transactions**: Relayer pays gas fees for transfers and unshields

## Supported Tokens

All tokens support variable amounts (any amount can be shielded):

- DOGE (native)
- USDC
- USDT
- USD1
- WETH
- LBTC

All tokens use 18 decimals on DogeOS testnet.

## Architecture

- **Smart Contract**: `ShieldedPoolMultiToken` at `0xc5F64faee07A6EFE235C12378101D62e370c0cD5`
- **Frontend**: Next.js application with client-side proof generation
- **Backend**: Indexer service for Merkle tree state and relayer for gasless transactions
- **ZK Proofs**: Groth16 proofs for shield, transfer, and unshield operations

## Network

**DogeOS Testnet (Chikyū)**
- Chain ID: 6281971
- RPC: https://rpc.testnet.dogeos.com
- Explorer: https://blockscout.testnet.dogeos.com
- Faucet: https://faucet.testnet.dogeos.com

## Development

### Frontend

```bash
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_INDEXER_URL=http://localhost:3001
npm run dev
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Configure DATABASE_URL and DOGEOS_RPC_URL
npm run db:setup
npm run dev
```

### Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

## How It Works

**Shield (t→z)**: User deposits tokens, generates shielded note with commitment, contract adds commitment to Merkle tree.

**Transfer (z→z)**: User spends note, generates proof, creates output commitments for recipient and change, relayer submits transaction.

**Unshield (z→t)**: User spends note, generates proof, relayer calls contract to transfer tokens to recipient address.

All operations use zero-knowledge proofs to hide sender, recipient, and amount (except unshield amount/recipient which are visible by design).

## Privacy Model

Zcash-style privacy with Merkle tree anonymity set. Transactions are unlinkable - no connection between deposit and withdrawal. Shielded transfers hide sender, recipient, and amount.

## API

Backend API at `/api/shielded`:

- `GET /pool/:address` - Pool information
- `GET /pool/:address/root` - Latest Merkle root
- `GET /pool/:address/path/:leafIndex` - Merkle path for proof
- `GET /pool/:address/memos` - Transfer memos for discovery
- `POST /relay/unshield` - Relay unshield transaction
- `POST /relay/transfer` - Relay transfer transaction
- `GET /relay/info` - Relayer information

## Status

**Working:**
- Shield for all tokens
- Transfer for all tokens
- Unshield for all tokens
- Consolidation
- Auto-discovery

**Not Implemented:**
- Swap (requires DEX integration)

## Security

- Smart contracts must be audited
- ZK circuits must be correctly implemented
- Users must secure their secret notes
- Anonymity set size depends on pool usage
- Time correlation can reduce privacy

## License

MIT
