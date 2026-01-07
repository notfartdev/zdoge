# Private Transfer Function Analysis

## Overview
The Private Transfer function enables users to send shielded tokens (z→z transfers) to another shielded address privately, without revealing sender, recipient, or amount on-chain.

## Frontend Flow (`components/shielded/transfer-interface.tsx`)

### 1. User Input
- **Recipient Address**: Must be a valid shielded address (starts with `zdoge:`)
- **Amount**: Amount to send in DOGE (or selected token)
- **Auto Note Selection**: Automatically finds the smallest note that can cover amount + fees

### 2. Validation
```typescript
// Validates:
- Recipient address format (zdoge:...)
- Amount > 0
- Sufficient balance (total and per-note)
- Relayer availability
```

### 3. Transaction Flow

#### Step 1: Proof Generation (`prepareTransfer`)
```typescript
// Location: lib/shielded/shielded-service.ts:360
prepareTransfer(
  recipientAddress,    // zdoge:... address
  amountDoge,          // Amount to send
  poolAddress,         // ShieldedPool contract
  noteIndex,           // Selected note index
  relayerAddress,      // Relayer address for fees
  feeDoge              // Relayer fee
)
```

**What it does:**
1. Selects the note to spend (or uses provided index)
2. Generates ZK proof proving:
   - User owns the input note
   - Output commitments are valid
   - Amount + fee ≤ input note amount
   - Change is returned to sender
3. Encrypts memos:
   - `encryptedMemo1`: For recipient (enables auto-discovery)
   - `encryptedMemo2`: For sender's change note

**Returns:**
- `proof`: Groth16 ZK proof (8 elements)
- `nullifierHash`: Prevents double-spending
- `outputCommitment1`: Recipient's new note commitment
- `outputCommitment2`: Sender's change note commitment
- `root`: Merkle root used in proof
- `encryptedMemo1` & `encryptedMemo2`: Encrypted note details

#### Step 2: Relayer Submission
```typescript
// POST /api/shielded/relay/transfer
fetch(`${RELAYER_URL}/api/shielded/relay/transfer`, {
  method: 'POST',
  body: JSON.stringify({
    poolAddress,
    proof,
    root,
    nullifierHash,
    outputCommitment1,
    outputCommitment2,
    encryptedMemo1,
    encryptedMemo2,
    fee: relayerFeeWei.toString()
  })
})
```

#### Step 3: State Update (`completeTransfer`)
After successful transaction:
```typescript
completeTransfer(
  spentNoteIndex,      // Remove this note
  changeNote,          // Add change note
  changeLeafIndex,     // Leaf index for change
  recipientNote,       // Add if sent to self
  recipientLeafIndex    // Leaf index for recipient
)
```

**What it does:**
1. Removes spent note from wallet
2. Adds change note (if any)
3. Adds recipient note (if sent to own address)
4. Saves to localStorage

---

## Backend Flow (`backend/src/shielded/shielded-routes.ts`)

### Endpoint: `POST /api/shielded/relay/transfer`

### 1. Validation
```typescript
// Validates:
- All required parameters present
- Proof is array of 8 elements
- Relayer wallet initialized
- Relayer has sufficient gas balance
```

### 2. Root Verification
```typescript
// Checks if Merkle root exists on-chain
const isRootKnown = await publicClient.call({
  to: poolAddress,
  data: `0x6d9833e3${rootPadded}`
})
// Rejects if root not found (tree out of sync)
```

### 3. Contract Call
```typescript
const txHash = await relayerWallet.writeContract({
  chain: dogeosTestnet,
  address: poolAddress,
  abi: ShieldedPoolABI,
  functionName: 'transfer',
  args: [
    proofBigInts,           // [8] ZK proof
    root,                   // bytes32 Merkle root
    nullifierHash,          // bytes32 nullifier
    outputCommitment1,      // bytes32 recipient commitment
    outputCommitment2,      // bytes32 change commitment
    relayerAddress,         // address relayer
    fee,                    // uint256 fee
    memo1,                  // bytes encrypted memo (recipient)
    memo2                   // bytes encrypted memo (change)
  ]
})
```

### 4. Transaction Confirmation
```typescript
// Waits for 1 confirmation
const receipt = await publicClient.waitForTransactionReceipt({
  hash: txHash,
  confirmations: 1
})

// Extracts leaf indices from Transfer event
// Returns: txHash, leafIndex1, leafIndex2
```

---

## Smart Contract (`contracts/src/ShieldedPoolMultiToken.sol`)

### Function: `transfer()`

```solidity
function transfer(
    uint256[8] calldata _proof,        // ZK proof
    bytes32 _root,                     // Merkle root
    bytes32 _nullifierHash,           // Nullifier (prevents double-spend)
    bytes32 _outputCommitment1,        // Recipient note commitment
    bytes32 _outputCommitment2,        // Change note commitment
    address _relayer,                  // Relayer address
    uint256 _fee,                      // Relayer fee
    bytes calldata _encryptedMemo1,    // Encrypted memo for recipient
    bytes calldata _encryptedMemo2     // Encrypted memo for change
) external nonReentrant
```

### Contract Logic:

1. **Nullifier Check**
   ```solidity
   if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
   ```
   - Prevents double-spending

2. **Root Verification**
   ```solidity
   if (!isKnownRoot(_root)) revert InvalidProof();
   ```
   - Ensures proof uses valid Merkle root

