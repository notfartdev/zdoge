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

- **Smart Contract**: `ShieldedPoolMultiToken` at `0x37A7bA0f6769ae08c4331A48f737d4Ffe1bb721a`
- **Frontend**: Next.js application with client-side proof generation
- **Backend**: Indexer service for Merkle tree state and relayer for gasless transactions
- **ZK Proofs**: Groth16 proofs for shield, transfer, and unshield operations

## Network

**DogeOS Testnet (Chikyū)**
- Chain ID: 6281971
- RPC: https://rpc.testnet.dogeos.com
- Explorer: https://blockscout.testnet.dogeos.com
- Faucet: https://faucet.testnet.dogeos.com

## How It Works

**Shield (t→z)**: User deposits tokens, generates shielded note with commitment, contract adds commitment to Merkle tree.

**Transfer (z→z)**: User spends note, generates proof, creates output commitments for recipient and change, relayer submits transaction.

**Unshield (z→t)**: User spends note, generates proof, relayer calls contract to transfer tokens to recipient address.

All operations use zero-knowledge proofs to hide sender, recipient, and amount (except unshield amount/recipient which are visible by design).

## Privacy Model

Zcash-style privacy with Merkle tree anonymity set. Transactions are unlinkable - no connection between deposit and withdrawal. Shielded transfers hide sender, recipient, and amount.

## Getting Started

Please see our user guide for instructions on using zDoge.cash.

## Need Help?

- Documentation: [docs.zdoge.cash](https://docs.zdoge.cash)
- Twitter: [@zdogecash](https://x.com/zdogecash)
- Discord: [discord.gg/gzPNefTMq2](https://discord.gg/gzPNefTMq2)
- Telegram: [@zdogecsh](https://t.me/zdogecsh)

## License

MIT
