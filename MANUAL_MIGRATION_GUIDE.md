# Manual Database Migration Guide

Since Render Shell requires a premium plan, here are alternative ways to run the migration:

## Option 1: Render Database Connect (Easiest)

1. **Go to Render Dashboard**
   - Navigate to your PostgreSQL database service
   - Click on the database (not the web service)

2. **Get Connection Info**
   - Go to "Info" or "Settings" tab
   - Copy the connection string or note the connection details:
     - Host
     - Port
     - Database name
     - Username
     - Password

3. **Use a PostgreSQL Client**

   **Option A: psql (Command Line)**
   ```bash
   # Install psql if needed (comes with PostgreSQL)
   # Then connect:
   psql "postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
   
   # Then paste and run the SQL from MANUAL_MIGRATION.sql
   ```

   **Option B: pgAdmin (GUI - Free)**
   - Download from: https://www.pgadmin.org/
   - Add new server with Render connection details
   - Right-click database → Query Tool
   - Paste SQL from `MANUAL_MIGRATION.sql`
   - Execute (F5)

   **Option C: DBeaver (GUI - Free)**
   - Download from: https://dbeaver.io/
   - Create new PostgreSQL connection
   - Enter Render connection details
   - Open SQL Editor
   - Paste SQL from `MANUAL_MIGRATION.sql`
   - Execute (Ctrl+Enter)

   **Option D: Online SQL Client**
   - Use https://sqlpad.io/ or similar
   - Connect with Render credentials
   - Paste and execute SQL

## Option 2: Create Temporary Migration Endpoint

If you can't access the database directly, we can create a one-time migration endpoint:

1. Add this to `backend/src/index.ts` (temporarily):
```typescript
// Temporary migration endpoint (remove after use)
app.post('/api/admin/migrate-shielded-transactions', apiLimiter, async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS shielded_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        wallet_address VARCHAR(42) NOT NULL,
        tx_id VARCHAR(128) NOT NULL,
        tx_type VARCHAR(20) NOT NULL,
        tx_hash VARCHAR(66) NOT NULL,
        timestamp BIGINT NOT NULL,
        token VARCHAR(20) NOT NULL,
        amount TEXT NOT NULL,
        amount_wei TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        block_number INTEGER,
        transaction_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(wallet_address, tx_id)
      );
    `);
    
    await db.query(`CREATE INDEX IF NOT EXISTS idx_shielded_tx_wallet ON shielded_transactions(wallet_address);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_shielded_tx_type ON shielded_transactions(tx_type);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_shielded_tx_timestamp ON shielded_transactions(timestamp DESC);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_shielded_tx_status ON shielded_transactions(status);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_shielded_tx_hash ON shielded_transactions(tx_hash);`);
    
    res.json({ success: true, message: 'Migration complete' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

2. Deploy the code
3. Call the endpoint once: `POST https://dogenadocash.onrender.com/api/admin/migrate-shielded-transactions`
4. Remove the endpoint code and redeploy

## Option 3: Render Database Query Interface

Some Render database plans include a web query interface:
1. Go to your database service in Render
2. Look for "Query" or "Data" tab
3. Paste SQL from `MANUAL_MIGRATION.sql`
4. Execute

## Verification

After running the migration, verify it worked:

```sql
-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'shielded_transactions';

-- Should return: shielded_transactions

-- Check table structure
\d shielded_transactions
-- or
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shielded_transactions';
```

## Recommended Approach

**I recommend Option 1B (pgAdmin)** - it's free, visual, and easy to use:
1. Download pgAdmin
2. Connect using Render database credentials
3. Copy/paste SQL from `MANUAL_MIGRATION.sql`
4. Execute
5. Done!

The SQL uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times - it won't break anything if the table already exists.

