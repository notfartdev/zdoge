# Shielded Transactions Design - Zcash/Railgun Style

## Overview

This document outlines the design for upgrading Dogenado from a Tornado Cash-style mixer to a Zcash/Railgun-style shielded transaction system.

## Current System (Tornado-Style)

**What we have:**
- Deposit → creates commitment in Merkle tree
- Withdraw → prove knowledge of commitment
- **No ownership model** - anyone with note can withdraw
- **No transfers** - only deposit/withdraw

**Limitations:**
- Can't send private funds to another user
- No ownership enforcement (note = ownership)
- Fixed denominations only

## Proposed System (Zcash-Style)

**What we'll have:**
- Shield (t→z) → deposit into shielded pool
- Transfer (z→z) → send shielded funds to another shielded address
- Unshield (z→t) → withdraw to public address
- **Ownership enforced by cryptography** (private keys)
- **Confidential amounts** (optional, can start with fixed denominations)

## Architecture

### 1. Shielded Address System

#### 1.1 Key Pairs

Each user has:

```
spending_key (sk_spend) - Private key for spending notes
viewing_key (vk_view) - Private key for viewing received notes
shielded_address (pk_shielded) - Public key derived from spending key
```

**Key Derivation:**
```typescript
// Spending key (random 31 bytes)
sk_spend = randomFieldElement()

// Viewing key (derived from spending key)
vk_view = MiMC(spending_key, 0) // Or use different derivation

// Shielded address (public key)
pk_shielded = MiMC(spending_key, 1) // Public identifier
```

#### 1.2 Address Format

```
dogenado-shielded-<version>-<pk_shielded_hex>
Example: dogenado-shielded-1-abc123...def456...
```

### 2. Note Structure

#### 2.1 Enhanced Note

```typescript
interface ShieldedNote {
  // Public (on-chain commitment)
  commitment: bigint  // C = Commit(amount, pk_shielded, secret, blinding)
  
  // Private (known to owner)
  amount: bigint
  owner_pubkey: bigint  // Shielded address public key
  secret: bigint  // Random secret
  blinding: bigint  // Random blinding factor
  
  // For spending
  nullifier: bigint  // N = Hash(secret, leaf_index, sk_spend)
  nullifierHash: bigint  // Published on-chain
  
  // Metadata
  leafIndex: number  // Position in Merkle tree
  pool: string  // Which pool (token type)
}
```

#### 2.2 Commitment Computation

```typescript
// Commitment = MiMC(MiMC(amount, pk_shielded), MiMC(secret, blinding))
commitment = MiMC(
  MiMC(amount, owner_pubkey),
  MiMC(secret, blinding)
)
```

**Why nested?** Makes it harder to link commitments, better privacy.

### 3. ZK Circuits

#### 3.1 Circuit A: Spend + Transfer (z→z)

**Purpose:** Transfer shielded funds to another shielded address

**Public Inputs:**
- `root` - Merkle root
- `nullifierHash` - Spent note's nullifier
- `outputCommitment1` - New note for recipient
- `outputCommitment2` - Change note (back to sender, if needed)
- `fee` - Optional relayer fee

**Private Inputs:**
- `inputNote` - The note being spent
  - `amount`
  - `owner_pubkey`
  - `secret`
  - `blinding`
  - `pathElements`
  - `pathIndices`
- `spending_key` - Proves ownership
- `recipient_pubkey` - Receiver's shielded address
- `transfer_amount` - Amount to transfer
- `change_amount` - Change back to sender
- `newSecret1`, `newBlinding1` - For recipient note
- `newSecret2`, `newBlinding2` - For change note

**Circuit Logic:**
1. Verify input note commitment in Merkle tree
2. Verify ownership: `nullifier = Hash(secret, leafIndex, sk_spend)`
3. Verify value conservation: `input.amount = transfer_amount + change_amount + fee`
4. Compute and verify output commitments:
   - `outputCommitment1 = Commit(transfer_amount, recipient_pubkey, newSecret1, newBlinding1)`
   - `outputCommitment2 = Commit(change_amount, sender_pubkey, newSecret2, newBlinding2)`

#### 3.2 Circuit B: Unshield (z→t)

**Purpose:** Withdraw shielded funds to public address

**Public Inputs:**
- `root` - Merkle root
- `nullifierHash` - Spent note's nullifier
- `recipient` - Public address (Ethereum address)
- `amount` - Withdrawal amount (can be public or private)
- `relayer` - Relayer address
- `fee` - Relayer fee

**Private Inputs:**
- `inputNote` - The note being spent
- `spending_key` - Proves ownership
- `pathElements`, `pathIndices` - Merkle path

**Circuit Logic:**
1. Verify input note commitment in Merkle tree
2. Verify ownership via nullifier
3. Verify value conservation: `input.amount = withdrawal_amount + fee`
4. Bind recipient address to prevent front-running

### 4. Smart Contract Changes

#### 4.1 New Contract: ShieldedPool

