---
id: zero-knowledge
title: Zero-Knowledge Proofs
sidebar_position: 3
---

# Zero-Knowledge Proofs

Dogenado uses zkSNARKs (Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge) to enable private withdrawals.

## What is a Zero-Knowledge Proof?

A zero-knowledge proof allows you to prove a statement is true without revealing any information about why it's true.

**Example**: 
- **Statement**: "I know a secret that corresponds to one of the deposits in the pool"
- **Proof**: Mathematical proof that this is true
- **What's hidden**: Which deposit, what the secret is

## Groth16 Proving System

Dogenado uses **Groth16**, a zkSNARK system with:

| Property | Value |
|----------|-------|
| Proof Size | 192 bytes (constant) |
| Verification Time | ~10ms |
| Proving Time | 30-60 seconds |
| Security | 128-bit |

## The Withdrawal Circuit

The circuit proves:

1. **Knowledge of preimage**: Prover knows `(secret, nullifier)` such that:
   ```
   commitment = hash(nullifier, secret)
   ```

2. **Merkle membership**: The commitment exists in the Merkle tree:
   ```
   root = MerkleProof(commitment, path)
   ```

3. **Nullifier computation**: The nullifier hash is correctly computed:
   ```
   nullifierHash = hash(nullifier)
   ```

### Circuit Inputs

| Input | Type | Visibility |
|-------|------|------------|
| `root` | Field | Public |
| `nullifierHash` | Field | Public |
| `recipient` | Address | Public |
| `secret` | Field | Private |
| `nullifier` | Field | Private |
| `pathElements[20]` | Field[] | Private |
| `pathIndices[20]` | Bits | Private |

### Public vs Private Inputs

**Public Inputs** (visible on-chain):
- Merkle root
- Nullifier hash
- Recipient address

**Private Inputs** (never revealed):
- Secret
- Nullifier
- Merkle path

## How Proofs are Generated

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
│                                                          │
│  ┌────────────┐    ┌─────────────┐    ┌──────────────┐  │
│  │   User     │    │   snarkjs   │    │   Circuit    │  │
│  │   Inputs   │───>│   Library   │<───│   WASM       │  │
│  │            │    │             │    │   + zkey     │  │
│  └────────────┘    └──────┬──────┘    └──────────────┘  │
│                           │                              │
│                           ▼                              │
│                    ┌──────────────┐                      │
│                    │    Proof     │                      │
│                    │  (a, b, c)   │                      │
│                    └──────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### Process:

1. **Load Circuit**: WASM file defines the circuit logic
2. **Load Proving Key**: zkey file contains trusted setup parameters
3. **Compute Witness**: Calculate all intermediate values
4. **Generate Proof**: Create cryptographic proof

## Trusted Setup

Groth16 requires a trusted setup ceremony to generate proving/verifying keys.

### What is a Trusted Setup?

A multi-party computation where:
1. Multiple participants contribute randomness
2. Each participant destroys their randomness after contributing
3. If at least ONE participant is honest, the setup is secure

### Security Guarantee

The trusted setup ensures:
- ✅ Cannot create fake proofs
- ✅ Cannot extract private information from proofs
- ✅ Verification is always reliable

### Our Trusted Setup

Dogenado uses a trusted setup with contributions from multiple sources to ensure security.

## Proof Verification

On-chain verification checks:

```solidity
function verifyProof(
    uint[2] memory a,      // Proof element A
    uint[2][2] memory b,   // Proof element B  
    uint[2] memory c,      // Proof element C
    uint[2] memory input   // [root, nullifierHash]
) public view returns (bool)
```

The verifier:
1. Performs elliptic curve pairings
2. Checks mathematical relationships
3. Returns true/false

## Security Properties

### Soundness

An invalid proof cannot pass verification (cryptographic guarantee).

### Zero-Knowledge

The proof reveals nothing about:
- Which deposit you're withdrawing
- Your secret or nullifier
- The Merkle path used

### Completeness

A valid proof will always verify if the statement is true.

## Circuit Constraints

| Component | Constraints |
|-----------|-------------|
| Pedersen Hash | ~1,000 |
| MiMC Hash (per level) | ~300 |
| Merkle Tree (20 levels) | ~6,000 |
| Total | ~7,000 |

## Performance

### Client-Side (Browser)

| Operation | Time |
|-----------|------|
| Load WASM | 2-3 seconds |
| Compute Witness | 5-10 seconds |
| Generate Proof | 20-40 seconds |
| **Total** | **30-60 seconds** |

### On-Chain Verification

| Operation | Gas Cost |
|-----------|----------|
| Verify Groth16 | ~220,000 gas |
| Check nullifier | ~5,000 gas |
| Transfer tokens | ~50,000 gas |
| **Total** | **~300,000 gas** |

## Further Reading

- [Groth16 Paper](https://eprint.iacr.org/2016/260)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [circom Language](https://docs.circom.io/)

---

**Next:** [Merkle Tree](/technical/merkle-tree)

