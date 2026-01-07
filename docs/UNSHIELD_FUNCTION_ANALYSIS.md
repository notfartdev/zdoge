# Unshield Function Analysis

## Overview
The Unshield function enables users to withdraw shielded tokens (z→t transfers) to a public wallet address, converting private notes back to public tokens. This is the reverse operation of shielding.

## Frontend Flow (`components/shielded/unshield-interface.tsx`)

### 1. User Input
- **Recipient Address**: Public wallet address (0x...)
- **Amount**: Amount to unshield (optional - can use "Max" or consolidate all)
- **Auto Note Selection**: Automatically finds the best note that can cover amount + fees

### 2. Two Modes of Operation

#### Mode A: Single Unshield
- User enters specific amount
- System finds smallest note that covers amount + fees
- Unshields one note to recipient address

#### Mode B: Consolidation
- Unshields ALL notes at once
- Sends everything to connected wallet
- Processes notes sequentially with progress tracking
- Recommended when user has multiple small notes

### 3. Validation
```typescript
// Validates:
- Amount > 0
- Recipient address format (0x...)
- Sufficient balance (total and per-note)
- Relayer availability
- Note not already spent (for consolidation)
```

### 4. Transaction Flow

#### Step 1: Proof Generation (`prepareUnshield`)
```typescript
// Location: lib/shielded/shielded-service.ts:479
prepareUnshield(
  recipientAddress,    // Public wallet address (0x...)
  noteIndex,           // Selected note index
  poolAddress,         // ShieldedPool contract
  relayerAddress,      // Relayer address for fees
  feeDoge              // Relayer fee
)
```

**What it does:**
1. Selects the note to spend (from provided index)
2. Validates note ownership (must match wallet identity)
3. Generates ZK proof proving:
   - User owns the input note
   - Note exists in Merkle tree
   - Withdraw amount + fee = note amount (value conservation)
   - Recipient and relayer are correctly bound
4. Computes nullifier hash (prevents double-spending)

**Returns:**
- `proof`: Groth16 ZK proof (8 elements)
- `nullifierHash`: Prevents double-spending
- `amount`: Amount to withdraw (note amount - fee)
- `root`: Merkle root used in proof

#### Step 2: Relayer Submission
```typescript
// POST /api/shielded/relay/unshield
fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
  method: 'POST',
  body: JSON.stringify({
    poolAddress,
    proof,
    root,
    nullifierHash,
    recipient,
    amount: proofResult.amount.toString(),
    fee: relayerFeeWei.toString()
  })
})
```

#### Step 3: State Update (`completeUnshield`)
After successful transaction:
```typescript
completeUnshield(noteIndex)  // Removes spent note from wallet
```

**What it does:**
1. Removes spent note from wallet state
2. Saves updated notes to localStorage

---

## Backend Flow (`backend/src/shielded/shielded-routes.ts`)

### Endpoint: `POST /api/shielded/relay/unshield`

### 1. Validation
```typescript
// Validates:
- All required parameters present
- Proof is array of 8 elements
- Fee doesn't exceed amount
- Relayer wallet initialized
- Relayer has sufficient gas balance
```

### 2. Fee Calculation
```typescript
// Uses fee from request (must match proof!)
// OR calculates: max(amount * feePercent, minFee)
const fee = requestFee || calculateFee(amount)
const amountAfterFee = amount - fee
```

### 3. Contract Call
```typescript
const txHash = await relayerWallet.writeContract({
  chain: dogeosTestnet,
  address: poolAddress,
  abi: ShieldedPoolABI,
  functionName: 'unshieldNative',  // For DOGE
  // OR 'unshieldToken' for ERC20 tokens
  args: [
    proofBigInts,           // [8] ZK proof
    root,                   // bytes32 Merkle root
    nullifierHash,          // bytes32 nullifier
    recipient,              // address recipient
    amountBigInt,           // uint256 amount (after fee)
    relayerAddress,         // address relayer
    fee                     // uint256 fee
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

// Returns: txHash, amountReceived, fee, recipient
```

---

## Smart Contract (`contracts/src/ShieldedPoolMultiToken.sol`)

### Function: `unshieldNative()` (for DOGE)

