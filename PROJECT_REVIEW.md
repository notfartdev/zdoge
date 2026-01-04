# Dogenado Project - Complete Function & Feature Review

**Review Date:** January 2025  
**Commit:** `01401eba` (Dashboard polish)

---

## 🎯 Project Overview

**Dogenado** is a privacy-preserving token mixer and shielded transaction system for the DogeOS blockchain. It implements two complementary privacy systems:

1. **Fixed-Denomination Mixer Pools** (Tornado Cash-style)
2. **Variable-Amount Shielded Transactions** (Zcash-style)

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend (Next.js 16.1.0)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Landing    │  │  Dashboard   │  │  Shielded       │   │
│  │   Page       │  │  (Mixer)     │  │  Wallet         │   │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────┘   │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│         Smart Contracts (Solidity/Hardhat)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ MixerPoolV2  │  │ ShieldedPool │  │  Verifiers      │   │
│  │ (Fixed amt)  │  │ (Variable)   │  │  (Groth16)      │   │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────┘   │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Node.js/Express)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Indexer    │  │   Relayer    │  │  Merkle Tree    │   │
│  │  (Events)    │  │ (Gas Payer)  │  │   Service       │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (with file/memory fallback)              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│            ZK Circuits (Circom/snarkjs)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  withdraw    │  │  shield      │  │  transfer       │   │
│  │  (Mixer)     │  │  (Shielded)  │  │  unshield       │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Features & Functions

### 1. **Fixed-Denomination Mixer Pools** (Tornado Cash-style)

**Purpose:** Break the link between deposits and withdrawals using fixed amounts.

#### **Features:**
- ✅ **Fixed Amounts:** 1, 10, 100, 1000 per token (various denominations)
- ✅ **Multiple Tokens:** DOGE (native), USDC, USDT, USD1, WETH, LBTC
- ✅ **Scheduled Withdrawals:** Optional timelock delays (1 hour - 7 days)
- ✅ **Gasless Withdrawals:** Optional relayer for users without gas

#### **User Flow:**
1. **Deposit:**
   - Select token and fixed amount
   - Generate secret note (commitment)
   - Approve & deposit tokens
   - Save note securely (⚠️ CRITICAL)

2. **Withdraw:**
   - Enter saved note
   - Generate ZK proof (client-side)
   - Submit directly or via relayer
   - Receive tokens to any address

#### **Smart Contracts:**
- `MixerPoolV2.sol` - Main mixer contract (per pool)
- `MixerPoolNative.sol` - Native DOGE pools
- `Hasher.sol` - MiMC hash function
- `Verifier.sol` - Groth16 proof verifier
- `DogeRouter.sol` - Native DOGE wrapper

**Deployment Status:** ✅ Deployed to DogeOS Testnet

---

### 2. **Variable-Amount Shielded Transactions** (Zcash-style)

**Purpose:** Full private payment system with variable amounts and private transfers.

#### **Features:**
- ✅ **Variable Amounts:** Send any amount (no fixed denominations)
- ✅ **Private Transfers:** z→z (shielded to shielded) transactions
- ✅ **Shielded Addresses:** `dogenado:z1abc123...` format
- ✅ **Multiple Operations:** Shield, Transfer, Unshield, Swap

#### **User Flow:**

1. **Shield (Deposit):**
   ```
   Public DOGE → Shielded Note
   ```
   - Initialize shielded wallet (generates spending key)
   - Deposit any amount to shielded note
   - Note stored in Merkle tree

2. **Transfer (Private Send):**
   ```
   Your Shielded Note → Friend's Shielded Address
   ```
   - Enter recipient's shielded address
   - Generate ZK proof (hides sender, recipient, amount)
   - Send transaction
   - Share note with recipient (off-chain)

3. **Unshield (Withdraw):**
   ```
   Shielded Note → Public Address
   ```
   - Import received note
   - Generate ZK proof
   - Withdraw to any public address

4. **Swap:**
   ```
   Shielded DOGE → Shielded USDC
   ```
   - Swap between shielded tokens privately

#### **Smart Contracts:**
- `ShieldedPool.sol` - Main shielded pool contract
- Separate verifiers for each operation:
  - `ShieldVerifier.sol`
  - `TransferVerifier.sol`
  - `UnshieldVerifier.sol`
  - `SwapVerifier.sol`

**Deployment Status:** ✅ Deployed to DogeOS Testnet

---

## 🎨 Frontend Features

### **Landing Page** (`app/page.tsx`)
- Hero section with zDOGE branding
- "How It Works" explanation
- Shielded pool visualization
- Privacy features showcase
- Trust indicators (non-custodial, no tracking)

### **Dashboard** (`app/dashboard/page.tsx`)
- Mixer interface with tabs (Deposit/Withdraw)
- Statistics sidebar
- Pool selection
- Token selection

### **Main Pages:**

#### **1. Shield** (`app/shield/page.tsx`)
- Shielded wallet interface
- Shield tokens (variable amounts)
- Balance display
- Shielded address management

