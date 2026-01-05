---
id: zero-knowledge
title: Zero-Knowledge Proofs
sidebar_position: 3
---

# Zero-Knowledge Proofs

zDoge uses zkSNARKs (Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge) to enable private transactions.

## What is a Zero-Knowledge Proof?

A zero-knowledge proof allows you to prove a statement is true without revealing any information about why it's true.

**Example**: 
- **Statement**: "I own a valid shielded note in the Merkle tree"
- **Proof**: Mathematical proof that this is true
- **What's hidden**: Which note, the amount, your identity

## Groth16 Proving System

zDoge uses **Groth16**, a zkSNARK system with:

| Property | Value |
|----------|-------|
| Proof Size | 192 bytes (constant) |
| Verification Time | ~10ms |
| Proving Time | 30-60 seconds |
| Security | 128-bit |

## The Shielded Circuits

zDoge uses multiple circuits for different transaction types:

### Shield Circuit

Proves a commitment is correctly formed:

1. **Commitment computation**: 
   ```
   commitment = MiMC(amount, secret, blinding, token)
   ```

2. **Public inputs**: Commitment, token address, amount

### Transfer Circuit

Proves ownership and value conservation:

1. **Note ownership**: Prover knows secret for a note in the tree
2. **Value conservation**: input = output1 + output2 + fee
3. **Nullifier check**: Nullifier hash hasn't been used
4. **Merkle membership**: Input note exists in tree

**Public inputs**: Root, nullifier hash, output commitments, relayer, fee

### Unshield Circuit

Proves ownership for withdrawal:

1. **Note ownership**: Prover knows secret for a note in the tree
2. **Merkle membership**: Note exists in tree
3. **Nullifier check**: Nullifier hash hasn't been used

**Public inputs**: Root, nullifier hash, recipient, amount

### Swap Circuit

Proves valid token swap:

1. **Note ownership**: Prover owns input note
2. **Value conservation**: Proper exchange rate applied
3. **Nullifier check**: Input nullifier hasn't been used
4. **Merkle membership**: Input note exists in tree

**Public inputs**: Root, input nullifier hash, output commitment, tokens, amounts

## Circuit Constraints

| Circuit | Constraints | Complexity |
|---------|-------------|------------|
| Shield | ~5,000 | Low |
| Transfer | ~80,000 | High |
| Unshield | ~40,000 | Medium |
| Swap | ~50,000 | Medium |

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
- Cannot create fake proofs
- Cannot extract private information from proofs
- Verification is always reliable

### Our Trusted Setup

zDoge uses trusted setups with contributions from multiple sources to ensure security.

## Proof Verification

On-chain verification checks:

```solidity
function verifyProof(
    uint[2] memory a,      // Proof element A
    uint[2][2] memory b,   // Proof element B  
    uint[2] memory c,      // Proof element C
    uint[] memory input     // Public inputs (varies by circuit)
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
- Which note you're spending
- The transaction amount
- Your identity
- The Merkle path used

### Completeness

A valid proof will always verify if the statement is true.

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
| **Total** | **~300,000-500,000 gas** |

## Further Reading

- [Groth16 Paper](https://eprint.iacr.org/2016/260)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [circom Language](https://docs.circom.io/)

---

**Next:** [Merkle Tree](/technical/merkle-tree)
