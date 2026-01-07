# Render Database Migration - Step by Step

## Quick Commands for Render Shell

Once you're in the Render Shell for your backend service, run these commands:

```bash
# Navigate to backend directory (if not already there)
cd backend

# Build TypeScript to JavaScript
npm run build

# Run database initialization (creates shielded_transactions table)
npm run db:init
```

## Expected Output

You should see:
```
🔧 Dogenado Database Initialization

Connecting to PostgreSQL at [your-db-host]:5432/dogenado...
✅ Connected to database

📄 Executing schema...

   ✅ Table: pools
   ✅ Table: deposits
   ✅ Table: nullifiers
   ✅ Table: scheduled_withdrawals
   ✅ Table: withdrawals
   ✅ Table: merkle_nodes
   ✅ Table: merkle_roots
   ✅ Table: transaction_logs
   ✅ Table: sync_state
   ✅ Table: shielded_transactions  ← NEW TABLE
   ✅ Index: idx_shielded_tx_wallet
   ✅ Index: idx_shielded_tx_type
   ✅ Index: idx_shielded_tx_timestamp
   ✅ Index: idx_shielded_tx_status
   ✅ Index: idx_shielded_tx_hash

📊 Results:
   Executed: [number]
   Skipped (already exists): [number]
   Errors: 0

📋 Verifying tables...
   Tables found:
   - deposits
   - merkle_nodes
   - merkle_roots
   - nullifiers
   - pools
   - scheduled_withdrawals
   - shielded_transactions  ← Should appear here
   - sync_state
   - transaction_logs
   - withdrawals

✅ Database initialization complete!
```

## Troubleshooting

**If you get "Cannot find module" errors:**
- Make sure you're in the `backend` directory
- Run `npm install` first if dependencies are missing

**If you get database connection errors:**
- Verify environment variables are set in Render dashboard:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASSWORD`

**If table already exists:**
- That's fine! The script uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times
- You'll see "Skipped (already exists)" in the output

## After Migration

1. **Restart your backend service** in Render (or it will auto-restart)
2. **Check logs** for: `[Storage] Using PostgreSQL database`
3. **Test the API:**
   ```bash
   curl https://dogenadocash.onrender.com/api/wallet/0x0000000000000000000000000000000000000000/shielded-transactions
   ```
   Should return: `{"wallet":"0x0000...","count":0,"transactions":[]}`

## Next Steps

After migration is complete:
1. Deploy frontend changes (if not already deployed)
2. Test by performing a shielded transaction
3. Verify transactions sync to backend

