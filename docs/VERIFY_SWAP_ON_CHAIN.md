# How to Verify Swap Transactions On-Chain

## Transaction: `0x85dd53af4bb220005cdd5644973d2ece128f80b50aa85601288af0fe3b957a87`

Visit: https://blockscout.testnet.dogeos.com/tx/0x85dd53af4bb220005cdd5644973d2ece128f80b50aa85601288af0fe3b957a87

## What to Look For:

### 1. Transaction Status
- ✅ **Status**: Should show "Success" (green checkmark)
- ✅ **Block Confirmed**: Should show a block number (e.g., #1841506)

### 2. Events Emitted
Look in the "Logs" or "Events" tab for:

#### a) `Swap` Event
```
Event: Swap
- inputNullifier: [nullifier hash marking spent DOGE note]
- outputCommitment: [commitment for new USDC note]
- tokenIn: 0x0000000000000000000000000000000000000000 (native DOGE)
- tokenOut: 0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925 (USDC)
- amountIn: 10000000000000000000 (10 DOGE)
- amountOut: 1396742951353006080 (1.3967 USDC)
```

#### b) `LeafInserted` Event
```
Event: LeafInserted
- leaf: [output commitment hash]
- leafIndex: 6 (or the next available index)
- newRoot: [new Merkle tree root]
```

### 3. Internal State Changes
- **Nullifier marked as spent**: The input nullifier should be recorded in the contract's `nullifierHashes` mapping
- **New commitment added**: The output commitment should be in the contract's `commitments` mapping
- **Merkle root updated**: The contract's root should have changed
- **Balances updated**: `totalShieldedBalance[DOGE]` decreased, `totalShieldedBalance[USDC]` increased

### 4. Token Transfers (if any)
If the contract interacts with a DEX or transfers tokens, you'll see token transfer events here.

## How to Verify in Blockscout:

1. **Go to the transaction page**
2. **Click on "Logs" tab** - You should see:
   - `Swap` event with all the details
   - `LeafInserted` event with the new leaf index
3. **Click on "State" tab** (if available) - You can see contract state changes
4. **Click on "Internal Transactions"** (if any) - Shows any internal contract calls

## What This Proves:

✅ **Proof was verified**: The transaction wouldn't succeed if the ZK proof was invalid
✅ **Note was spent**: The nullifier hash proves the input note was consumed
✅ **New note created**: The output commitment proves a new note was created
✅ **Privacy preserved**: You can't link the input note to the output note without knowing the secret
✅ **Amounts are correct**: The event shows the exact amounts swapped

## Privacy Guarantees:

- **Unlinkability**: On-chain, you can only see:
  - A nullifier hash (can't tell which note was spent)
  - A new commitment (can't tell what amount or who owns it)
  - Public swap amounts (DOGE → USDC rates are visible)
  
- **What's hidden**:
  - Which specific note was spent (only you know via the nullifier)
  - Who receives the output note (only the recipient knows via decryption)
  - The link between input and output (unless you have the secrets)
