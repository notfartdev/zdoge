---
id: architecture
title: Architecture Overview
sidebar_position: 1
---

# Architecture Overview

zDoge is built on a multi-layer architecture designed for security, privacy, and scalability using Zcash-style shielded transactions.

## System Components

```mermaid
graph TB
    subgraph Browser["User Browser"]
        Frontend["Web Frontend<br/>(Next.js)"]
        ZKProof["ZK Proof Gen<br/>(snarkjs)"]
        Wallet["Wallet<br/>(MetaMask)"]
    end
    
    subgraph Blockchain["DogeOS Blockchain"]
        subgraph Contracts["Smart Contracts"]
            ShieldedPool["ShieldedPoolMultiToken<br/>(Main Contract)"]
            Verifiers["Verifiers<br/>(Shield/Transfer/Unshield/Swap)"]
            Tokens["ERC20 Tokens<br/>(DOGE, USDC, etc)"]
        end
    end
    
    subgraph Backend["Backend Service"]
        Indexer["Shielded Indexer<br/>(Event Indexing)"]
        Relayer["Relayer<br/>(Gas Payer)"]
        Database["PostgreSQL<br/>(Transaction History)"]
    end
    
    Frontend --> Contracts
    ZKProof --> Contracts
    Wallet --> Contracts
    Frontend --> Backend
    Backend --> Contracts
    
    style Browser fill:#1a1a1a,stroke:#C2A633,stroke-width:2px,color:#fff
    style Blockchain fill:#1a1a1a,stroke:#C2A633,stroke-width:2px,color:#fff
    style Backend fill:#1a1a1a,stroke:#C2A633,stroke-width:2px,color:#fff
    style Contracts fill:#161616,stroke:#C2A633,stroke-width:1px,color:#fff
    style Frontend fill:#0d0d0d,stroke:#C2A633,stroke-width:1px,color:#C2A633
    style ZKProof fill:#0d0d0d,stroke:#C2A633,stroke-width:1px,color:#C2A633
    style Wallet fill:#0d0d0d,stroke:#C2A633,stroke-width:1px,color:#C2A633
    style ShieldedPool fill:#0d0d0d,stroke:#C2A633,stroke-width:1px,color:#C2A633
    style Verifiers fill:#0d0d0d,stroke:#C2A633,stroke-width:1px,color:#C2A633
```

## Frontend Layer

The web interface is built with **Next.js** and runs entirely in the user's browser.

### Key Responsibilities

| Component | Function |
|-----------|----------|
| **Shield UI** | Token selection, amount entry, transaction submission |
| **Transfer UI** | Recipient entry, note selection, proof generation |
| **Unshield UI** | Recipient entry, note selection, proof generation |
| **Swap UI** | Token pair selection, amount entry, proof generation |
| **Proof Generation** | Client-side ZK proof generation using snarkjs |
| **Auto-Discovery** | Scanning for incoming transfers, memo decryption |
| **Wallet Integration** | MetaMask, WalletConnect for transaction signing |

### Client-Side Proof Generation

Zero-knowledge proofs are generated entirely in the browser:

1. User initiates transaction (shield/transfer/unshield/swap)
2. Browser selects notes and generates proof inputs
3. snarkjs generates Groth16 proof (~30-60 seconds)
4. Proof is submitted to blockchain

This ensures the user's secrets never leave their device.

## Smart Contract Layer

All shielded transaction logic runs on DogeOS smart contracts.

### ShieldedPoolMultiToken Contract

The main contract handling all shielded operations:

```solidity
contract ShieldedPoolMultiToken {
    // Configuration
    IShieldVerifier public shieldVerifier;
    ITransferVerifier public transferVerifier;
    IUnshieldVerifier public unshieldVerifier;
    ISwapVerifier public swapVerifier;
    
    // State
    mapping(bytes32 => bool) public nullifierHashes;
    MerkleTree public tree;
    
    // Functions
    function shield(bytes calldata proof, bytes32 commitment, ...) external;
    function transfer(bytes calldata proof, bytes32[2] commitments, bytes[2] memos, ...) external;
    function unshield(bytes calldata proof, bytes32 nullifier, address recipient, ...) external;
    function swap(bytes calldata proof, bytes32 inputNullifier, bytes32 outputCommitment, ...) external;
}
```

### Verifier Contracts

Separate Groth16 verifiers for each transaction type:
- **ShieldVerifier** - Verifies shield proofs
- **TransferVerifier** - Verifies transfer proofs
- **UnshieldVerifier** - Verifies unshield proofs
- **SwapVerifier** - Verifies swap proofs

## Backend Layer

The backend provides indexing, relaying, and transaction history services.

### Shielded Indexer

- Watches Shield, Transfer, Unshield, Swap events
- Maintains shielded Merkle tree state
- Tracks nullifiers
- Stores encrypted memos for auto-discovery

### Relayer Service

- Submits transactions on behalf of users
- Pays gas fees (enables gasless transactions)
- Rate limiting and balance monitoring

### Transaction History

- PostgreSQL database for persistence
- Syncs transaction history across devices
- Stores all transaction types

## Data Flow

### Shield Flow (Public → Private)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Contract
    
    User->>Frontend: Select token
    User->>Frontend: Enter amount
    Frontend->>Frontend: Generate note
    Frontend->>Frontend: Compute commitment
    User->>Frontend: Confirm shield
    Frontend->>Contract: shield(proof)
    Contract->>Contract: Add to tree
    Contract->>Frontend: Emit event
    Frontend->>User: Success
```

### Transfer Flow (Private → Private)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Contract
    participant Recipient
    
    User->>Frontend: Enter recipient
    User->>Frontend: Enter amount
    Frontend->>Frontend: Select notes
    Frontend->>Frontend: Generate memo
    Frontend->>Frontend: Generate ZK proof<br/>(30-60 seconds)
    User->>Frontend: Confirm transfer
    Frontend->>Contract: transfer(proof)
    Contract->>Contract: Verify proof
    Contract->>Contract: Add commitments
    Contract->>Contract: Mark nullifier
    Contract->>Frontend: Emit event
    Frontend->>User: Success
    Contract->>Recipient: Auto-discovery
```

## Security Model

### Trust Assumptions

| Component | Trust Level | Why |
|-----------|-------------|-----|
| Smart Contracts | Trustless | Code is law, immutable |
| ZK Circuits | Trustless | Mathematically verified |
| Frontend | Verify yourself | Open source, runs locally |
| Merkle Tree | Trustless | On-chain verification |
| Backend | Minimal trust | Only for indexing/relaying |

### What's Protected

- **Transaction links**: Cryptographically hidden
- **Amounts**: Hidden in all shielded transactions
- **Sender/Recipient**: Hidden in transfers
- **Spending keys**: Never leave user's browser

### What's Visible On-Chain

- Shield events (commitment, token, amount, time)
- Transfer events (nullifier, commitments, memos, time)
- Unshield events (nullifier, recipient, token, amount, time)
- Swap events (input nullifier, output commitment, tokens, time)

The link between transactions cannot be determined.

## Scalability

### Current Capacity

| Metric | Value |
|--------|-------|
| Merkle Tree Depth | 20 levels |
| Max Shielded Notes | 1,048,576 |
| Proof Generation | 30-60 seconds |
| On-chain Verification | ~300,000-500,000 gas |

### Future Improvements

- Layer 2 proof aggregation
- Batch transactions
- Cross-chain bridges
- Improved proof generation speed

---

**Next:** [Smart Contracts](/technical/smart-contracts)
