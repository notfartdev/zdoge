---
id: smart-contracts
title: Smart Contracts
sidebar_position: 2
---

# Smart Contracts

Dogenado's core logic is implemented in Solidity smart contracts deployed on DogeOS.

## Contract Overview

| Contract | Purpose |
|----------|---------|
| **MixerPoolV2** | Main pool contract for deposits/withdrawals |
| **Verifier** | Groth16 ZK proof verification |
| **Hasher** | MiMC sponge hash function |

## MixerPoolV2

The main mixer contract handling deposits and withdrawals.

### Key Functions

#### deposit

```solidity
function deposit(bytes32 _commitment) external
```

Deposits tokens into the pool:
1. Transfers tokens from user to contract
2. Inserts commitment into Merkle tree
3. Emits `Deposit` event

#### withdraw

```solidity
function withdraw(
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
) external
```

Withdraws tokens from the pool:
1. Verifies the ZK proof
2. Checks nullifier hasn't been spent
3. Marks nullifier as spent
4. Transfers tokens to recipient (minus fee)

#### scheduleWithdrawal

```solidity
function scheduleWithdrawal(
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _delay
) external
```

Schedules a withdrawal with timelock:
1. Verifies the ZK proof
2. Stores withdrawal details with unlock timestamp
3. Emits `WithdrawalScheduled` event

#### executeScheduledWithdrawal

```solidity
function executeScheduledWithdrawal(bytes32 _nullifierHash) external
```

Executes a scheduled withdrawal after timelock:
1. Checks unlock time has passed
2. Marks nullifier as spent
3. Transfers tokens to recipient

### State Variables

```solidity
// Immutable configuration
IVerifier public immutable verifier;
IHasher public immutable hasher;
IERC20 public immutable token;
uint256 public immutable denomination;

// Merkle tree
uint32 public constant MERKLE_TREE_HEIGHT = 20;
uint32 public currentRootIndex;
uint32 public nextIndex;
bytes32[MERKLE_TREE_HEIGHT] public filledSubtrees;
bytes32[ROOT_HISTORY_SIZE] public roots;

// Nullifier tracking
mapping(bytes32 => bool) public nullifierHashes;

// Commitment tracking
mapping(bytes32 => bool) public commitments;

// Scheduled withdrawals
mapping(bytes32 => ScheduledWithdrawal) public scheduledWithdrawals;
```

### Events

```solidity
event Deposit(
    bytes32 indexed commitment,
    uint32 leafIndex,
    uint256 timestamp
);

event Withdrawal(
    address to,
    bytes32 nullifierHash,
    address indexed relayer,
    uint256 fee
);

event WithdrawalScheduled(
    bytes32 indexed nullifierHash,
    address recipient,
    uint256 unlockTime
);
```

## Verifier Contract

Auto-generated Groth16 verifier from the trusted setup.

### Verification

```solidity
function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[2] memory input
) public view returns (bool)
```

Inputs:
- `a`, `b`, `c`: Proof components
- `input[0]`: Root of Merkle tree
- `input[1]`: Nullifier hash

Returns `true` if the proof is valid.

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

- Commitments are hashed (can't predict deposits)
- Nullifiers are hashed (can't predict withdrawals)

## Gas Costs

| Operation | Approximate Gas |
|-----------|-----------------|
| Deposit | ~900,000 gas |
| Withdraw | ~300,000 gas |
| Schedule Withdrawal | ~350,000 gas |
| Execute Scheduled | ~150,000 gas |

---

**Next:** [Zero-Knowledge Proofs](/technical/zero-knowledge)

