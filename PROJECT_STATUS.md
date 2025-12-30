# Dogenado - Complete Project Overview & Status

## 🎯 What is Dogenado?

**Dogenado** is a privacy-preserving token mixer (privacy pool) for the DogeOS blockchain. It allows users to deposit tokens and withdraw them to different addresses without revealing the link between deposits and withdrawals on-chain. This is achieved using zero-knowledge proofs (Groth16) and Merkle tree commitments.

### Core Concept
- Users deposit fixed-denomination amounts (e.g., 1, 10, 100, 1000 USDC) into pools
- Each deposit creates a secret "note" that must be saved by the user
- To withdraw, users prove they know a valid note using a zero-knowledge proof
- The proof doesn't reveal which deposit is being withdrawn, breaking the on-chain link
- Multiple pools per token allow users to choose their deposit amount

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend (Next.js 16)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Deposit    │  │  Withdraw    │  │  Dashboard      │  │
│  │  Interface   │  │  Interface   │  │  (Account/Inbox) │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────┘  │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│         Smart Contracts (Solidity/Hardhat)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ MixerPoolV2  │  │   Hasher     │  │   Verifier       │   │
│  │ (per pool)   │  │  (MiMC)      │  │  (Groth16)       │   │
│  └──────┬───────┘  └──────────────┘  └─────────────────┘   │
└─────────┼────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Node.js/Express)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Indexer    │  │   Relayer    │  │  Merkle Tree    │   │
│  │  (Events)    │  │ (Gas Payer)  │  │   Service       │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (Optional - with file/memory fallback)    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│            ZK Circuits (Circom/snarkjs)                       │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  withdraw.circom                                     │   │
│  │  - Merkle membership proof                          │   │
│  │  - Nullifier derivation                             │   │
│  │  - Public input binding                             │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### 1. **Frontend (Next.js 16.1.0)**

**Location:** `/app`, `/components`, `/lib`

**Key Features:**
- ✅ Deposit interface (token selection, amount, note generation)
- ✅ Withdraw interface (note parsing, proof generation, submission)
- ✅ Dashboard with wallet connection
- ✅ Note management and storage
- ✅ Account/inbox system
- ✅ Payment request system (UI exists, integration unclear)
- ✅ Statistics display
- ✅ Multi-token support (DOGE, USDC, USDT, USD1, WETH, LBTC)

**Key Files:**
- `lib/contract-service.ts` - Smart contract interactions
- `lib/proof-service.ts` - ZK proof generation (client-side)
- `lib/note-service.ts` - Note generation/parsing
- `lib/dogeos-config.ts` - Chain configuration and pool addresses
- `components/deposit-interface.tsx` - Deposit UI
- `components/withdraw-interface.tsx` - Withdraw UI
- `components/mixer-interface.tsx` - Main mixer interface

**API Routes (Frontend):**
- `/api/pools/[amount]` - Pool information
- `/api/deposits` - Deposit operations
- `/api/withdrawals` - Withdrawal operations
- `/api/payment-request` - Payment request system
- `/api/settings/rpc` - RPC settings

**Status:** ✅ Mostly functional, some features need verification

---

### 2. **Smart Contracts (Solidity/Hardhat)**

**Location:** `/contracts`

**Contracts:**
- ✅ **MixerPoolV2.sol** - Main pool contract (per token/denomination)
  - Deposit functionality
  - Withdrawal with ZK proof verification
  - Scheduled withdrawals (timelock)
  - Merkle tree management
- ✅ **MixerPoolNative.sol** - Native DOGE pools (accepts native DOGE directly)
- ✅ **Hasher.sol** - MiMC Sponge hash implementation
- ✅ **MerkleTreeWithHistory.sol** - Merkle tree with historical root tracking
- ✅ **Verifier.sol** - Groth16 proof verifier (generated from circuit)

**Deployment Status:**
- ✅ Deployed to DogeOS Testnet (Chikyū)
- ✅ Hasher: `0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D`
- ✅ Verifier: `0xE8Ef2495F741467D746E27548BF71948A0554Ad6`
- ✅ Multiple pools per token deployed:
  - USDC: 1, 10, 100, 1000
  - USDT: 1, 10, 100, 1000
  - USD1: 1, 10, 100, 1000
  - DOGE (native): 1, 10, 100, 1000
  - WETH: 0.01, 0.1, 1, 10
  - LBTC: 0.001, 0.01, 0.1, 1

