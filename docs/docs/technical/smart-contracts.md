---
id: smart-contracts
title: Smart Contracts
sidebar_position: 2
---

# Smart Contracts

zDoge's core logic is implemented in Solidity smart contracts deployed on DogeOS.

## Contract Overview

| Contract | Purpose |
|----------|---------|
| **ShieldedPoolMultiToken** | Main contract for shield/transfer/unshield/swap |
| **ShieldVerifier** | Groth16 proof verification for shields |
| **TransferVerifier** | Groth16 proof verification for transfers |
| **UnshieldVerifier** | Groth16 proof verification for unshields |
| **SwapVerifier** | Groth16 proof verification for swaps |
| **Hasher** | MiMC sponge hash function |

## ShieldedPoolMultiToken

The main contract handling all shielded transaction types.

### Key Functions

#### shield

```solidity
function shield(
    bytes calldata proof,
    bytes32 commitment,
    address token,
    uint256 amount
) external
```

Shields tokens (converts public to private):
1. Verifies the ZK proof
2. Transfers tokens from user to contract
3. Inserts commitment into Merkle tree
4. Emits `Shield` event

#### transfer

```solidity
function transfer(
    bytes calldata proof,
    bytes32 root,
    bytes32 nullifierHash,
    bytes32[2] calldata outputCommitments,
    bytes[2] calldata encryptedMemos,
    address relayer,
    uint256 fee
) external
```

Transfers tokens privately between shielded addresses:
1. Verifies the ZK proof
2. Checks nullifier hasn't been spent
3. Marks nullifier as spent
4. Adds new commitments to Merkle tree
5. Emits `Transfer` event with encrypted memos

#### unshield

```solidity
function unshield(
    bytes calldata proof,
    bytes32 root,
    bytes32 nullifierHash,
    address recipient,
    address token,
    uint256 amount,
    address relayer,
    uint256 fee
) external
```

Unshields tokens (converts private to public):
1. Verifies the ZK proof
2. Checks nullifier hasn't been spent
3. Marks nullifier as spent
4. Transfers tokens to recipient (minus fee)
5. Emits `Unshield` event

#### swap

```solidity
function swap(
    bytes calldata proof,
    bytes32 root,
    bytes32 inputNullifier,
    bytes32 outputCommitment,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    bytes calldata encryptedMemo
) external
```

Swaps tokens within the shielded layer:
1. Verifies the ZK proof
2. Checks nullifier hasn't been spent
3. Marks nullifier as spent
4. Adds output commitment to Merkle tree
5. Emits `Swap` event with encrypted memo

### State Variables

```solidity
// Verifiers
IShieldVerifier public immutable shieldVerifier;
ITransferVerifier public immutable transferVerifier;
IUnshieldVerifier public immutable unshieldVerifier;
ISwapVerifier public immutable swapVerifier;

// Merkle tree
uint32 public constant MERKLE_TREE_HEIGHT = 20;
MerkleTree public tree;

// Nullifier tracking
mapping(bytes32 => bool) public nullifierHashes;

// Commitment tracking
mapping(bytes32 => bool) public commitments;
```

### Events

```solidity
event Shield(
    bytes32 indexed commitment,
    uint256 indexed leafIndex,
    address indexed token,
    uint256 amount,
    uint256 timestamp
);

event Transfer(
    bytes32 indexed nullifierHash,
    bytes32 outputCommitment1,
    bytes32 outputCommitment2,
    uint256 indexed leafIndex1,
    uint256 indexed leafIndex2,
    bytes encryptedMemo1,
    bytes encryptedMemo2,
    uint256 timestamp
);

event Unshield(
    bytes32 indexed nullifierHash,
    address indexed recipient,
    address indexed token,
    uint256 amount,
    address relayer,
    uint256 fee,
    uint256 timestamp
);

event Swap(
    bytes32 indexed inputNullifier,
    bytes32 outputCommitment,
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    bytes encryptedMemo,
    uint256 timestamp
);
```

## Verifier Contracts

Auto-generated Groth16 verifiers from the circuit trusted setup.

### ShieldVerifier

```solidity
function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[2] memory input
) public view returns (bool)
```

Verifies shield proofs:
- `input[0]`: Commitment
- `input[1]`: Token address
- `input[2]`: Amount

### TransferVerifier

```solidity
function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[6] memory input
) public view returns (bool)
```

Verifies transfer proofs:
- `input[0]`: Merkle root
- `input[1]`: Nullifier hash
- `input[2]`: Output commitment 1
- `input[3]`: Output commitment 2
- `input[4]`: Relayer address
- `input[5]`: Fee amount

### UnshieldVerifier

```solidity
function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[4] memory input
) public view returns (bool)
```

Verifies unshield proofs:
- `input[0]`: Merkle root
- `input[1]`: Nullifier hash
- `input[2]`: Recipient address
- `input[3]`: Amount

### SwapVerifier

```solidity
function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[5] memory input
) public view returns (bool)
```

Verifies swap proofs:
- `input[0]`: Merkle root
- `input[1]`: Input nullifier hash
- `input[2]`: Output commitment
- `input[3]`: Token in address
- `input[4]`: Token out address

## Hasher Contract

Implements MiMC sponge hash for Merkle tree operations.

```solidity
function MiMCSponge(
    uint256 in_xL,
    uint256 in_xR
) public pure returns (uint256 xL, uint256 xR)
```

Used for:
- Computing commitment hashes
- Building Merkle tree
- Computing nullifier hashes

## Security Considerations

### Reentrancy Protection

All external calls happen after state updates (checks-effects-interactions pattern).

### Overflow Protection

Uses Solidity 0.8+ built-in overflow checks.

### Access Control

- No admin functions
- No upgradability
- Immutable after deployment

### Front-running Protection

- Commitments are hashed (can't predict shields)
- Nullifiers are hashed (can't predict spends)
- Encrypted memos prevent front-running transfers

## Gas Costs

| Operation | Approximate Gas |
|-----------|-----------------|
| Shield | ~200,000 gas |
| Transfer | ~400,000 gas |
| Unshield | ~300,000 gas |
| Swap | ~350,000 gas |

---

**Next:** [Zero-Knowledge Proofs](/technical/zero-knowledge)