#### **2. Send** (`app/send/page.tsx`)
- Transfer interface for shielded transactions
- Send to shielded addresses
- Amount selection

#### **3. Swap** (`app/swap/page.tsx`)
- Token swap interface
- Shielded token swaps

#### **4. Unshield** (`app/unshield/page.tsx`)
- Withdraw shielded tokens
- Convert to public

### **Additional Features:**
- **Account Settings** (`app/dashboard/account`)
  - Wallet management
  - Note account settings
  
- **Inbox** (`app/dashboard/inbox`)
  - View received notes/payments
  
- **Payment Requests** (`app/payment-request`)
  - Request payments
  
- **Check Note Status** (`app/dashboard/check`)
  - Verify note status

---

## 🔧 Core Library Functions

### **Mixer System** (`lib/`)

#### `contract-service.ts`
- Contract interaction utilities
- Pool info fetching
- Transaction helpers

#### `proof-service.ts`
- ZK proof generation (withdraw.circom)
- Merkle path fetching
- Proof verification

#### `note-service.ts`
- Note generation (secret + nullifier)
- Note parsing/validation
- Note serialization

#### `mixer-service.ts`
- Pool statistics
- Merkle path utilities
- Pool state management

### **Shielded System** (`lib/shielded/`)

#### `shielded-service.ts`
- High-level API for shield/transfer/unshield
- Wallet state management
- Note management
- Identity management (per-wallet)

#### `shielded-address.ts`
- Shielded address generation
- Spending key management
- Address parsing

#### `shielded-note.ts`
- Note structure & serialization
- Commitment calculation
- Note sharing format

#### `shielded-proof-service.ts`
- ZK proof generation for:
  - Shield operations
  - Transfer operations
  - Unshield operations

#### `shielded-crypto.ts`
- MiMC hashing
- Field operations
- Cryptographic primitives

#### `shielded-receiving.ts`
- Encrypted memo handling
- Note decryption
- Memo formatting

#### `stealth-address.ts`
- Stealth address generation
- Meta address encoding
- Transfer scanning

---

## 🌐 Backend Services

### **Indexer** (`backend/src/indexer/`)
**Purpose:** Track blockchain events and maintain Merkle tree state

**Functions:**
- ✅ Listen to Deposit/Withdrawal events
- ✅ Build Merkle tree from events
- ✅ Track nullifiers (prevent double-spend)
- ✅ Sync historical events
- ✅ Provide Merkle paths for proof generation

**API Endpoints:**
- `GET /api/pools` - List all pools
- `GET /api/pool/:address` - Pool information
- `GET /api/pool/:address/root` - Latest Merkle root
- `GET /api/pool/:address/path/:leafIndex` - Merkle path
- `GET /api/pool/:address/deposit/:commitment` - Deposit info
- `GET /api/pool/:address/nullifier/:hash` - Check if nullifier spent
- `GET /api/wallet/:address/deposits` - Wallet deposits
- `GET /api/wallet/:address/withdrawals` - Wallet withdrawals
- `GET /api/wallet/:address/scheduled` - Scheduled withdrawals
- `GET /api/wallet/:address/inbox-summary` - Inbox summary

### **Relayer** (`backend/src/relayer/`)
**Purpose:** Submit transactions on behalf of users (gasless withdrawals)

**Functions:**
- ✅ Submit withdrawal transactions
- ✅ Pay gas fees
- ✅ Rate limiting
- ✅ Balance monitoring
- ✅ Scheduled withdrawal execution

**API Endpoints:**
- `POST /api/relay` - Submit withdrawal via relayer
- `POST /api/relay/schedule` - Schedule withdrawal
- `POST /api/relay/execute` - Execute scheduled withdrawal

### **Storage:**
- **Primary:** PostgreSQL (production)
- **Fallback 1:** File-based persistence
- **Fallback 2:** In-memory (development)

**Database Tables:**
- `deposits` - Deposit records
- `withdrawals` - Withdrawal records
- `scheduled_withdrawals` - Scheduled withdrawals
- `wallet_deposits` - Wallet to deposit mapping
- `sync_state` - Block sync state
- `nullifiers` - Spent nullifiers

---

## 🔐 Supported Tokens & Pools

### **Mixer Pools:**

| Token | Denominations | Contract Type |
|-------|--------------|---------------|
| **DOGE** | 1, 10, 100, 1000 | Native (MixerPoolNative) |
| **USDC** | 1, 10, 100, 1000 | ERC20 (MixerPoolV2) |
| **USDT** | 1, 10, 100, 1000 | ERC20 (MixerPoolV2) |
| **USD1** | 1, 10, 100, 1000 | ERC20 (MixerPoolV2) |
| **WETH** | 0.01, 0.1, 1, 10 | ERC20 (MixerPoolV2) |
| **LBTC** | 0.001, 0.01, 0.1, 1 | ERC20 (MixerPoolV2) |

### **Shielded Pool:**
- **All tokens supported:** DOGE, USDC, USDT, USD1, WETH, LBTC
- **Variable amounts:** Any amount can be shielded/transferred/unshielded

