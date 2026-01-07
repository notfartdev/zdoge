# Transaction History Sync - Deployment Steps

## What We've Added

✅ Backend API endpoints for syncing shielded transaction history
✅ Database schema with `shielded_transactions` table
✅ Frontend integration to sync transactions automatically
✅ Backward compatibility with localStorage fallback

## Deployment Steps

### 1. Update Database Schema on Render

The new `shielded_transactions` table needs to be created. Since the schema uses `CREATE TABLE IF NOT EXISTS`, it's safe to run the init script.

**Option A: Run via Render Shell (Recommended)**

1. Go to your Render dashboard → Your backend service
2. Open the "Shell" tab (or use SSH if configured)
3. Run:
   ```bash
   cd backend
   npm run build
   npm run db:init
   ```

**Option B: Manual SQL (If you have database access)**

Run this SQL on your Render PostgreSQL database:
```sql
-- Copy the CREATE TABLE statement from backend/src/database/schema.sql
-- (lines for shielded_transactions table)
```

### 2. Deploy Backend Code

1. **Commit and push changes:**
   ```bash
   git add .
   git commit -m "Add transaction history sync API endpoints"
   git push
   ```

2. **Render will automatically deploy** (if auto-deploy is enabled)
   - Or manually trigger deployment in Render dashboard

3. **Verify deployment:**
   - Check backend logs for: `[Storage] Using PostgreSQL database`
   - Test endpoint: `GET https://dogenadocash.onrender.com/api/wallet/0x.../shielded-transactions`

### 3. Deploy Frontend (if needed)

The frontend changes are backward compatible, but you can deploy to get the sync functionality:

```bash
# If using Vercel or similar
git push  # Auto-deploys

# Or manually build and deploy
npm run build
```

### 4. Test the Integration

1. **Test backend API directly:**
   ```bash
   # Get transactions (should return empty array initially)
   curl https://dogenadocash.onrender.com/api/wallet/YOUR_WALLET_ADDRESS/shielded-transactions
   
   # Sync transactions (test with sample data)
   curl -X POST https://dogenadocash.onrender.com/api/wallet/YOUR_WALLET_ADDRESS/shielded-transactions \
     -H "Content-Type: application/json" \
     -d '{"transactions": [{"txHash": "0x123...", "type": "shield", ...}]}'
   ```

2. **Test in frontend:**
   - Connect wallet
   - Perform a shielded transaction (shield, transfer, swap, or unshield)
   - Check browser console for: `[TxHistory] Synced X transactions to backend`
   - Verify transactions appear in Activity page

### 5. Verify Database

Check that transactions are being stored:
- Connect to Render PostgreSQL database
- Query: `SELECT * FROM shielded_transactions LIMIT 10;`
- Should see transactions after users perform operations

## How It Works

1. **On wallet connect:** Frontend loads transaction history from backend
2. **On new transaction:** Frontend adds to localStorage AND syncs to backend (non-blocking)
3. **On status update:** Frontend updates localStorage AND syncs to backend
4. **Fallback:** If backend is unavailable, localStorage is used (backward compatible)

## Environment Variables (Already Set)

No new environment variables needed - uses existing:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (for database connection)
- `NEXT_PUBLIC_INDEXER_URL` (for frontend API calls)

## Troubleshooting

**Backend returns 503 for sync endpoint:**
- Check database connection in backend logs
- Verify `shielded_transactions` table exists
- Check database credentials in Render environment variables

**Transactions not syncing:**
- Check browser console for errors
- Verify `NEXT_PUBLIC_INDEXER_URL` is set correctly
- Check backend logs for API errors
- Transactions still work with localStorage fallback

**Database connection issues:**
- Verify PostgreSQL is running on Render
- Check database credentials
- Backend falls back to in-memory storage (transactions won't persist across restarts)

