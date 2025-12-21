# Next Steps & Things to Look Out For

## 🔴 Critical (Do First)

### 1. **Verify Backend API is Working** ⚠️
**Action:** Test your production site now
- Visit: `https://dogenado.cash/dashboard`
- Open browser console (F12)
- Check if API calls go to `https://dogenadocash.onrender.com`
- Verify statistics show real data (not "Backend unavailable")

**If not working:**
- Check backend logs on Render dashboard
- Verify backend is running: `https://dogenadocash.onrender.com/api/health`

### 2. **Database Configuration (Critical for Production)** 🔴
**Issue:** Backend defaults to in-memory storage if PostgreSQL isn't configured. Data is lost on restart.

**Check Backend Logs:**
Look for one of these messages:
- ✅ `[Storage] Using PostgreSQL database` - Good!
- ⚠️ `[Storage] Using file-based persistence` - Works but not ideal
- 🔴 `[Storage] Using in-memory storage (data will be lost on restart)` - **BAD for production**

**To Fix:**
1. Check if PostgreSQL is set up on Render
2. Add these environment variables to your backend on Render:
   ```
   DB_HOST=your-postgres-host
   DB_PORT=5432
   DB_NAME=dogenado
   DB_USER=dogenado
   DB_PASSWORD=your-password
   ```
3. Run database initialization: `npm run db:init` (if script exists)

**Impact:** Without DB, all Merkle tree state and deposits are lost when backend restarts!

---

## 🟡 High Priority (Do Soon)

### 3. **Test End-to-End Flows** 🧪
Test these critical paths:

**Deposit Flow:**
1. Connect wallet
2. Select token and amount
3. Make a deposit
4. Verify note is generated
5. Check if deposit appears in statistics
6. Verify deposit shows in "Inbox" page

**Withdraw Flow:**
1. Use a saved note
2. Enter recipient address
3. Generate proof (check console for errors)
4. Submit withdrawal (direct or via relayer)
5. Verify withdrawal succeeds

**Issues to Watch:**
- Circuit files loading correctly (check browser console)
- Proof generation takes time (may timeout on slow connections)
- Relayer balance (check backend logs)

### 4. **Monitor Relayer Balance** 💰
**Problem:** Relayer pays gas fees. If it runs out of DOGE, withdrawals fail.

**Action:**
- Check backend logs for: `[Relayer] WARNING: Relayer has no balance for gas`
- Monitor relayer address balance on explorer
- Set up alerts if balance gets low

**Relayer Address:** Check backend logs for: `[Relayer] Wallet initialized: 0x...`

---

## 🟢 Medium Priority (Plan For)

### 5. **Production Hardening** 🔒

**CORS Configuration:**
- Verify backend allows requests from `https://dogenado.cash`
- Check: `backend/src/index.ts` CORS settings

**Rate Limiting:**
- Current: In-memory (per instance)
- Future: Redis for distributed rate limiting if you scale

**Security:**
- Circuit trusted setup uses pre-generated Powers of Tau
- Consider custom trusted setup ceremony for production

### 6. **Monitor These Metrics** 📊

**Backend Health:**
- API response times
- Error rates
- Database connection status
- RPC endpoint health (backend has fallback mechanism)

**Frontend:**
- Proof generation success rate
- API call failures
- Circuit file loading errors

---

## 🔍 Things to Watch Out For

### Known Issues:

1. **Storage State Loss** ⚠️
   - **If:** Database not configured
   - **Impact:** Merkle tree state lost on restart
   - **Fix:** Configure PostgreSQL (see #2 above)

2. **Rate Limiting (Single Instance)** ⚠️
   - **If:** You scale to multiple backend instances
   - **Impact:** Each instance has separate rate limits
   - **Fix:** Use Redis for distributed rate limiting

3. **Wallet Deposit Tracking** ⚠️
   - **Issue:** Relies on transaction `from` address
   - **Impact:** May be inaccurate if using relayer for deposits
   - **Status:** Works for direct deposits

4. **Circuit File Loading** ✅
   - **Status:** Files are in `/public/circuits/` - verified
   - **Watch:** Browser console for loading errors

---

## 📋 Testing Checklist

### Immediate Testing:
- [ ] Backend API responds: `https://dogenadocash.onrender.com/api/health`
- [ ] Frontend loads statistics correctly
- [ ] Database is configured (check backend logs)
- [ ] Test deposit flow works
- [ ] Test withdrawal flow works
- [ ] Relayer has DOGE balance

### Before Mainnet:
- [ ] Full security audit
- [ ] Custom trusted setup ceremony
- [ ] Comprehensive testing
- [ ] Database backups configured
- [ ] Monitoring/alerting set up
- [ ] Documentation complete

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

## 📞 Quick Reference

**Backend URL:** `https://dogenadocash.onrender.com`  
**Frontend URL:** `https://dogenado.cash`  
**Docs URL:** `https://docs.dogenado.cash`

**Environment Variables (Frontend - Vercel):**
- `NEXT_PUBLIC_INDEXER_URL=https://dogenadocash.onrender.com` ✅
- `NEXT_PUBLIC_RELAYER_URL=https://dogenadocash.onrender.com` ✅

**Environment Variables (Backend - Render):**
- `DOGEOS_RPC_URL` (optional, has default)
- `RELAYER_PRIVATE_KEY` (required for relayer)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (recommended for production)

---

*Last Updated: Based on current codebase and configuration*