**Status:** ✅ Fully deployed and functional

---

### 3. **Backend Services (Node.js/Express)**

**Location:** `/backend`

**Components:**

#### a) **Indexer** (`src/indexer/` & `src/index.ts`)
- ✅ Watches blockchain events (Deposit, Withdrawal)
- ✅ Maintains Merkle tree state (PostgreSQL/file/memory)
- ✅ Syncs historical events from contracts
- ✅ Provides API for:
  - Merkle paths
  - Pool state
  - Deposit/withdrawal history
  - Wallet-specific deposits

#### b) **Relayer** (`src/relayer/` & `src/index.ts`)
- ✅ Submits withdrawal transactions on behalf of users
- ✅ Pays gas fees (users can withdraw without DOGE)
- ✅ Rate limiting
- ✅ Balance monitoring
- ✅ Scheduled withdrawal execution

#### c) **API Endpoints:**
- ✅ `GET /api/health` - Health check
- ✅ `GET /api/pools` - List all pools
- ✅ `GET /api/pool/:address` - Pool info
- ✅ `GET /api/pool/:address/root` - Latest Merkle root
- ✅ `GET /api/pool/:address/path/:leafIndex` - Merkle path
- ✅ `GET /api/pool/:address/deposit/:commitment` - Deposit info
- ✅ `GET /api/pool/:address/nullifier/:hash` - Check nullifier
- ✅ `POST /api/relay` - Submit withdrawal via relayer
- ✅ `POST /api/relay/schedule` - Schedule withdrawal
- ✅ `POST /api/relay/execute` - Execute scheduled withdrawal
- ✅ `GET /api/wallet/:address/deposits` - Wallet deposits
- ✅ `GET /api/wallet/:address/withdrawals` - Wallet withdrawals
- ✅ `GET /api/wallet/:address/scheduled` - Scheduled withdrawals
- ✅ `GET /api/wallet/:address/inbox-summary` - Inbox summary

**Storage:**
- ✅ PostgreSQL (primary) - via `src/database/`
- ✅ File-based fallback - via `src/utils/persistence.js`
- ✅ In-memory fallback (development)

**Status:** ✅ Implemented with fallback mechanisms

---

### 4. **ZK Circuits (Circom/snarkjs)**

**Location:** `/circuits`

**Circuit:**
- ✅ `withdraw.circom` - Main withdrawal circuit
  - Proves knowledge of secret/nullifier
  - Verifies Merkle membership
  - Prevents double-spending (nullifier check)

**Artifacts:**
- ✅ Built circuit files in `/circuits/build/`
- ✅ `withdraw_final.zkey` - Proving key
- ✅ `withdraw.wasm` - WASM prover
- ✅ `verification_key.json` - Verification key
- ✅ Circuit files in `/public/circuits/` for browser access

**Status:** ✅ Compiled, needs trusted setup verification

---

## 🌐 Network Configuration

### DogeOS Testnet (Chikyū)
- **Chain ID:** 6281971
- **RPC URL:** `https://rpc.testnet.dogeos.com`
- **WebSocket:** `wss://ws.rpc.testnet.dogeos.com`
- **Block Explorer:** `https://blockscout.testnet.dogeos.com`
- **Faucet:** `https://faucet.testnet.dogeos.com`

### Supported Tokens
- **Native DOGE:** 1, 10, 100, 1000 DOGE (uses MixerPoolNative)
- **USDC:** 1, 10, 100, 1000 USDC (18 decimals on DogeOS)
- **USDT:** 1, 10, 100, 1000 USDT (18 decimals on DogeOS)
- **USD1:** 1, 10, 100, 1000 USD1
- **WETH:** 0.01, 0.1, 1, 10 WETH
- **LBTC:** 0.001, 0.01, 0.1, 1 LBTC

---

## ✅ What's Working

### Fully Functional ✅

1. **Smart Contracts**
   - ✅ All contracts deployed to testnet
   - ✅ Deposit functionality working
   - ✅ Withdrawal with ZK proof verification
   - ✅ Scheduled withdrawals (timelock)
   - ✅ Multiple pools per token

