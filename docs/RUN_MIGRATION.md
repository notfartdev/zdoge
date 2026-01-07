# Quick Migration Steps for Your Render Database

## Your Connection Details:
- **Host:** `dpg-d5346akhg0os738j8p8g-a.virginia-postgres.render.com`
- **Port:** `5432`
- **Database:** `dogenado_db`
- **Username:** `dogenado_db_user`
- **Password:** `WDRx8qtPDMouAQXRzyFF1f8eu6MDawFs`

## Option 1: pgAdmin (Easiest - GUI)

1. **Download pgAdmin:** https://www.pgadmin.org/download/pgadmin-4-windows/
2. **Install and open pgAdmin**
3. **Add Server:**
   - Right-click "Servers" → Register → Server
   - Name: "Render Dogenado"
   - **Connection tab:**
     - Host: `dpg-d5346akhg0os738j8p8g-a.virginia-postgres.render.com`
     - Port: `5432`
     - Database: `dogenado_db`
     - Username: `dogenado_db_user`
     - Password: `WDRx8qtPDMouAQXRzyFF1f8eu6MDawFs`
   - Click "Save"
4. **Run Migration:**
   - Expand: Servers → Render Dogenado → Databases → dogenado_db
   - Right-click `dogenado_db` → Query Tool
   - Open file: `MANUAL_MIGRATION.sql`
   - Copy ALL the SQL
   - Paste into Query Tool
   - Press **F5** or click Execute button
   - ✅ Done!

## Option 2: psql (Command Line)

If you have PostgreSQL installed locally:

```bash
# Set password as environment variable
$env:PGPASSWORD="WDRx8qtPDMouAQXRzyFF1f8eu6MDawFs"

# Connect and run migration
psql -h dpg-d5346akhg0os738j8p8g-a.virginia-postgres.render.com -p 5432 -U dogenado_db_user -d dogenado_db -f MANUAL_MIGRATION.sql
```

Or connect interactively:
```bash
psql "postgresql://dogenado_db_user:WDRx8qtPDMouAQXRzyFF1f8eu6MDawFs@dpg-d5346akhg0os738j8p8g-a.virginia-postgres.render.com:5432/dogenado_db"
# Then paste the SQL from MANUAL_MIGRATION.sql
```

## Verify It Worked

After running, verify the table was created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'shielded_transactions';
```

Should return: `shielded_transactions`

## Next Steps

After migration:
1. ✅ Backend will automatically use the new table
2. ✅ Transactions will start syncing
3. ✅ No restart needed (table is ready to use)