```solidity
function unshieldNative(
    uint256[8] calldata _proof,        // ZK proof
    bytes32 _root,                     // Merkle root
    bytes32 _nullifierHash,           // Nullifier (prevents double-spend)
    address payable _recipient,        // Recipient address
    uint256 _amount,                   // Amount to withdraw
    address _relayer,                  // Relayer address
    uint256 _fee                       // Relayer fee
) external nonReentrant
```

### Function: `unshieldToken()` (for ERC20 tokens)

```solidity
function unshieldToken(
    uint256[8] calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address _recipient,
    address _token,                    // ERC20 token address
    uint256 _amount,
    address _relayer,
    uint256 _fee
) external nonReentrant
```

### Internal Function: `_unshield()`

```solidity
function _unshield(
    uint256[8] calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address _recipient,
    address _token,                    // NATIVE_TOKEN or ERC20 address
    uint256 _amount,
    address _relayer,
    uint256 _fee
) internal
```

### Contract Logic:

1. **Input Validation**
   ```solidity
   if (_recipient == address(0)) revert InvalidRecipient();
   if (_amount == 0) revert InvalidAmount();
   ```
   - Ensures valid recipient and amount

2. **Nullifier Check**
   ```solidity
   if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
   ```
   - Prevents double-spending

3. **Root Verification**
   ```solidity
   if (!isKnownRoot(_root)) revert InvalidProof();
   ```
   - Ensures proof uses valid Merkle root

4. **ZK Proof Verification**
   ```solidity
   if (!unshieldVerifier.verifyProof(...)) revert InvalidProof();
   ```
   - Verifies:
     - Input note exists in tree
     - User owns the input note
     - Value conservation: withdraw amount + fee = note amount
     - Recipient and relayer are correctly bound

5. **Mark Nullifier as Spent**
   ```solidity
   nullifierHashes[_nullifierHash] = true;
   ```

6. **Update Pool Balance**
   ```solidity
   totalShieldedBalance[_token] -= (_amount + _fee);
   ```

7. **Transfer Funds**
   ```solidity
   // For native DOGE:
   (bool success, ) = _recipient.call{value: _amount}("");
   if (_fee > 0) _relayer.call{value: _fee}("");
   
   // For ERC20 tokens:
   IERC20(_token).safeTransfer(_recipient, _amount);
   if (_fee > 0) IERC20(_token).safeTransfer(_relayer, _fee);
   ```

8. **Emit Unshield Event**
   ```solidity
   emit Unshield(
       _nullifierHash,
       _recipient,
       _token,
       _amount,
       _relayer,
       _fee,
       block.timestamp
   );
   ```

---

## Consolidation Process

### Overview
Consolidation unshields multiple small notes into a single public balance. This is useful when:
- User has many small notes (dust)
- User wants to withdraw everything at once
- User wants to avoid multiple transactions

### Flow

1. **Filter Worthy Notes**
   ```typescript
   // Only notes larger than minimum fee
   const worthyNotes = notes.filter(n => n.amount > minFee)
   ```

2. **Pre-Check for Spent Notes**
   ```typescript
   // Generate proof to get nullifierHash
   const proofResult = await prepareUnshield(...)
   
   // Check if already spent
   const isSpent = await checkNullifierSpent(proofResult.nullifierHash)
   if (isSpent) {
     // Remove from local state
     completeUnshield(noteIndex)
     continue
   }
   ```

3. **Process Each Note Sequentially**
   ```typescript
   for (let i = 0; i < worthyNotes.length; i++) {
     // Generate proof
     const proofResult = await prepareUnshield(...)
     
     // Submit to relayer
     const response = await fetch('/api/shielded/relay/unshield', ...)
     
     // Update progress: current = i + 1 (after completion)
     setConsolidateProgress({ 
       current: i + 1, 
       total: worthyNotes.length,
       totalReceived 
     })
     
     // Remove note from wallet
     completeUnshield(noteIndex)
   }
   ```

4. **Progress Tracking**
   - Starts at `current: 0`
   - Increments after each successful note: `current: i + 1`
   - Shows: "Processing note X of Y"
   - Displays total received amount

5. **Error Handling**
   - If note already spent: Remove from local state, continue
   - If other error: Show error, continue with next note
   - Show toast notification for skipped notes

---

## Security Features

