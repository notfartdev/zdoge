# Shielded Transaction User Flows

This document explains exactly how each user flow works in Dogenado's shielded transaction system.

---

## 📋 Overview

Dogenado now supports **three types of privacy operations**:

| Operation | Description | From → To |
|-----------|-------------|-----------|
| **Shield** | Convert public DOGE to shielded DOGE | t → z (transparent → shielded) |
| **Transfer** | Send shielded DOGE to another user | z → z (shielded → shielded) |
| **Unshield** | Convert shielded DOGE back to public | z → t (shielded → transparent) |
| **Swap** | Exchange shielded tokens privately | z → z (shielded → shielded) |

---

## 🔐 Shielded Address

Every user gets a **shielded address** derived from their **spending key**:

```
Spending Key (private) → Viewing Key → Shielded Address (public)
```

- **Spending Key**: Master private key. Can spend notes and view balance.
- **Viewing Key**: Can see incoming transfers, but cannot spend.
- **Shielded Address**: Like a Z-address in Zcash. Share this to receive funds.

Example shielded address:
```
dogenado:z_abc123def456...
```

---

## Flow 1: Shield → Swap → Unshield

**Question**: "After a swap, is the received token also shielded?"

**Answer: YES!** The swapped token remains shielded until you explicitly unshield it.

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR PUBLIC WALLET                        │
│                       100 DOGE                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼ SHIELD (deposit)
┌─────────────────────────────────────────────────────────────┐
│                    SHIELDED LAYER                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Note 1: [100 DOGE, owner: YOU]                      │    │
│  │ Status: SHIELDED ✓                                  │    │
│  └──────────────────────────┬──────────────────────────┘    │
│                             │                                │
│                             ▼ SWAP (100 DOGE → 15 USDC)      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Note 1: BURNED ✗                                    │    │
│  │ Note 2: [15 USDC, owner: YOU]                       │    │
│  │ Status: SHIELDED ✓ ← STILL PRIVATE!                 │    │
│  └──────────────────────────┬──────────────────────────┘    │
│                             │                                │
│                             ▼ OPTIONS:                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ A) Keep shielded (private savings)                  │    │
│  │ B) Swap again (USDC → WETH)                         │    │
│  │ C) Transfer to someone else                         │    │
│  │ D) Unshield (withdraw)                              │    │
│  └──────────────────────────┬──────────────────────────┘    │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │
                              ▼ UNSHIELD (if option D)
