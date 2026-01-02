# Shielded Layer Implementation Plan

## Executive Summary

**Goal:** Enable users to hold, move, and exit value on DogeOS without revealing intent, strategy, or counterparties — while remaining non-custodial and auditable.

**Feasibility:** HIGH — We have the core infrastructure. This is incremental, not a rewrite.

**Timeline:** 2-3 months to production-ready (testnet → audit → mainnet)

---

## What We're Building

```
┌─────────────────────────────────────────────────────────────────┐
│                        PUBLIC LAYER (DogeOS)                     │
│                                                                  │
│   Wallet A                                              Wallet B │
│   ┌─────┐                                               ┌─────┐ │
│   │ 💰  │                                               │ 💰  │ │
│   └──┬──┘                                               └──▲──┘ │
│      │                                                     │    │
│      │ SHIELD (t→z)                           UNSHIELD (z→t)    │
│      ▼                                                     │    │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │                    SHIELDED LAYER                          │  │
│ │  ┌──────────┐    TRANSFER (z→z)     ┌──────────┐          │  │
│ │  │ 🔒 Note  │ ────────────────────► │ 🔒 Note  │          │  │
│ │  │ Owner: A │                       │ Owner: B │          │  │
│ │  └──────────┘                       └──────────┘          │  │
│ │                                                            │  │
│ │  On-chain: Only commitments, nullifiers, proofs           │  │
│ │  Hidden: Sender, receiver, amount, strategy               │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### 1. Shielded Address System

```typescript
// Each user generates a shielded identity
interface ShieldedIdentity {
  // SECRET - Never share
  spendingKey: bigint      // For spending notes
  
  // SECRET - Can share with auditors/services
  viewingKey: bigint       // For scanning incoming notes
  
  // PUBLIC - Share with anyone
  shieldedAddress: string  // dogenado:z1abc123...
}
```

**Key Derivation:**
```
spendingKey = random(31 bytes)
viewingKey = MiMC(spendingKey, "view")  
shieldedAddress = MiMC(spendingKey, "addr")
```

**Address Format:**
```
dogenado:z1<base58_of_shielded_pubkey>

Example: dogenado:z1Qm7X9kL2nP4vR8jW3tY6uI0oS5aF1gH2kJ3l
```

### 2. Enhanced Note Structure

**Current (Mixer):**
```typescript
// Anyone with note can withdraw
note = {
  secret: bigint,
  nullifier: bigint,
  commitment: MiMC(secret, nullifier)
}
```

**New (Shielded):**
```typescript
// Only owner with spending_key can spend
shieldedNote = {
  // The value
  amount: bigint,
  tokenAddress: address,
  
  // Ownership
  ownerPubkey: bigint,  // Shielded address
  
  // Randomness (for hiding)
  secret: bigint,
  blinding: bigint,
  
  // Computed
  commitment: bigint,     // On-chain
  nullifier: bigint,      // Derived when spending
  
  // Position
  leafIndex: number
}
```

**Commitment Formula:**
```
commitment = MiMC(
  MiMC(amount, ownerPubkey),
  MiMC(secret, blinding)
)
```

**Nullifier Formula (requires spending_key to compute):**
```
nullifier = MiMC(
  MiMC(secret, leafIndex),
  spendingKey
)
```

### 3. ZK Circuits

#### Circuit A: Shield (t→z) — "Enter Private Mode"

```circom
template Shield() {
  // Public
  signal input commitment;      // New note commitment
  signal input tokenAmount;     // Amount being shielded
  signal input tokenAddress;    // Token type
  
  // Private
  signal input amount;
  signal input ownerPubkey;
  signal input secret;
  signal input blinding;
  
  // Verify commitment matches inputs
  // Similar to current deposit, but with ownership
}
```

#### Circuit B: Transfer (z→z) — "Move Within Private Mode"

```circom
template Transfer() {
  // Public inputs
  signal input merkleRoot;
  signal input inputNullifier;         // Spending this note
  signal input outputCommitment1;      // To recipient
  signal input outputCommitment2;      // Change back to sender
  signal input relayerFee;
  
  // Private inputs (input note)
  signal input inputAmount;
  signal input inputOwnerPubkey;
  signal input inputSecret;
  signal input inputBlinding;
  signal input inputLeafIndex;
  signal input pathElements[20];
  signal input pathIndices[20];
  
  // Private inputs (spending authority)
  signal input spendingKey;
  
  // Private inputs (output notes)
  signal input output1Amount;
  signal input output1OwnerPubkey;
  signal input output1Secret;
  signal input output1Blinding;
  
  signal input output2Amount;
  signal input output2OwnerPubkey;
  signal input output2Secret;
  signal input output2Blinding;
  
  // CONSTRAINTS:
  // 1. Input note is in Merkle tree
  // 2. Nullifier computed correctly (proves ownership)
  // 3. Value conservation: input = output1 + output2 + fee
  // 4. Output commitments computed correctly
}
```

#### Circuit C: Unshield (z→t) — "Exit Private Mode"

```circom
template Unshield() {
  // Public
  signal input merkleRoot;
  signal input nullifier;
  signal input recipient;        // PUBLIC Ethereum address
  signal input amount;
  signal input relayer;
  signal input fee;
  
  // Private (note being spent)
  signal input noteAmount;
  signal input noteOwnerPubkey;
  signal input noteSecret;
  signal input noteBlinding;
  signal input leafIndex;
  signal input pathElements[20];
  signal input pathIndices[20];
  
  // Private (authority)
  signal input spendingKey;
  
  // CONSTRAINTS:
  // 1. Note in Merkle tree
  // 2. Nullifier proves ownership
  // 3. Amount matches (or value conservation with change)
  // 4. Bind recipient to prevent front-running
}
```

### 4. Smart Contracts

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IShieldedPool {
    // Events
    event Shield(bytes32 indexed commitment, uint256 leafIndex, uint256 timestamp);
    event Transfer(bytes32 indexed nullifier, bytes32 outputCommitment1, bytes32 outputCommitment2);
    event Unshield(bytes32 indexed nullifier, address indexed recipient, uint256 amount);
    
    // Shield: Public → Shielded
    // User deposits tokens, creates shielded note
    function shield(
        bytes32 commitment,
        uint256 amount
    ) external;
    
    // Transfer: Shielded → Shielded
    // Spend note, create new notes for recipient + change
    function transfer(
        uint256[8] calldata proof,
        bytes32 merkleRoot,
        bytes32 inputNullifier,
        bytes32 outputCommitment1,
        bytes32 outputCommitment2,
        address relayer,
        uint256 fee
    ) external;
    
    // Unshield: Shielded → Public
    // Spend note, send tokens to public address
    function unshield(
        uint256[8] calldata proof,
        bytes32 merkleRoot,
        bytes32 nullifier,
        address recipient,
        uint256 amount,
        address relayer,
        uint256 fee
    ) external;
}
```