### 1. Zero-Knowledge Proofs
- **Privacy**: Note details are hidden
- **Validity**: Proof ensures transaction is valid without revealing details
- **Ownership**: Proves user owns the note without revealing secret

### 2. Nullifier System
- **Double-Spend Prevention**: Each note can only be spent once
- **On-Chain Tracking**: `nullifierHashes` mapping prevents reuse
- **Pre-Check**: Frontend checks nullifier status before submitting

### 3. Merkle Tree
- **Commitment Storage**: All notes stored as commitments in Merkle tree
- **Root Verification**: Contract verifies proof against known root
- **Path Validation**: Proof includes Merkle path proving note exists

### 4. Value Conservation
- **Proof Constraint**: ZK proof enforces: `withdrawAmount + fee = noteAmount`
- **Contract Validation**: Contract verifies proof before transferring
- **No Over-Withdrawal**: Cannot withdraw more than note contains

### 5. Relayer System
- **Gasless Transactions**: Users pay 0 gas (relayer pays)
- **Fee Deduction**: Fee deducted from withdrawal amount
- **Balance Checks**: Relayer balance verified before submission

### 6. Note Ownership Verification
- **Identity Check**: Note's `ownerPubkey` must match wallet's `shieldedAddress`
- **Spending Key**: Uses wallet's spending key to compute nullifier
- **Prevents Theft**: Cannot spend notes belonging to other wallets

---

## Error Handling

### Frontend Errors:
- `Invalid Amount`: Amount must be > 0
- `Invalid Address`: Recipient address format invalid
- `Insufficient Balance`: Not enough funds in shielded balance
- `No Note Available`: No single note can cover amount + fees
- `Proof Generation Failed`: ZK proof generation error
- `Note Already Spent`: Note was already withdrawn (consolidation)
- `Relayer Error`: Backend/network error

### Backend Errors:
- `Relayer not available`: Relayer wallet not configured
- `Insufficient gas balance`: Relayer needs more DOGE for gas
- `Invalid root`: Merkle root not recognized
- `Invalid proof`: ZK proof verification failed
- `NullifierAlreadySpent`: Note already used
- `Amount too small`: Withdrawal amount less than minimum
- `Transaction reverted`: Contract rejected transaction

### Consolidation Errors:
- `Note already spent`: Note was already withdrawn (handled gracefully)
- `Relayer failed`: Network/backend error (continues with next note)
- `Proof generation failed`: ZK proof error (stops consolidation)

---

## Fee Calculation

### Formula
```typescript
// Fee = max(amount * feePercent, minFee)
const feePercent = relayerInfo.feePercent  // e.g., 0.5%
const minFee = relayerInfo.minFee          // e.g., 0.001 DOGE

let fee = (amount * feePercent) / 100
if (fee < minFee) fee = minFee

// Recipient receives: amount - fee
const amountReceived = amount - fee
```

