# Testing Guide - Shield/Send/Unshield & Activity

## Pre-Testing Checklist

### 1. Backend Setup
- [ ] Backend is deployed on Render: `https://dogenadocash.onrender.com`
- [ ] Database migration has been run (shielded_transactions table exists)
- [ ] Backend is accessible and responding

### 2. Frontend Setup
- [ ] `NEXT_PUBLIC_INDEXER_URL` is set to `https://dogenadocash.onrender.com` (or use default)
- [ ] Frontend is running locally or deployed
- [ ] Wallet is connected to DogeOS Testnet

### 3. ELIFECYCLE Error Check
- [ ] Backend `package.json` has: `"clean": "rm -rf dist 2>/dev/null || true"`
- [ ] Backend builds without errors

---

## Test 1: Shield Transaction

### Steps:
1. Go to Shield page
2. Enter amount (e.g., 1 DOGE)
3. Click "Shield DOGE"
4. Approve transaction in wallet
5. Wait for confirmation

### Expected Results:
- ✅ Transaction succeeds
- ✅ Success message appears with transaction link
- ✅ Transaction appears in Activity page
- ✅ Transaction is saved to backend (check console for sync message)
- ✅ Balance updates correctly

### Backend Verification:
```bash
# Check backend logs for:
[TxHistory] Synced X transactions to backend

# Or query database:
SELECT * FROM shielded_transactions WHERE tx_type = 'shield' ORDER BY timestamp DESC LIMIT 1;
```

---

## Test 2: Send/Transfer Transaction

### Steps:
1. Go to Send page
2. Enter recipient shielded address (zdoge:...)
3. Enter amount (e.g., 0.5 DOGE)
4. Click "Send"
5. Wait for confirmation

### Expected Results:
- ✅ Transaction succeeds
- ✅ Success message appears
- ✅ Transaction appears in Activity page
- ✅ Transaction is saved to backend
- ✅ Recipient receives the transfer (if they check their wallet)

### Backend Verification:
```bash
# Check backend logs for:
[TxHistory] Synced X transactions to backend

# Or query database:
SELECT * FROM shielded_transactions WHERE tx_type = 'transfer' ORDER BY timestamp DESC LIMIT 1;
```

---

## Test 3: Unshield Transaction

### Steps:
1. Go to Unshield page
2. Enter recipient public address
3. Enter amount (e.g., 0.3 DOGE)
4. Click "Unshield"
5. Wait for confirmation

### Expected Results:
- ✅ Transaction succeeds
- ✅ Success message appears with transaction link(s)
- ✅ Transaction appears in Activity page
- ✅ Transaction is saved to backend
- ✅ Funds arrive at public address

### Backend Verification:
```bash
# Check backend logs for:
[TxHistory] Synced X transactions to backend

# Or query database:
SELECT * FROM shielded_transactions WHERE tx_type = 'unshield' ORDER BY timestamp DESC LIMIT 1;
```

---

## Test 4: Activity Page

### Steps:
1. Go to Activity page
2. Check all transaction types are displayed
3. Refresh the page
4. Check filters (All, Shield, Transfer, Swap, Unshield)

### Expected Results:
- ✅ All transactions appear (Shield, Send, Unshield)
- ✅ Transactions persist after page refresh
- ✅ Transactions load from backend (check console: `[TxHistory] Loaded X transactions from backend`)
- ✅ Filters work correctly
- ✅ Transaction details are correct (amount, token, timestamp, status)

### Backend Verification:
```bash
# Check browser console for:
[TxHistory] Loaded X transactions from backend

# Or test API directly:
curl https://dogenadocash.onrender.com/api/wallet/YOUR_ADDRESS/shielded-transactions
```

---

## Test 5: Backend Sync Verification

### Check Console Logs:
1. Open browser DevTools → Console
2. Perform a transaction (Shield/Send/Unshield)
3. Look for:
   - `[TxHistory] Added transaction: ...`
   - `[TxHistory] Synced X transactions to backend` (success)
   - OR `[TxHistory] Backend sync error (will retry later): ...` (failure)

### Check Backend Logs (Render):
1. Go to Render dashboard
2. View backend service logs
3. Look for:
   - `POST /api/wallet/:address/shielded-transactions` requests
   - Database insert/update operations

### Direct API Test:
```bash
# Get transactions for your wallet
curl https://dogenadocash.onrender.com/api/wallet/YOUR_WALLET_ADDRESS/shielded-transactions

# Should return JSON array of transactions
```

---

## Test 6: ELIFECYCLE Error Fix

### Check Backend Build:
1. Go to Render dashboard
2. Check latest deployment logs
3. Look for build errors

### Expected:
- ✅ Build completes successfully
- ✅ No `ELIFECYCLE Command failed` errors
- ✅ Clean script runs: `rm -rf dist`

### If Error Persists:
- Check `backend/package.json` has: `"clean": "rm -rf dist 2>/dev/null || true"`
- Verify the script runs on Render (check build logs)

---

## Troubleshooting

### Transactions Not Syncing to Backend:
1. Check `NEXT_PUBLIC_INDEXER_URL` is set correctly
2. Check backend is accessible: `curl https://dogenadocash.onrender.com/health`
3. Check browser console for CORS errors
4. Check backend logs for errors

### Activity Page Not Loading:
1. Check browser console for errors
2. Verify backend API is responding
3. Check network tab for failed requests

### ELIFECYCLE Error:
1. Verify `backend/package.json` clean script
2. Check Render build logs
3. Try manual build: `cd backend && npm run build`

---

## Success Criteria

All tests pass when:
- ✅ Shield transaction works and syncs
- ✅ Send/Transfer transaction works and syncs
- ✅ Unshield transaction works and syncs
- ✅ Activity page shows all transactions
- ✅ Transactions persist after refresh
- ✅ Backend logs show successful syncs
- ✅ No ELIFECYCLE errors in build