### 5. Note Discovery Problem

**Challenge:** How does the recipient know they received shielded funds?

**Solution Options:**

#### Option A: Encrypted On-Chain Memo (Most Private)
```solidity
event Transfer(
    bytes32 indexed nullifier,
    bytes32 outputCommitment1,
    bytes32 outputCommitment2,
    bytes encryptedMemo1,  // Encrypted with recipient's viewing key
    bytes encryptedMemo2   // Encrypted with sender's viewing key (for change)
);
```

Recipient scans all Transfer events, tries to decrypt with viewing key.

#### Option B: Off-Chain Notification (Simpler)
- Sender generates note details
- Sender shares note details directly with recipient (encrypted message, QR code, etc.)
- Recipient imports note

**Recommendation:** Start with Option B (simpler), add Option A later.

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Shielded addresses + Shield/Unshield with ownership

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Shield + Unshield                              │
│                                                         │
│   Public Wallet ──SHIELD──► Shielded Note               │
│                                                         │
│   Shielded Note ──UNSHIELD──► Public Wallet             │
│                                                         │
│   (No transfers yet, but ownership is enforced)         │
└─────────────────────────────────────────────────────────┘
```

**Deliverables:**
1. `lib/shielded-address.ts` — Key generation, derivation
2. `lib/shielded-note.ts` — Enhanced note structure
3. `circuits/shield.circom` — Shield circuit
4. `circuits/unshield.circom` — Unshield circuit  
5. `contracts/ShieldedPool.sol` — Shield + Unshield
6. Frontend: Generate shielded address, shield/unshield UI

### Phase 2: Transfers (Week 3-4)

**Goal:** Private transfers between shielded addresses

```
┌─────────────────────────────────────────────────────────┐
│ Phase 2: Transfers                                      │
│                                                         │
│   Alice's Note ──TRANSFER──► Bob's Note + Alice's Change│
│                                                         │
│   (Full private transfer capability)                    │
└─────────────────────────────────────────────────────────┘
```

**Deliverables:**
1. `circuits/transfer.circom` — Transfer circuit
2. Updated contract with `transfer()` function
3. Frontend: Send to shielded address UI
4. Note sharing mechanism (QR code, copy/paste)

### Phase 3: Polish + Security (Week 5-8)

**Goal:** Production-ready

**Deliverables:**
1. Security audit of circuits
2. Security audit of contracts
3. Optimized proving (faster browser prover)
4. Shielded balance dashboard
5. Transaction history (client-side only)
6. Error handling, edge cases
7. Documentation

---

## Complexity Estimates

### Circuit Constraints

| Circuit | Estimated Constraints | Proving Time (Browser) |
|---------|----------------------|------------------------|
| Current Withdraw | ~30,000 | 10-30s |
| Shield (new) | ~35,000 | 15-35s |
| Unshield (new) | ~40,000 | 20-40s |
| Transfer (new) | ~80,000 | 40-90s |

**Note:** These are estimates. Actual will depend on optimization.

### Contract Size

| Contract | Estimated Size | Gas (Deploy) |
|----------|---------------|--------------|
| Current MixerPoolV2 | ~8KB | ~2M gas |
| ShieldedPool | ~12KB | ~3M gas |

---

## What's Different From Current Mixer

| Feature | Current Mixer | Shielded Layer |
|---------|--------------|----------------|
| Ownership | Note = ownership | Private key = ownership |
| Transfers | ❌ Deposit → Withdraw only | ✅ Private transfers |
| Amounts | Fixed denominations | Fixed (MVP) → Confidential (later) |
| Addresses | Public only | Shielded addresses |
| Recovery | Lose note = lose funds | Lose spending key = lose funds |
| UX Mental Model | "Mixer" | "Private wallet" |

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Circuit bugs | Medium | High | Thorough testing, audit |
| Proving too slow | Low | Medium | Optimize circuits, consider server prover |
| Contract vulnerabilities | Low | High | Audit, formal verification |
| Key management errors | Medium | High | Good UX, backup prompts |

### Regulatory Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Privacy tech scrutiny | Medium | High | Position as UX, not anonymity |
| Sanctions compliance | Low | High | Optional compliance features |

**Mitigation Strategies:**
1. Frame as "privacy for UX" not "privacy for crime"
2. Support optional viewing key disclosure (for auditors)
3. Clear terms of service
4. Geo-blocking if required
5. Consider Railgun-style compliance option

---

## Coexistence Strategy

**Keep both systems running:**

```
┌─────────────────────────────────────────────────────────┐
│                    DOGENADO                             │
│                                                         │
│  ┌──────────────────┐    ┌────────────────────────────┐│
│  │   MIXER (v1)     │    │   SHIELDED LAYER (v2)     ││
│  │                  │    │                            ││
│  │  - Simple        │    │  - Private transfers      ││
│  │  - Deposit/      │    │  - Shielded addresses     ││
│  │    Withdraw      │    │  - Ownership enforcement  ││
│  │  - Fixed denoms  │    │  - Full private UX        ││
│  │                  │    │                            ││
│  │  (Keep running)  │    │  (New capability)          ││
│  └──────────────────┘    └────────────────────────────┘│
│                                                         │
│  Users choose based on needs                            │
└─────────────────────────────────────────────────────────┘
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Can generate shielded address
- [ ] Can shield tokens (t→z)
- [ ] Can unshield tokens (z→t)
- [ ] Ownership enforced (only owner can unshield)
- [ ] Works on testnet