┌─────────────────────────────────────────────────────────────┐
│                    YOUR PUBLIC WALLET                        │
│                       15 USDC                                │
└─────────────────────────────────────────────────────────────┘
```

**Key point**: You can hold multiple shielded tokens (DOGE, USDC, WETH, etc.) simultaneously. They all stay private until unshielded.

---

## Flow 2: Private Transfer (User A → User B)

**Question**: "How does User B receive the 100 DOGE?"

### Step-by-Step Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                           USER A                                      │
│                                                                       │
│  1. Has 100 DOGE shielded note                                       │
│     Note: [100 DOGE, owner: UserA, secret: abc123]                   │
│                                                                       │
│  2. Gets User B's shielded address                                   │
│     "Hey Bob, what's your shielded address?"                         │
│     Bob: "dogenado:z_bob456..."                                      │
│                                                                       │
│  3. Initiates transfer to Bob's address                              │
│     - Generates ZK proof (proves ownership + valid spend)            │
│     - Creates new note: [100 DOGE, owner: UserB]                     │
│     - Encrypts note details for Bob                                  │
│                                                                       │
│  4. Submits transaction with encrypted memo                          │
│     Contract receives:                                                │
│     - nullifier (marks old note as spent)                            │
│     - new commitment (Bob's new note)                                │
│     - encrypted memo (note details for Bob)                          │
│     - ZK proof                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ ON-CHAIN TRANSACTION
┌──────────────────────────────────────────────────────────────────────┐
│                        SHIELDED POOL CONTRACT                         │
│                                                                       │
│  Stores:                                                              │
│  - New commitment in Merkle tree                                     │
│  - Nullifier (marks Alice's note as spent)                           │
│                                                                       │
│  Emits Transfer Event:                                               │
│  {                                                                    │
│    nullifierHash: 0x123...,                                          │
│    outputCommitment: 0xabc...,                                       │
│    encryptedMemo: 0x[encrypted note details for Bob]                 │
│  }                                                                    │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ AUTO-DISCOVERY
┌──────────────────────────────────────────────────────────────────────┐
│                           USER B (Bob)                                │
│                                                                       │
│  Bob's wallet automatically:                                         │
│                                                                       │
│  1. Scans Transfer events from the contract                          │
│                                                                       │
│  2. For each event:                                                  │
│     - Tries to decrypt encryptedMemo with viewing key                │
│     - If decryption succeeds → this note is for Bob!                 │
│     - If decryption fails → not Bob's note, skip                     │
│                                                                       │
│  3. Auto-imports discovered notes                                    │
│     "You received 100 DOGE! 🎉"                                      │
│                                                                       │
│  4. Bob can now:                                                     │
│     - Keep it shielded                                               │
│     - Transfer to someone else                                       │
│     - Swap for another token                                         │
│     - Unshield to his public wallet                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### What the Blockchain Sees

| Visible | Hidden |
|---------|--------|
| A nullifier was spent | Who spent it (Alice) |
| A new commitment was added | Who owns it (Bob) |
| An encrypted blob exists | What the amount is |
| Gas was paid | The transfer details |

**Privacy guarantee**: An observer cannot link Alice's deposit to Bob's withdrawal.

---

## Do We Need Burner Addresses?

### Short Answer: No (for MVP)

Burner addresses (like Hush uses) provide extra privacy:
- Fresh address for every receive
- Prevents address reuse tracking
- One-time use, then discarded

### Our Approach (like Zcash/Railgun)

We use a **single shielded address per user** because:
1. **Privacy comes from ZK proofs**, not address obscurity
2. Notes are encrypted - observers can't see recipients anyway
3. Simpler UX - one address to share

### When You Might Want Burners

- Ultra-high privacy scenarios
- Receiving from multiple untrusted sources
- Preventing correlation analysis

**Future enhancement**: We can add stealth addresses later for users who want maximum privacy.

---

## Technical: How Auto-Discovery Works

### Problem
When Alice sends to Bob, how does Bob know he received funds?

### Solution: Encrypted Memos

1. **Alice encrypts note details** with Bob's viewing key
2. **Encrypted memo published on-chain** with the transfer
3. **Bob scans Transfer events** and tries to decrypt
4. **Successful decryption** = Bob owns the note

```typescript
// Alice encrypts
const encryptedMemo = encryptNoteForRecipient(note, bobShieldedAddress);

// Bob decrypts (in background scanner)
for (const event of transferEvents) {
  const decrypted = tryDecryptMemo(event.encryptedMemo, myViewingKey);
  if (decrypted) {
    // This note is mine!
    importNote(decrypted);
  }
}
```

### Privacy Properties

- **Only Bob can decrypt** notes meant for him
- **Alice cannot track** if Bob claimed the note
- **Observers see encrypted blobs** - no useful info

---

## Complete Example: Private Payment

**Scenario**: Alice wants to pay Bob 50 DOGE privately.

### Alice's Steps

1. **Shield** 100 DOGE (creates Note A)
2. **Transfer** 50 DOGE to Bob's shielded address
   - Note A (100 DOGE) → burned
   - Note B (50 DOGE) → for Bob (encrypted memo)
   - Note C (50 DOGE) → change back to Alice (encrypted memo)
3. Transaction submitted

### Bob's Experience

1. Opens Dogenado shielded wallet
2. Wallet auto-scans for new notes
3. Decrypts Note B successfully
4. **"You received 50 DOGE!"**
5. Bob can unshield whenever he wants

### Alice's Experience

1. Wallet auto-discovers change Note C
2. Balance shows: 50 DOGE shielded
3. Original Note A is gone (spent)

---

## Summary Table

| Question | Answer |
|----------|--------|
| Is swapped token still shielded? | **YES** - stays shielded until you unshield |
| Do we need burner addresses? | **NO** for MVP - single shielded address is fine |
| How does recipient receive? | **Auto-discovery** via encrypted memos |
| What does blockchain see? | Only commitments, nullifiers, encrypted blobs |
| Can observer link sender/receiver? | **NO** - ZK proofs hide the connection |

---

## Next Steps

1. **Build ZK circuits** (`circuits/shielded/build.sh`)
2. **Deploy verifier contracts** (from generated Solidity)
3. **Deploy ShieldedPool** (`deploy-shielded-pool.ts`)
4. **Test on DogeOS testnet**