```solidity
contract ShieldedPool {
    // Merkle tree of commitments
    MerkleTreeWithHistory public merkleTree;
    
    // Spent nullifiers
    mapping(bytes32 => bool) public nullifiers;
    
    // New commitments (for transfers)
    event CommitmentAdded(bytes32 indexed commitment, uint256 indexed leafIndex);
    
    // Transfer (z→z)
    function transfer(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        bytes32 outputCommitment1,  // Recipient
        bytes32 outputCommitment2,   // Change (or 0)
        address relayer,
        uint256 fee
    ) external {
        // Verify proof
        require(verifier.verify(proof, [root, nullifierHash, ...]), "Invalid proof");
        
        // Check nullifier not spent
        require(!nullifiers[nullifierHash], "Nullifier already spent");
        nullifiers[nullifierHash] = true;
        
        // Add new commitments to tree
        merkleTree.insert(outputCommitment1);
        if (outputCommitment2 != bytes32(0)) {
            merkleTree.insert(outputCommitment2);
        }
        
        emit CommitmentAdded(outputCommitment1, merkleTree.currentLeafIndex());
    }
    
    // Unshield (z→t)
    function unshield(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        uint256 amount,
        address relayer,
        uint256 fee
    ) external {
        // Verify proof
        require(verifier.verify(proof, [root, nullifierHash, ...]), "Invalid proof");
        
        // Check nullifier not spent
        require(!nullifiers[nullifierHash], "Nullifier already spent");
        nullifiers[nullifierHash] = true;
        
        // Transfer tokens
        token.safeTransfer(recipient, amount);
        if (fee > 0 && relayer != address(0)) {
            token.safeTransfer(relayer, fee);
        }
        
        emit Unshielded(recipient, nullifierHash, amount);
    }
}
```

### 5. Frontend Changes

#### 5.1 Shielded Address Management

```typescript
// lib/shielded-address.ts
export interface ShieldedKeyPair {
  spendingKey: bigint
  viewingKey: bigint
  shieldedAddress: bigint
  addressString: string  // Serialized format
}

export function generateShieldedAddress(): ShieldedKeyPair {
  const spendingKey = randomFieldElement()
  const viewingKey = await deriveViewingKey(spendingKey)
  const shieldedAddress = await deriveShieldedAddress(spendingKey)
  
  return {
    spendingKey,
    viewingKey,
    shieldedAddress,
    addressString: serializeShieldedAddress(shieldedAddress)
  }
}

export function parseShieldedAddress(addressString: string): bigint {
  // Parse dogenado-shielded-1-<hex>
  // Return pk_shielded
}
```

#### 5.2 Note Management

```typescript
// lib/shielded-note-service.ts
export interface ShieldedNote {
  amount: bigint
  ownerPubkey: bigint
  secret: bigint
  blinding: bigint
  commitment: bigint
  nullifier: bigint
  nullifierHash: bigint
  leafIndex: number
  pool: string
}

// Generate note when receiving shielded transfer
export async function generateReceivedNote(
  amount: bigint,
  recipientPubkey: bigint,
  viewingKey: bigint
): Promise<ShieldedNote> {
  // Generate new note for received funds
  // Only owner with viewing key can decrypt/see this
}

// Spend note (for transfer or unshield)
export async function spendNote(
  note: ShieldedNote,
  spendingKey: bigint,
  recipient?: bigint,  // Shielded address for z→z
  publicRecipient?: string  // Public address for z→t
): Promise<Transaction>
```

### 6. Implementation Phases

#### Phase 1: Foundation (MVP)
1. ✅ Implement shielded address system
2. ✅ Update note structure (add owner_pubkey, amount)
3. ✅ Update commitment computation
4. ✅ Create basic unshield circuit (z→t)
5. ✅ Update contracts for unshield

**Result:** Can shield and unshield (like current system but with ownership)

#### Phase 2: Transfers
1. ✅ Create transfer circuit (z→z)
2. ✅ Update contracts for transfers
3. ✅ Frontend for shielded transfers
4. ✅ Change note handling

**Result:** Full shielded transaction system

#### Phase 3: Enhancements
1. Confidential amounts (hide amount in proofs)
2. Multiple input/output notes
3. Shielded address book
4. Batch transfers

## Security Considerations

### 1. Ownership Enforcement

**Critical:** Must prove ownership via spending key in nullifier computation.

```typescript
nullifier = MiMC(MiMC(secret, leafIndex), spending_key)
```

This ensures only the owner can spend the note.

### 2. Value Conservation

**Critical:** Circuit must enforce:
```
input_amount = output1_amount + output2_amount + fee
```

Prevents creating money out of thin air.

### 3. Front-Running Protection

Bind recipient address in proof to prevent front-running attacks.

### 4. Replay Protection

Nullifier hash prevents double-spending.

## Comparison: Current vs Proposed

| Feature | Current (Tornado) | Proposed (Zcash) |
|---------|------------------|------------------|
| Ownership | Note = ownership | Private key = ownership |
| Transfers | ❌ No | ✅ Yes (z→z) |
| Addresses | Public only | Shielded addresses |
| Amount Privacy | Fixed denominations | Can be confidential |
| Use Cases | Deposit/withdraw | Full private payments |

## Migration Path

1. **Keep current system running** (backward compatible)
2. **Deploy new ShieldedPool contracts** alongside MixerPool
3. **Gradual migration:**
   - Users can still use old system
   - New users use shielded system
   - Eventually deprecate old system

## Next Steps

1. Review and approve design
2. Implement Phase 1 (foundation)
3. Test shielded address generation
4. Test unshield flow
5. Implement Phase 2 (transfers)
6. Full integration testing


