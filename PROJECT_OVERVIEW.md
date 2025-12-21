# Dogenado Project - Complete Overview

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Component Breakdown](#component-breakdown)
3. [Backend Requirements](#backend-requirements)
4. [Current Implementation Status](#current-implementation-status)
5. [Known Issues & Limitations](#known-issues--limitations)
6. [Required Updates](#required-updates)
7. [Mocked/Placeholder Items](#mockedplaceholder-items)

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Deposit    │  │  Withdraw    │  │  Note Mgmt      │   │
│  │  Interface   │  │  Interface   │  │  (Parse/Save)   │   │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────┘   │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Smart Contracts (Solidity)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ MixerPoolV2  │  │   Hasher     │  │   Verifier      │   │
│  │ (per token)  │  │  (MiMC)      │  │  (Groth16)      │   │
│  └──────┬───────┘  └──────────────┘  └─────────────────┘   │
└─────────┼────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Services (Node.js)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Indexer    │  │   Relayer    │  │  Merkle Tree    │   │
│  │  (Events)    │  │ (Gas Payer)  │  │   Service       │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         PostgreSQL (Optional - with fallback)         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                 ZK Circuits (Circom/snarkjs)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  withdraw.circom                                      │  │
│  │  - Merkle membership proof                           │  │
│  │  - Nullifier derivation                              │  │
│  │  - Public input binding                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Component Breakdown

### 1. **Frontend (Next.js 16.1.0)**

**Location:** `/app`, `/components`, `/lib`

**Key Features:**
- Deposit interface (token selection, amount, note generation)
- Withdraw interface (note parsing, proof generation, submission)
- Dashboard with wallet connection
- Note management and storage
- Account/inbox system
- Payment request system

**Key Files:**
- `lib/contract-service.ts` - Smart contract interactions
- `lib/proof-service.ts` - ZK proof generation (client-side)
- `lib/note-service.ts` - Note generation/parsing
- `lib/dogeos-config.ts` - Chain configuration and pool addresses
- `components/deposit-interface.tsx` - Deposit UI
- `components/withdraw-interface.tsx` - Withdraw UI
- `components/mixer-interface.tsx` - Main mixer interface

**API Routes:**
- `/api/pools/[amount]` - Pool information
- `/api/deposits` - Deposit operations
- `/api/withdrawals` - Withdrawal operations
- `/api/payment-request` - Payment request system
- `/api/settings/rpc` - RPC settings

**Dependencies:**
- `snarkjs` - ZK proof generation
- `viem` - Ethereum interaction
- `circomlibjs` - Cryptographic primitives
- React 19, Next.js 16

---

### 2. **Smart Contracts (Solidity/Hardhat)**

**Location:** `/contracts`

**Contracts:**
- **MixerPoolV2.sol** - Main pool contract (per token/denomination)
  - Deposit functionality
  - Withdrawal with ZK proof verification
  - Scheduled withdrawals (timelock)
  - Merkle tree management
- **Hasher.sol** - MiMC Sponge hash implementation
- **MerkleTreeWithHistory.sol** - Merkle tree with history
- **Verifier.sol** - Groth16 proof verifier (generated from circuit)
- **MixerPool.sol** - Legacy V1 contract

**Deployment:**
- Deployed to DogeOS Testnet
- Multiple pools per token (different denominations)
- Hasher: `0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D`
- Verifier: `0xE8Ef2495F741467D746E27548BF71948A0554Ad6`
- Pools for: USDC (1, 10, 100, 1000), USDT (1, 10, 100, 1000), USD1, WDOGE, WETH, LBTC

**Status:** ✅ Deployed and functional

---

### 3. **Backend Services (Node.js/Express)**

**Location:** `/backend`

**Components:**

#### a) **Indexer** (`src/indexer/` & `src/index.ts`)
- Watches blockchain events (Deposit, Withdrawal)
- Maintains Merkle tree state in memory/PostgreSQL
- Syncs from contract events
- Provides API for:
  - Merkle paths
  - Pool state
  - Deposit/withdrawal history
  - Wallet-specific deposits

#### b) **Relayer** (`src/relayer/` & `src/index.ts`)
- Submits withdrawal transactions on behalf of users
- Pays gas fees (users can withdraw without DOGE)
- Rate limiting and balance monitoring
- Scheduled withdrawal execution

#### c) **API Endpoints:**
- `GET /api/health` - Health check
- `GET /api/pools` - List all pools
- `GET /api/pool/:address` - Pool info
- `GET /api/pool/:address/root` - Latest Merkle root
- `GET /api/pool/:address/path/:leafIndex` - Merkle path
- `GET /api/pool/:address/deposit/:commitment` - Deposit info
- `GET /api/pool/:address/nullifier/:hash` - Check nullifier
- `POST /api/relay` - Submit withdrawal via relayer
- `POST /api/relay/schedule` - Schedule withdrawal
- `POST /api/relay/execute` - Execute scheduled withdrawal
- `GET /api/wallet/:address/deposits` - Wallet deposits
- `GET /api/wallet/:address/withdrawals` - Wallet withdrawals
- `GET /api/wallet/:address/scheduled` - Scheduled withdrawals
- `GET /api/wallet/:address/inbox-summary` - Inbox summary

**Storage:**
- PostgreSQL (primary) - via `src/database/`
- File-based fallback - via `src/utils/persistence.js`
- In-memory fallback (development)

**Status:** ✅ Implemented with fallback mechanisms

---

### 4. **ZK Circuits (Circom/snarkjs)**

**Location:** `/circuits`

**Circuit:**
- `withdraw.circom` - Main withdrawal circuit
  - Proves knowledge of secret/nullifier
  - Verifies Merkle membership
  - Prevents double-spending (nullifier check)

**Artifacts:**
- Built circuit files in `/circuits/build/`
- `withdraw_final.zkey` - Proving key
- `withdraw.wasm` - WASM prover
- `verification_key.json` - Verification key

**Status:** ✅ Compiled, needs trusted setup verification

---

## 📦 Backend Requirements

### Required Environment Variables

```bash
# RPC Configuration
DOGEOS_RPC_URL=https://rpc.testnet.dogeos.com
DOGEOS_WS_RPC_URL=wss://ws.rpc.testnet.dogeos.com

# Relayer (optional - disables relayer if not set)
RELAYER_PRIVATE_KEY=<private_key_hex>

# Database (optional - falls back to file/memory)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dogenado
DB_USER=dogenado
DB_PASSWORD=<password>

# Server
PORT=3001
HOST=0.0.0.0

# Contract Addresses (optional - defaults in config.ts)
HASHER_ADDRESS=0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D
VERIFIER_ADDRESS=0xE8Ef2495F741467D746E27548BF71948A0554Ad6
```

### Database Schema (PostgreSQL)

**Tables:**
- `deposits` - Deposit records (pool_address, commitment, leaf_index, depositor_address, tx_hash, block_number, timestamp, is_withdrawn)
- `withdrawals` - Withdrawal records (pool_address, nullifier_hash, recipient, relayer, fee, tx_hash, block_number, timestamp)
- `scheduled_withdrawals` - Scheduled withdrawals (pool_address, nullifier_hash, recipient, unlock_time, scheduled_tx_hash, executed_tx_hash, status)
- `wallet_deposits` - Wallet to deposit mapping
- `sync_state` - Block sync state per pool
- `nullifiers` - Spent nullifiers tracking

**Migration:** `backend/src/database/init.sql`

---

## ✅ Current Implementation Status

### Fully Implemented ✅

1. **Smart Contracts**
   - ✅ MixerPoolV2 contract deployed
   - ✅ Hasher (MiMC) deployed
   - ✅ Verifier deployed
   - ✅ Multiple pools per token deployed
   - ✅ Deposit functionality
   - ✅ Withdrawal with ZK proof
   - ✅ Scheduled withdrawals (timelock)

2. **Backend Services**
   - ✅ Event indexer (listens to Deposit/Withdrawal events)
   - ✅ Merkle tree management
   - ✅ Relayer service (gasless withdrawals)
   - ✅ REST API endpoints
   - ✅ Rate limiting
   - ✅ Health monitoring
   - ✅ RPC fallback mechanism
   - ✅ Secure wallet with retry logic
   - ✅ Database integration (PostgreSQL with fallbacks)

3. **Frontend**
   - ✅ Deposit interface
   - ✅ Withdraw interface
   - ✅ Wallet connection (MetaMask/DogeOS)
   - ✅ Note generation/parsing
   - ✅ ZK proof generation (client-side)
   - ✅ Dashboard UI
   - ✅ Pool selection

4. **ZK Circuits**
   - ✅ Circuit compiled
   - ✅ Proving key generated
   - ✅ Verification key generated
   - ✅ Solidity verifier generated

---

## ⚠️ Known Issues & Limitations

### 1. **Storage State Loss**
- **Issue:** Backend uses in-memory storage by default if database not configured
- **Impact:** Merkle tree state lost on restart, wallet deposits lost
- **Mitigation:** PostgreSQL recommended for production
- **Status:** ⚠️ Works but data loss on restart without DB

### 2. **Rate Limiting**
- **Issue:** In-memory rate limiting (not distributed)
- **Impact:** Multiple backend instances will have separate rate limits
- **Mitigation:** Use Redis for distributed rate limiting in production
- **Status:** ⚠️ Works for single instance

### 3. **Frontend API Routes**
- **Issue:** Frontend has API routes (`/app/api/*`) but unclear if used
- **Impact:** Potential duplication with backend API
- **Status:** 🔍 Needs investigation

### 4. **Circuit Trusted Setup**
- **Issue:** Uses pre-generated Powers of Tau (not custom ceremony)
- **Impact:** Less secure than custom trusted setup ceremony
- **Status:** ⚠️ Functional but not production-grade security

### 5. **Relayer Balance Management**
- **Issue:** No automatic refill mechanism
- **Impact:** Relayer can run out of funds
- **Status:** ⚠️ Manual monitoring required

### 6. **Wallet Deposit Tracking**
- **Issue:** Relies on transaction `from` address (can be wrong if using relayer for deposits)
- **Impact:** Wallet deposit tracking may be inaccurate
- **Status:** ⚠️ Works for direct deposits only

---

## 🔄 Required Updates

### High Priority

1. **Database Persistence**
   - [ ] Ensure PostgreSQL is properly initialized
   - [ ] Add migration scripts
   - [ ] Test fallback mechanisms
   - [ ] Add database backup strategy

2. **Production Configuration**
   - [ ] Update CORS origins for production
   - [ ] Set proper environment variables
   - [ ] Configure RPC endpoints with fallbacks
   - [ ] Set up monitoring/alerting

3. **Security Improvements**
   - [ ] Custom trusted setup ceremony for circuits
   - [ ] Circuit file verification (SRI hashes)
   - [ ] Rate limiting with Redis
   - [ ] Input validation improvements

4. **Relayer Improvements**
   - [ ] Automatic balance monitoring/refill
   - [ ] Better error handling
   - [ ] Transaction retry logic (exists but needs testing)

### Medium Priority

5. **Frontend-Backend Integration**
   - [ ] Verify all API endpoints are used correctly
   - [ ] Test end-to-end flows
   - [ ] Error handling improvements
   - [ ] Loading states

6. **Documentation**
   - [ ] API documentation
   - [ ] Deployment guide
   - [ ] Troubleshooting guide
   - [ ] Security best practices

7. **Testing**
   - [ ] Unit tests for critical components
   - [ ] Integration tests
   - [ ] E2E tests for deposit/withdraw flows

### Low Priority

8. **Performance**
   - [ ] Merkle tree caching
   - [ ] API response caching
   - [ ] WebSocket for real-time updates

9. **Monitoring**
   - [ ] Metrics dashboard
   - [ ] Logging improvements
   - [ ] Alerting for critical issues

---

## 🎭 Mocked/Placeholder Items

### 1. **Verifier Contract**
- **Status:** Uses generated verifier (should verify it matches circuit)
- **Action:** Verify circuit verifier matches deployed contract

### 2. **Frontend API Routes**
- **Location:** `/app/api/*`
- **Status:** Exist but may not be actively used (backend handles most)
- **Action:** Review if needed or remove

### 3. **Payment Request System**
- **Location:** `/app/api/payment-request`, `/app/payment-request`
- **Status:** UI exists but integration unclear
- **Action:** Clarify requirements and implement or remove

### 4. **Account/Inbox System**
- **Location:** `/components/inbox.tsx`, `/app/dashboard/inbox`
- **Status:** UI exists, backend has inbox-summary endpoint
- **Action:** Verify full integration

### 5. **Settings/RPC Configuration**
- **Location:** `/app/api/settings/rpc`
- **Status:** Exists but may not be fully integrated
- **Action:** Test and verify functionality

---

## 🚨 Not Working / Broken Items

### 1. **Database Initialization**
- **Issue:** Database schema may not auto-initialize
- **Fix:** Run `npm run db:init` manually or add auto-init on startup
- **Status:** 🔴 Needs testing

### 2. **Circuit File Loading**
- **Issue:** Circuit files need to be in `/public/circuits/` for browser access
- **Status:** ⚠️ May need verification
- **Files Needed:**
  - `withdraw.wasm`
  - `withdraw_final.zkey`
  - `verification_key.json`

### 3. **RPC Fallback**
- **Issue:** RPC fallback mechanism exists but may not handle all edge cases
- **Status:** ⚠️ Partially tested
- **Location:** `backend/src/utils/rpc-fallback.ts`

### 4. **Wallet Connection**
- **Issue:** DogeOS wallet connection may need updates for latest wallet versions
- **Status:** ⚠️ Needs testing with real wallets

---

## 📝 Summary

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

### What's Missing ❌
- Comprehensive testing
- Production monitoring
- Documentation
- Automated deployments
- Custom trusted setup ceremony

---

## 🎯 Next Steps Recommended

1. **Test Database Setup**
   - Set up PostgreSQL
   - Run migrations
   - Verify persistence works

2. **End-to-End Testing**
   - Test full deposit flow
   - Test full withdrawal flow
   - Test relayer functionality
   - Test scheduled withdrawals

3. **Production Hardening**
   - Configure production environment variables
   - Set up monitoring
   - Review security settings
   - Test RPC fallbacks

4. **Documentation**
   - API documentation
   - Deployment guide
   - Troubleshooting guide

---

*Last Updated: Based on codebase review*
*Project: Dogenado - Privacy Pool for DogeOS*