---

## 📊 Key Statistics & Features

### **Mixer Statistics:**
- Total deposits per pool
- Anonymity set size
- Latest Merkle root
- Recent activity

### **Shielded Wallet:**
- Total shielded balance (per token)
- Number of notes
- Shielded address
- Transaction history

---

## 🔒 Security Features

### **ZK Proof System:**
- ✅ Groth16 zero-knowledge proofs
- ✅ Merkle tree membership proofs
- ✅ Nullifier prevention (double-spend protection)
- ✅ Client-side proof generation

### **Privacy Features:**
- ✅ Unlinkability (deposit ≠ withdrawal)
- ✅ Private transfers (z→z)
- ✅ Shielded addresses
- ✅ Encrypted memos

### **Trust Assumptions:**
- ⚠️ Smart contracts audited
- ⚠️ Circuits correctly implemented
- ⚠️ Trusted setup ceremony (uses pre-generated Powers of Tau)
- ⚠️ Users must secure their notes/keys

---

## 🚀 Deployment Status

### **Smart Contracts:**
- ✅ **Hasher:** `0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D`
- ✅ **Verifier (Mixer):** `0xE8Ef2495F741467D746E27548BF71948A0554Ad6`
- ✅ **DogeRouter:** `0x0A26D94E458EA685dAb82445914519DE6D26EB57`
- ✅ **ShieldedPool:** `0xc5F64faee07A6EFE235C12378101D62e370c0cD5`
- ✅ **Mixer Pools:** All denominations deployed

### **Backend:**
- ✅ Deployed to Render: `https://dogenadocash.onrender.com`
- ✅ API endpoints functional
- ⚠️ Database configuration (check logs for storage type)

### **Frontend:**
- ✅ Running at: `http://localhost:3000` (local)
- ✅ Production: `https://dogenado.cash` (if deployed)

---

## ⚠️ Known Limitations & Issues

### **Critical:**
1. **Database Persistence**
   - Defaults to in-memory if PostgreSQL not configured
   - **Impact:** Data lost on restart
   - **Fix:** Configure PostgreSQL for production

2. **Relayer Balance**
   - No automatic refill
   - **Impact:** Gasless withdrawals fail if relayer runs out
   - **Fix:** Monitor and fund manually

### **Medium Priority:**
3. **Rate Limiting**
   - In-memory only (not distributed)
   - **Impact:** Multiple instances have separate limits
   - **Fix:** Use Redis for distributed rate limiting

4. **Circuit Trusted Setup**
   - Uses pre-generated Powers of Tau
   - **Impact:** Less secure than custom ceremony
   - **Fix:** Custom trusted setup for mainnet

5. **Frontend API Routes**
   - Some routes may be unused/duplicate
   - **Action:** Review and clean up

---

## 📝 User Flows

### **Mixer Flow:**
```
1. Connect Wallet
2. Go to Dashboard (/dashboard)
3. Select "Deposit" tab
4. Choose token & amount
5. Approve & Deposit
6. ⚠️ SAVE NOTE (critical!)
7. Later: Go to "Withdraw" tab
8. Enter saved note
9. Enter recipient address
10. Generate proof & withdraw
```

### **Shielded Flow:**
```
1. Go to Shield page (/shield)
2. Initialize shielded wallet
3. Copy your shielded address (zdoge:...)
4. Shield tokens (any amount)
5. Share shielded address with friend
6. Go to Send page (/send)
7. Enter friend's shielded address
8. Enter amount & send
9. Share note with friend (off-chain)
10. Friend imports note & unshields
```

---

## 🛠️ Development Status

### **Fully Implemented ✅:**
- Smart contracts (both systems)
- Backend indexer & relayer
- Frontend interfaces (both systems)
- ZK proof generation (client-side)
- Note management
- Wallet integration

### **Needs Attention ⚠️:**
- Database persistence verification
- End-to-end testing
- Production configuration
- Security audit
- Documentation

### **Missing/Incomplete ❌:**
- Comprehensive testing suite
- Production monitoring
- Automated deployments
- Custom trusted setup ceremony

---

## 📚 Key Documentation Files

- `README.md` - Main project overview
- `PROJECT_OVERVIEW.md` - Detailed architecture
- `PROJECT_STATUS.md` - Current status
- `SHIELDED_SYSTEM_SUMMARY.md` - Shielded system details
- `SHIELDED_DEPLOYMENT_GUIDE.md` - Deployment instructions
- `DATABASE_SETUP.md` - Database configuration

---

## 🎯 Next Steps Recommendations

1. **Immediate:**
   - Verify database is configured in production
   - Test one deposit & withdrawal end-to-end
   - Check backend API health

2. **This Week:**
   - Complete end-to-end testing
   - Set up relayer balance monitoring
   - Verify all features work correctly

3. **Before Mainnet:**
   - Security audit
   - Custom trusted setup
   - Comprehensive testing
   - Production monitoring

---

**End of Review**