### Fee Payment
- **Native DOGE**: Fee paid in DOGE (from pool's native balance)
- **ERC20 Tokens**: Fee paid in same token (e.g., USDC fee for USDC unshield)
- **Relayer Receives**: Fee goes to relayer address
- **User Pays**: Fee deducted from withdrawal amount (user receives less)

---

## Token Support

### Supported Tokens
The unshield function supports **all tokens** in the shielded pool:
- ✅ **DOGE** (Native) - Uses `unshieldNative()`
- ✅ **USDC** - Uses `unshieldToken()`
- ✅ **USDT** - Uses `unshieldToken()`
- ✅ **USD1** - Uses `unshieldToken()`
- ✅ **WETH** - Uses `unshieldToken()`
- ✅ **LBTC** - Uses `unshieldToken()`

### Current Backend Limitation
**The relayer currently only supports DOGE unshields** (`unshieldNative`):
- Backend only implements `/relay/unshield` for native DOGE
- ERC20 token unshields would require `unshieldToken()` implementation
- Fee for ERC20 tokens is paid in the same token (not DOGE)

---

## Transaction States

1. **idle**: Ready for input
2. **proving**: Generating ZK proof (10-30 seconds)
3. **relaying**: Submitting to relayer
4. **consolidating**: Processing multiple notes (consolidation mode)
5. **success**: Transaction confirmed
6. **error**: Transaction failed

---

## Progress Tracking (Consolidation)

### Display Format
```
Processing note X of Y
Total received: Z.XXXX {token}
```

### Progress Updates
- **Initial**: `current: 0, total: Y`
- **After each note**: `current: i + 1, total: Y`
- **Final**: `current: Y, total: Y` (all notes processed)

### Example
- User has 5 notes
- Progress: `0 of 5` → `1 of 5` → `2 of 5` → ... → `5 of 5`
- Shows total received amount accumulating

---

## Value Conservation

### Proof Constraint
The ZK proof enforces:
```
noteAmount = withdrawAmount + fee
```

This ensures:
- Cannot withdraw more than note contains
- Fee is correctly deducted
- No value is lost or created

### Contract Validation
```solidity
// Proof public inputs include:
// [root, nullifierHash, recipient, amount, relayer, fee]
// 
// Circuit verifies:
// - noteAmount = amount + fee
// - note exists in tree
// - user owns note
```

---

## Current Status: ✅ Working Correctly

The unshield function is **fully functional** and includes:
- ✅ ZK proof generation
- ✅ Relayer submission
- ✅ Contract verification
- ✅ State management
- ✅ Error handling
- ✅ Consolidation support
- ✅ Progress tracking
- ✅ Spent note detection
- ✅ Fee calculation
- ✅ Transaction history
- ✅ Multi-token support (DOGE only via relayer currently)

---

## Potential Improvements

1. **ERC20 Token Support**: Implement `unshieldToken()` in relayer
2. **Batch Unshield**: Unshield multiple notes in single transaction
3. **Fee Optimization**: Better note selection to minimize fees
4. **Retry Logic**: Automatic retry on network errors
5. **Progress Persistence**: Save consolidation progress across page refreshes
6. **Partial Consolidation**: Allow user to select which notes to consolidate

---

## Comparison: Transfer vs Unshield

| Feature | Transfer (z→z) | Unshield (z→t) |
|---------|---------------|----------------|
| **Recipient** | Shielded address (zdoge:...) | Public address (0x...) |
| **Output** | Creates new shielded notes | Sends to public wallet |
| **Change** | Returns change as shielded note | No change (full note spent) |
| **Fee Payment** | Always in DOGE (from pool) | In same token (DOGE or ERC20) |
| **Proof Type** | Transfer circuit | Unshield circuit |
| **Contract Function** | `transfer()` | `unshieldNative()` / `unshieldToken()` |
| **Auto-Discovery** | Yes (encrypted memos) | No (public transaction) |
| **Privacy** | Fully private | Amount/recipient visible on-chain |

---

## API Reference

### Frontend Functions

#### `prepareUnshield()`
```typescript
prepareUnshield(
  recipientAddress: string,
  noteIndex: number,
  poolAddress: string,
  relayerAddress?: string,
  feeDoge: number = 0
): Promise<{
  proof: { proof: string[]; publicInputs: string[] };
  nullifierHash: `0x${string}`;
  amount: bigint;
  root: `0x${string}`;
}>
```

#### `completeUnshield()`
```typescript
completeUnshield(noteIndex: number): void
```

### Backend Endpoints

#### `POST /api/shielded/relay/unshield`
```json
Request:
{
  "poolAddress": "0x...",
  "proof": ["...", ...],  // 8 elements
  "root": "0x...",
  "nullifierHash": "0x...",
  "recipient": "0x...",
  "amount": "1000000000000000000",  // in wei
  "fee": "5000000000000000"  // in wei
}

Response:
{
  "success": true,
  "txHash": "0x...",
  "blockNumber": 12345,
  "recipient": "0x...",
  "amountReceived": "995000000000000000",  // amount - fee
  "fee": "5000000000000000",
  "relayer": "0x..."
}
```

### Smart Contract Functions

#### `unshieldNative()`
```solidity
function unshieldNative(
    uint256[8] calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address payable _recipient,
    uint256 _amount,
    address _relayer,
    uint256 _fee
) external nonReentrant
```

#### `unshieldToken()`
```solidity
function unshieldToken(
    uint256[8] calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address _recipient,
    address _token,
    uint256 _amount,
    address _relayer,
    uint256 _fee
) external nonReentrant
```