2. **Backend Services**
   - ✅ Event indexer (listens to Deposit/Withdrawal events)
   - ✅ Merkle tree management
   - ✅ Relayer service (gasless withdrawals)
   - ✅ REST API endpoints
   - ✅ Rate limiting
   - ✅ Health monitoring
   - ✅ RPC fallback mechanism
   - ✅ Database integration (PostgreSQL with fallbacks)

3. **Frontend**
   - ✅ Deposit interface
   - ✅ Withdraw interface
   - ✅ Wallet connection (MetaMask/DogeOS)
   - ✅ Note generation/parsing
   - ✅ ZK proof generation (client-side)
   - ✅ Dashboard UI
   - ✅ Pool selection
   - ✅ Statistics display

4. **ZK Circuits**
   - ✅ Circuit compiled
   - ✅ Proving key generated
   - ✅ Verification key generated
   - ✅ Solidity verifier generated

---

## ⚠️ Known Issues & Limitations

### Critical Issues 🔴

1. **Database Persistence**
   - **Issue:** Backend defaults to in-memory storage if PostgreSQL isn't configured
   - **Impact:** Merkle tree state lost on restart, wallet deposits lost
   - **Mitigation:** PostgreSQL recommended for production
   - **Status:** ⚠️ Works but data loss on restart without DB
   - **Action Required:** Configure PostgreSQL on production backend

2. **Relayer Balance Management**
   - **Issue:** No automatic refill mechanism
   - **Impact:** Relayer can run out of funds, withdrawals fail
   - **Status:** ⚠️ Manual monitoring required
   - **Action Required:** Monitor relayer balance, fund when low

### Medium Priority Issues 🟡

3. **Rate Limiting**
   - **Issue:** In-memory rate limiting (not distributed)
   - **Impact:** Multiple backend instances will have separate rate limits
   - **Mitigation:** Use Redis for distributed rate limiting in production
   - **Status:** ⚠️ Works for single instance

4. **Frontend API Routes**
   - **Issue:** Frontend has API routes (`/app/api/*`) but unclear if used
   - **Impact:** Potential duplication with backend API
   - **Status:** 🔍 Needs investigation

5. **Wallet Deposit Tracking**
   - **Issue:** Relies on transaction `from` address (can be wrong if using relayer for deposits)
   - **Impact:** Wallet deposit tracking may be inaccurate
   - **Status:** ⚠️ Works for direct deposits only

6. **Circuit Trusted Setup**
   - **Issue:** Uses pre-generated Powers of Tau (not custom ceremony)
   - **Impact:** Less secure than custom trusted setup ceremony
   - **Status:** ⚠️ Functional but not production-grade security
   - **Action Required:** Consider custom trusted setup ceremony for mainnet

### Low Priority Issues 🟢

7. **Payment Request System**
   - **Issue:** UI exists but integration unclear
   - **Status:** 🔍 Needs clarification

8. **Account/Inbox System**
   - **Issue:** UI exists, backend has inbox-summary endpoint
   - **Status:** ⚠️ Needs full integration verification

9. **Settings/RPC Configuration**
   - **Issue:** Exists but may not be fully integrated
   - **Status:** ⚠️ Needs testing

---

## 🔄 What Needs to Work Out

### High Priority (Do First) 🔴

1. **Verify Backend API is Working**
   - Test production site: `https://dogenado.cash/dashboard`
   - Check if API calls go to backend: `https://dogenadocash.onrender.com`
   - Verify statistics show real data (not "Backend unavailable")
   - Check backend health: `https://dogenadocash.onrender.com/api/health`

2. **Database Configuration (Critical for Production)**
   - Check backend logs for storage type:
     - ✅ `[Storage] Using PostgreSQL database` - Good!
     - ⚠️ `[Storage] Using file-based persistence` - Works but not ideal
     - 🔴 `[Storage] Using in-memory storage` - **BAD for production**
   - Configure PostgreSQL on Render with:
     ```
     DB_HOST=your-postgres-host
     DB_PORT=5432
     DB_NAME=dogenado
     DB_USER=dogenado
     DB_PASSWORD=your-password
     ```
   - Run database initialization: `npm run db:init`

