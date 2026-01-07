# Testing Transaction History Sync

## Migration Status ✅
- Database table created successfully
- API endpoints are live

## How to Test

### 1. Perform a Shielded Transaction

1. **Connect your wallet** to the frontend
2. **Go to Shield page** (`/shield`)
3. **Perform a shield transaction:**
   - Select a token (e.g., DOGE)
   - Enter an amount
   - Click "Shield"
   - Wait for transaction to confirm

### 2. Verify Sync Happened

**Option A: Check Browser Console**
- Open Developer Tools (F12)
- Go to Console tab
- Look for: `[TxHistory] Synced X transactions to backend`
- Should see: `[TxHistory] Added transaction: [txHash]-shield`

**Option B: Check Backend Logs (Render)**
- Go to Render Dashboard → Your backend service
- Click "Logs" tab
- Look for API requests: `POST /api/wallet/[your-address]/shielded-transactions`
- Should see successful responses

**Option C: Check via API**
Call this endpoint (replace with your wallet address):
```bash
GET https://dogenadocash.onrender.com/api/wallet/YOUR_WALLET_ADDRESS/shielded-transactions
```

Expected response:
```json
{
  "wallet": "0x...",
  "count": 1,
  "transactions": [
    {
      "id": "[txHash]-shield",
      "type": "shield",
      "txHash": "0x...",
      "timestamp": 1234567890,
      "token": "DOGE",
      "amount": "10.0000",
      "amountWei": "10000000000000000000",
      "status": "confirmed",
      ...
    }
  ]
}
```

**Option D: Check Activity Page**
- Go to `/activity` page
- Your transaction should appear in the list
- Should show type, amount, timestamp, status

### 3. Test Different Transaction Types

Test all types to ensure they sync:
- ✅ Shield (deposit to shielded pool)
- ✅ Transfer (send shielded tokens)
- ✅ Swap (swap shielded tokens)
- ✅ Unshield (withdraw from shielded pool)

### 4. Test Status Updates

After a transaction:
1. It starts as `"status": "pending"`
2. Once confirmed, it updates to `"status": "confirmed"`
3. Check that status updates sync to backend

## Troubleshooting

**Transactions not appearing:**
- Check browser console for errors
- Verify `NEXT_PUBLIC_INDEXER_URL` is set correctly
- Check backend logs for API errors
- Transactions still work with localStorage fallback

**API returns 503:**
- Database connection issue
- Check backend logs for database errors
- Verify database is running on Render

**Transactions not syncing:**
- Check network tab in browser dev tools
- Look for failed POST requests to `/api/wallet/.../shielded-transactions`
- Check CORS settings (should be fine, already configured)

## After Testing

Once everything works:
1. ✅ Remove temporary migration endpoint
2. ✅ Transaction history sync is fully operational!

