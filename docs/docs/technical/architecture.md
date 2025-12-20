---
id: architecture
title: Architecture Overview
sidebar_position: 1
---

# Architecture Overview

Dogenado is built on a multi-layer architecture designed for security, privacy, and scalability.

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Web Frontend  │  │  ZK Proof Gen   │  │ Wallet (MM)  │ │
│  │   (Next.js)     │  │  (snarkjs)      │  │              │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
└───────────┼────────────────────┼─────────────────┼──────────┘
            │                    │                 │
            ▼                    ▼                 ▼
┌───────────────────────────────────────────────────────────────┐
│                      DogeOS Blockchain                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  Smart Contracts                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │  │ MixerPoolV2  │  │   Verifier   │  │  ERC20 Tokens │  │  │
│  │  │ (per token/  │  │  (Groth16)   │  │  (USDC, etc)  │  │  │
│  │  │   amount)    │  │              │  │               │  │  │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## Frontend Layer

The web interface is built with **Next.js** and runs entirely in the user's browser.

### Key Responsibilities

| Component | Function |
|-----------|----------|
| **Deposit UI** | Token selection, amount selection, transaction submission |
| **Withdraw UI** | Note parsing, recipient entry, proof generation |
| **Proof Generation** | Client-side ZK proof generation using snarkjs |
| **Wallet Integration** | MetaMask, WalletConnect for transaction signing |

### Client-Side Proof Generation

Zero-knowledge proofs are generated entirely in the browser:

1. User provides deposit note
2. Browser parses secret and nullifier
3. snarkjs generates Groth16 proof (~30-60 seconds)
4. Proof is submitted to blockchain

This ensures the user's secret never leaves their device.

## Smart Contract Layer

All pool logic runs on DogeOS smart contracts.

### MixerPoolV2 Contract

Each pool is an instance of `MixerPoolV2`:

```solidity
contract MixerPoolV2 {
    // Configuration
    IVerifier public verifier;
    IERC20 public token;
    uint256 public denomination;
    
    // State
    mapping(uint256 => bool) public nullifierHashes;
    mapping(uint256 => bool) public commitments;
    
    // Merkle tree state
    uint32 public currentRootIndex;
    bytes32[ROOT_HISTORY_SIZE] public roots;
    
    // Functions
    function deposit(bytes32 commitment) external;
    function withdraw(bytes calldata proof, ...) external;
    function scheduleWithdrawal(...) external;
    function executeScheduledWithdrawal(...) external;
}
```

### Verifier Contract

A Groth16 verifier generated from the circuit:

```solidity
contract Verifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) public view returns (bool);
}
```

## Data Flow

### Deposit Flow

```
User                    Frontend               Contract
  │                        │                      │
  │─── Select token ──────>│                      │
  │─── Select amount ─────>│                      │
  │                        │                      │
  │<── Generate secrets ───│                      │
  │<── Compute commitment ─│                      │
  │                        │                      │
  │─── Confirm deposit ───>│                      │
  │                        │─── deposit(commit) ─>│
  │                        │                      │─── Add to tree
  │                        │<── Emit event ───────│
  │<── Return note ────────│                      │
```

### Withdrawal Flow

```
User                    Frontend               Contract
  │                        │                      │
  │─── Paste note ────────>│                      │
  │─── Enter recipient ───>│                      │
  │                        │                      │
  │                        │─── Fetch Merkle path │
  │                        │<── Path data ────────│
  │                        │                      │
  │<── Generate ZK proof ──│                      │
  │      (30-60 seconds)   │                      │
  │                        │                      │
  │─── Confirm withdraw ──>│                      │
  │                        │─── withdraw(proof) ─>│
  │                        │                      │─── Verify proof
  │                        │                      │─── Check nullifier
  │                        │                      │─── Transfer tokens
  │                        │<── Emit event ───────│
  │<── Success ────────────│                      │
```

## Security Model

### Trust Assumptions

| Component | Trust Level | Why |
|-----------|-------------|-----|
| Smart Contracts | Trustless | Code is law, immutable |
| ZK Circuits | Trustless | Mathematically verified |
| Frontend | Verify yourself | Open source, runs locally |
| Merkle Tree | Trustless | On-chain verification |

### What's Protected

- ✅ **Deposit-withdrawal link**: Cryptographically hidden
- ✅ **Secret/nullifier**: Never leaves user's browser
- ✅ **Funds**: Controlled by user's note

### What's Visible On-Chain

- Deposit transactions (amount, time, depositor address)
- Withdrawal transactions (amount, time, recipient address)
- Pool statistics (total deposits, total withdrawals)

The link between deposits and withdrawals cannot be determined.

## Scalability

### Current Capacity

| Metric | Value |
|--------|-------|
| Merkle Tree Depth | 20 levels |
| Max Deposits per Pool | 1,048,576 |
| Proof Generation | 30-60 seconds |
| On-chain Verification | ~300,000 gas |

### Future Improvements

- Layer 2 proof aggregation
- Batch withdrawals
- Cross-chain bridges

---

**Next:** [Smart Contracts](/technical/smart-contracts)