3. **Test End-to-End Flows**
   - **Deposit Flow:**
     1. Connect wallet
     2. Select token and amount
     3. Make a deposit
     4. Verify note is generated
     5. Check if deposit appears in statistics
     6. Verify deposit shows in "Inbox" page
   - **Withdraw Flow:**
     1. Use a saved note
     2. Enter recipient address
     3. Generate proof (check console for errors)
     4. Submit withdrawal (direct or via relayer)
     5. Verify withdrawal succeeds

4. **Monitor Relayer Balance**
   - Check backend logs for: `[Relayer] WARNING: Relayer has no balance for gas`
   - Monitor relayer address balance on explorer
   - Set up alerts if balance gets low

### Medium Priority (Do Soon) 🟡

5. **Production Hardening**
   - Verify CORS allows requests from `https://dogenado.cash`
   - Review rate limiting configuration
   - Set up monitoring/alerting
   - Test RPC fallback mechanisms

6. **Security Improvements**
   - Custom trusted setup ceremony for circuits
   - Circuit file verification (SRI hashes)
   - Input validation improvements
   - Rate limiting with Redis (if scaling)

7. **Frontend-Backend Integration**
   - Verify all API endpoints are used correctly
   - Test end-to-end flows
   - Improve error handling
   - Add loading states

### Low Priority (Plan For) 🟢

8. **Documentation**
   - API documentation
   - Deployment guide
   - Troubleshooting guide
   - Security best practices

9. **Testing**
   - Unit tests for critical components
   - Integration tests
   - E2E tests for deposit/withdraw flows

10. **Performance**
    - Merkle tree caching
    - API response caching
    - WebSocket for real-time updates

---

## 🚨 Red Flags to Watch For

**If you see these, act immediately:**

1. **"Using in-memory storage"** in backend logs
   - → Configure database NOW

2. **"Relayer has no balance for gas"**
   - → Fund the relayer wallet

3. **Circuit file loading errors** in browser console
   - → Verify files in `/public/circuits/`

4. **Statistics showing "Backend unavailable"**
   - → Check backend is running
   - → Verify `NEXT_PUBLIC_INDEXER_URL` is set correctly

5. **Merkle tree state inconsistent**
   - → Database may not be syncing correctly
   - → Check database connection

---

## 📋 Quick Reference

### URLs
- **Backend:** `https://dogenadocash.onrender.com`
- **Frontend:** `https://dogenado.cash`
- **Docs:** `https://docs.dogenado.cash`

### Environment Variables (Frontend - Vercel)
- `NEXT_PUBLIC_INDEXER_URL=https://dogenadocash.onrender.com` ✅
- `NEXT_PUBLIC_RELAYER_URL=https://dogenadocash.onrender.com` ✅

### Environment Variables (Backend - Render)
- `DOGEOS_RPC_URL` (optional, has default)
- `RELAYER_PRIVATE_KEY` (required for relayer)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (recommended for production)

### Key Contract Addresses
- **Hasher:** `0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D`
- **Verifier:** `0xE8Ef2495F741467D746E27548BF71948A0554Ad6`
- **DogeRouter:** `0x0A26D94E458EA685dAb82445914519DE6D26EB57`

---

## 📊 Summary

### What Works ✅
- Smart contracts deployed and functional
- Backend indexer and relayer operational
- Frontend deposit/withdraw interfaces
- ZK proof generation (client-side)
- Basic API endpoints
- Database integration (with fallbacks)

### What Needs Attention ⚠️
- Database persistence (ensure it's used in production)
- Production configuration
- Security improvements (trusted setup)
- Relayer balance management
- Frontend API route cleanup
- End-to-end testing

### What's Missing ❌
- Comprehensive testing
- Production monitoring
- Complete documentation
- Automated deployments
- Custom trusted setup ceremony

---

## 🎯 Recommended Next Steps

1. **Immediate (Today)**
   - Test backend API health endpoint
   - Verify database is configured on production
   - Test one deposit and one withdrawal end-to-end

2. **This Week**
   - Complete end-to-end testing of all flows
   - Set up monitoring for relayer balance
   - Verify all frontend features work with backend

3. **Before Mainnet**
   - Full security audit
   - Custom trusted setup ceremony
   - Comprehensive testing
   - Database backups configured
   - Monitoring/alerting set up
   - Complete documentation

---

*Last Updated: Based on comprehensive codebase review*
*Project: Dogenado - Privacy Pool for DogeOS*