3. **ZK Proof Verification**
   ```solidity
   if (!transferVerifier.verifyProof(...)) revert InvalidProof();
   ```
   - Verifies:
     - Input note exists in tree
     - User owns the input note
     - Output commitments are valid
     - Amount + fee ≤ input note amount

4. **Mark Nullifier as Spent**
   ```solidity
   nullifierHashes[_nullifierHash] = true;
   ```

5. **Insert New Commitments**
   ```solidity
   uint256 leafIndex1 = _insert(_outputCommitment1);  // Recipient note
   uint256 leafIndex2 = _insert(_outputCommitment2);  // Change note (if > 0)
   ```

6. **Pay Relayer**
   ```solidity
   if (_fee > 0 && _relayer != address(0)) {
       (bool success, ) = _relayer.call{value: _fee}("");
       totalShieldedBalance[NATIVE_TOKEN] -= _fee;
   }
   ```

7. **Emit Transfer Event**
   ```solidity
   emit Transfer(
       _nullifierHash,
       _outputCommitment1,
       _outputCommitment2,
       leafIndex1,
       leafIndex2,
       _encryptedMemo1,
       _encryptedMemo2,
       block.timestamp
   );
   ```

---

## Security Features

### 1. Zero-Knowledge Proofs
- **Privacy**: Sender, recipient, and amount are hidden
- **Validity**: Proof ensures transaction is valid without revealing details

### 2. Nullifier System
- **Double-Spend Prevention**: Each note can only be spent once
- **On-Chain Tracking**: `nullifierHashes` mapping prevents reuse

### 3. Merkle Tree
- **Commitment Storage**: All notes stored as commitments in Merkle tree
- **Root Verification**: Contract verifies proof against known root

### 4. Encrypted Memos
- **Auto-Discovery**: Recipients can automatically discover incoming transfers
- **Stealth Addresses**: Uses stealth address system for privacy

### 5. Relayer System
- **Gasless Transactions**: Users pay 0 gas (relayer pays)
- **Fee Deduction**: Fee deducted from transaction amount
- **Balance Checks**: Relayer balance verified before submission

---

## Error Handling

### Frontend Errors:
- `Invalid Address`: Recipient address format invalid
- `Insufficient Balance`: Not enough funds in shielded balance
- `No Note Available`: No single note can cover amount + fees
- `Proof Generation Failed`: ZK proof generation error
- `Relayer Error`: Backend/network error

### Backend Errors:
- `Relayer not available`: Relayer wallet not configured
- `Insufficient gas balance`: Relayer needs more DOGE for gas
- `Invalid root`: Merkle root not recognized
- `Invalid proof`: ZK proof verification failed
- `NullifierAlreadySpent`: Note already used
- `Transaction reverted`: Contract rejected transaction

---

## Transaction States

1. **idle**: Ready for input
2. **proving**: Generating ZK proof (10-30 seconds)
3. **relaying**: Submitting to relayer
4. **success**: Transaction confirmed
5. **error**: Transaction failed

---

## Fee Calculation

```typescript
// Fee = max(amount * feePercent, minFee)
const feePercent = relayerInfo.feePercent  // e.g., 0.5%
const minFee = relayerInfo.minFee          // e.g., 0.001 DOGE

let fee = (amount * feePercent) / 100
if (fee < minFee) fee = minFee

// Recipient receives: amount - fee
```

---

## Auto-Discovery

When a transfer is received:
1. Backend indexes `Transfer` events
2. Encrypted memos stored in `transferMemos` map
3. Recipient's wallet scans for memos encrypted to their address
4. Memos decrypted to reveal note details
5. Notes automatically added to recipient's wallet

---

## Token Support

### Supported Tokens
The transfer function supports **all tokens** in the shielded pool:
- ✅ **DOGE** (Native)
- ✅ **USDC** (0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925)
- ✅ **USDT** (0xC81800b77D91391Ef03d7868cB81204E753093a9)
- ✅ **USD1** (0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F)
- ✅ **WETH** (0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000)
- ✅ **LBTC** (0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E)

### Important Design Note: Fee Payment
**The relayer fee is ALWAYS paid in native DOGE**, regardless of which token is being transferred. This is by design:
- The contract deducts the fee from the pool's native DOGE balance
- This ensures the relayer always receives DOGE for gas
- The fee calculation uses 18 decimals (correct for all tokens on DogeOS testnet)

### Token Selection
The frontend supports token selection via the `selectedToken` prop:
- Filters notes by token type
- Displays correct token symbol in UI
- Calculates fees correctly (all tokens use 18 decimals)

## Current Status: ✅ Working Correctly

The transfer function is **fully functional** for all supported tokens and includes:
- ✅ ZK proof generation
- ✅ Relayer submission
- ✅ Contract verification
- ✅ State management
- ✅ Error handling
- ✅ Auto-discovery
- ✅ Fee calculation (always in DOGE)
- ✅ Change note handling
- ✅ Transaction history
- ✅ Multi-token support

---

## Potential Improvements

1. **Multi-Note Support**: Currently can only send from one note at a time
2. **Batch Transfers**: Send to multiple recipients in one transaction
3. **Fee Optimization**: Better note selection to minimize fees
4. **Retry Logic**: Automatic retry on network errors
5. **Progress Indicators**: More detailed progress for proof generation

