# Deployment Guide - Shielded Pool with Swap Support

This guide explains how to deploy the updated shielded pool functionality (with swap support and change notes) to production on Render.

---

## 🔄 What Changed

### Frontend (`lib/dogeos-config.ts`)
- **Shielded Pool Address**: `0x40c74Fd9B171D34d971B182bDd5756fe39e477E9` (new contract with change notes support)
- **Verifier Addresses**: All updated to match the new contract deployment
- **Swap Circuit**: Updated to support change notes (`outputCommitment2`)

### Backend (`backend/src`)
- **Swap Endpoint**: Updated to handle new swap parameters (`outputCommitment1`, `outputCommitment2`, `swapAmount`)
- **Transfer Endpoint**: Already supports change notes

---

## 📦 Frontend Deployment

### Step 1: Commit and Push Changes

```bash
# Make sure all changes are committed
git add .
git commit -m "feat: Add swap functionality with change notes support"
git push origin main
```

### Step 2: Deploy to Production

If you're using Vercel, Netlify, or another hosting service:
- **Vercel**: Automatic deployment on push to `main`
- **Netlify**: Automatic deployment on push to `main`
- **Manual**: Build and deploy the `out` folder after `npm run build`

### Step 3: Verify Frontend Config

The frontend uses **hardcoded addresses** in `lib/dogeos-config.ts`:
- ✅ Already updated to `0x40c74Fd9B171D34d971B182bDd5756fe39e477E9`
- ✅ All verifier addresses are correct
- ✅ No environment variables needed for frontend

**No additional frontend configuration needed!**

---

## 🔧 Backend Deployment (Render)

### Step 1: Update Environment Variables on Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Navigate to your service: **dogenadocash** → **Environment**
3. Click **"Edit"** button
4. Update the following environment variable:

#### Required Change:

**`SHIELDED_POOL_ADDRESS`**
- **Old value**: `0xc5F64faee07A6EFE235C12378101062e370c0cD5` ❌
- **New value**: `0x40c74Fd9B171D34d971B182bDd5756fe39e477E9` ✅

#### No Changes Needed (Keep Existing):

- ✅ `RELAYER_PRIVATE_KEY` - Keep as is
- ✅ `DOGEOS_RPC_URL` - Keep as is (`https://rpc.testnet.dogeos.com`)
- ✅ `DOGEOS_WS_RPC_URL` - Keep as is (`wss://ws.rpc.testnet.dogeos.com`)
- ✅ `DB_*` variables - Keep as is
- ✅ `NODE_ENV` - Keep as is (`production`)
- ✅ `PORT` - Keep as is (`10000`)

### Step 2: Deploy Backend Code

#### Option A: Automatic Deployment (Recommended)

If Render is connected to your Git repository:
1. Push your changes to the `main` branch
2. Render will automatically detect the push
3. Build and deploy the new code
4. After deployment, verify the environment variable is updated

#### Option B: Manual Deployment

If you need to manually trigger:
1. Go to Render dashboard → Your service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

### Step 3: Verify Backend Deployment

After deployment, check the logs:

```bash
# In Render dashboard → Logs tab, you should see:
[ShieldedPool] Initializing: 0x40c74Fd9B171D34d971B182bDd5756fe39e477E9
[ShieldedPool] Pool initialized successfully
```

---

## ✅ Verification Checklist

After deployment, verify:

### Frontend:
- [ ] Visit your production URL
- [ ] Navigate to Swap tab
- [ ] Check that "Max:" shows correct amount (largest single note)
- [ ] Try a small swap (DOGE → USDC)
- [ ] Verify transaction succeeds on Blockscout

### Backend:
- [ ] Check Render logs for successful initialization
- [ ] Verify `SHIELDED_POOL_ADDRESS` env var is `0x40c74Fd9B171D34d971B182bDd5756fe39e477E9`
- [ ] Test swap endpoint: `POST /api/shielded/relay/swap`
- [ ] Verify relayer can process swap transactions

### On-Chain:
- [ ] Verify swap transactions on Blockscout
- [ ] Check `Swap` event is emitted correctly
- [ ] Verify `LeafInserted` events for both output commitments (swapped + change)

---

## 🔍 Environment Variables Reference

### Backend (Render) - Complete List

| Variable | Current Value | Status |
|----------|---------------|--------|
| `SHIELDED_POOL_ADDRESS` | `0x40c74Fd9B171D34d971B182bDd5756fe39e477E9` | ✅ **UPDATE THIS** |
| `RELAYER_PRIVATE_KEY` | `<your-relayer-private-key-here>` | ✅ Set in Render dashboard |
| `DOGEOS_RPC_URL` | `https://rpc.testnet.dogeos.com` | ✅ Keep |
| `DOGEOS_WS_RPC_URL` | `wss://ws.rpc.testnet.dogeos.com` | ✅ Keep |
| `NODE_ENV` | `production` | ✅ Keep |
| `PORT` | `10000` | ✅ Keep |
| `DB_HOST` | (your DB host) | ✅ Keep |
| `DB_PORT` | `5432` | ✅ Keep |
| `DB_USER` | `dogenado_db_user` | ✅ Keep |
| `DB_PASSWORD` | `*********` | ✅ Keep |

### Frontend (No Environment Variables Needed)

The frontend uses hardcoded configuration in `lib/dogeos-config.ts`:
- ✅ Already updated to the correct addresses
- ✅ No `.env` file needed for production

---

## 🚨 Important Notes

1. **Don't Change `RELAYER_PRIVATE_KEY`**: This must stay the same or you'll lose access to the relayer wallet funds

2. **Backend Must Restart**: After updating `SHIELDED_POOL_ADDRESS`, the backend service will restart automatically. Wait for it to finish before testing.

3. **Database**: The shielded pool indexer will start indexing the new contract. This may take a few minutes if there are many existing transactions.

4. **Frontend Cache**: If using a CDN (like Vercel), it may take a few minutes for the new build to propagate.

---

## 📝 Quick Command Summary

```bash
# 1. Commit and push frontend changes
git add .
git commit -m "feat: Update shielded pool config with new contract address"
git push origin main

# 2. Update Render environment variable (via dashboard):
#    SHIELDED_POOL_ADDRESS = 0x40c74Fd9B171D34d971B182bDd5756fe39e477E9

# 3. Backend will auto-deploy (or manually trigger)
# 4. Wait for deployment to complete
# 5. Test swap functionality
```

---

## 🆘 Troubleshooting

### Backend won't start after update:
- Check Render logs for errors
- Verify `SHIELDED_POOL_ADDRESS` format (must start with `0x`)
- Check if relayer wallet has sufficient DOGE for gas

### Swaps failing:
- Verify the contract address is correct
- Check that verifier addresses match the deployed contracts
- Verify relayer has sufficient balance

### Frontend shows old contract:
- Clear browser cache
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Check if CDN cache needs to be invalidated

---

## ✨ What's New

This deployment includes:
- ✅ **Swap functionality** with full Zcash-style privacy
- ✅ **Change notes support** for partial swaps
- ✅ **Max button fix** (shows largest single note)
- ✅ **Improved error handling** and user feedback
- ✅ **On-chain verification** support

Everything is tested and ready for production! 🚀
