---
id: check-status
title: Check Note Status
sidebar_position: 4
---

# Check Note Status

Verify whether a deposit note has been withdrawn without using it.

## Why Check Status?

Before attempting a withdrawal, you may want to verify:
- The note is valid
- The deposit exists in the pool
- The note hasn't already been spent

## How to Check

### 1. Navigate to Check

Go to **Dashboard → Check** or visit `/dashboard/check`

### 2. Paste Your Note

Enter your complete secret note:

```
dogenado-weth1-1-0xabc123...
```

### 3. Click Check

The system will verify:

1. **Note Format** - Is it a valid Dogenado note?
2. **Pool Existence** - Does the pool exist?
3. **Deposit Verification** - Is the commitment in the Merkle tree?
4. **Spent Status** - Has the nullifier been used?

## Status Results

### Valid - Not Withdrawn

```
Status: Active
──────────────
Token: WETH
Amount: 1
Pool: WETH 1
Nullifier: Not spent
Action: Ready to withdraw
```

This note can be used to withdraw funds.

### Already Withdrawn

```
Status: Spent
──────────────
Token: WETH  
Amount: 1
Pool: WETH 1
Nullifier: Spent
Action: Cannot withdraw
```

This note has already been used. Funds were withdrawn previously.

### Invalid Note

```
Status: Invalid
──────────────
Error: Note format invalid
Action: Check note and try again
```

The note format is incorrect or corrupted.

## Technical Details

When you check a note, the following happens:

1. **Parse Note**: Extract pool ID, commitment, nullifier, and secret
2. **Compute Nullifier Hash**: `hash(nullifier)`
3. **Query Contract**: Check if nullifier hash exists in spent list
4. **Return Status**: Report whether note is spent or available

This process doesn't consume the note or create any on-chain transaction.

## Privacy Consideration

:::info No Transaction Required
Checking a note status doesn't require a wallet connection or blockchain transaction. The check is performed locally and via read-only blockchain queries.
:::

---

**Next:** [Tips for Anonymity](/user-guide/tips-anonymity)