### Phase 2 Complete When:
- [ ] Can transfer shielded → shielded (z→z)
- [ ] Change notes work correctly
- [ ] Note discovery works (recipient can claim)
- [ ] Works on testnet

### Production Ready When:
- [ ] Security audit passed
- [ ] Gas costs acceptable
- [ ] Proving time < 2 minutes
- [ ] UX is intuitive
- [ ] Documentation complete
- [ ] Mainnet deployment

---

## Next Steps

1. **Confirm this direction** — Review this doc, ask questions
2. **Set up development environment** — New circuits folder
3. **Implement shielded addresses** — First building block
4. **Build shield circuit** — Simplest new circuit
5. **Iterate from there**

---

## Questions to Decide

1. **Amount privacy:** Start with fixed denominations or confidential?
   - Recommendation: Fixed (simpler), add confidential later

2. **Note discovery:** On-chain encrypted or off-chain sharing?
   - Recommendation: Off-chain first (simpler)

3. **Viewing key disclosure:** Support optional auditor access?
   - Recommendation: Yes, design for it from start

4. **Token support:** All current tokens or start with DOGE only?
   - Recommendation: Start with DOGE + USDC, add others

5. **Migration:** Auto-migrate mixer notes or fresh start?
   - Recommendation: Fresh start (different cryptography)


