# How to Check Database Configuration on Render

## Step-by-Step Guide

### Option 1: Check Render Dashboard Logs (Easiest)

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Log in to your account

2. **Find Your Backend Service**
   - Look for your backend service (likely named something like "dogenado-backend" or "dogenadocash")
   - Click on it

3. **View Logs**
   - Click on the **"Logs"** tab (usually at the top)
   - Or look for a "View Logs" button

4. **Search for Storage Message**
   - Look for one of these messages when the backend starts:
   
   **✅ Good (Using Database):**
   ```
   [Storage] Using PostgreSQL database
   [Database] Connected to PostgreSQL at ...
   ```
   
   **⚠️ Warning (File-based, works but not ideal):**
   ```
   [Storage] Using file-based persistence
   ```
   
   **🔴 Bad (In-memory, data lost on restart):**
   ```
   [Storage] Using in-memory storage (data will be lost on restart)
   [Database] Failed to connect: ...
   [Database] Falling back to in-memory storage
   ```

5. **Check Startup Logs**
   - Scroll to the beginning of the logs (when backend first started)
   - Look for the storage initialization message
   - It should appear right after the backend starts

---

### Option 2: Check via API (If Backend is Running)

You can also check if the backend is healthy:

1. **Visit:** `https://dogenadocash.onrender.com/api/health`
2. **Check response** - should return status

But this won't tell you about database - you need logs for that.

---

### Option 3: Check Environment Variables on Render

1. **Go to Render Dashboard**
2. **Click on your backend service**
3. **Go to "Environment" tab**
4. **Look for these variables:**

   **Required for PostgreSQL:**
   - `DB_HOST` - Should have a value (e.g., `dpg-xxxxx-a.render.com`)
   - `DB_PORT` - Usually `5432`
   - `DB_NAME` - Database name
   - `DB_USER` - Database user
   - `DB_PASSWORD` - Database password

   **If these are missing or empty:**
   - Backend will use in-memory storage
   - Data will be lost on restart

---

## What to Do Based on What You Find

### ✅ If You See "Using PostgreSQL database"

**You're good!** Database is configured correctly.

**Optional:** Verify it's working:
- Make a test deposit
- Restart the backend (on Render)
- Check if the deposit still appears in statistics
- If yes → Database is working perfectly

---

### ⚠️ If You See "Using file-based persistence"

**Works but not ideal:**
- Data is saved to files
- Should survive restarts (if files persist)
- But PostgreSQL is better for production

**To upgrade to PostgreSQL:**
1. Create PostgreSQL database on Render
2. Add environment variables (see below)

---

### 🔴 If You See "Using in-memory storage"

**Action Required!** Data will be lost on restart.

**To Fix:**

1. **Create PostgreSQL Database on Render:**
   - Go to Render Dashboard
   - Click "New +" → "PostgreSQL"
   - Choose a name (e.g., "dogenado-db")
   - Select plan (Free tier works for testing)
   - Click "Create Database"

2. **Get Database Connection Info:**
   - After creation, Render will show:
     - Internal Database URL (for Render services)
     - Or individual connection details

3. **Add Environment Variables to Backend:**
   - Go to your backend service on Render
   - Click "Environment" tab
   - Add these variables:

   ```
   DB_HOST=dpg-xxxxx-a.render.com  (from Render database)
   DB_PORT=5432
   DB_NAME=dogenado  (or your database name)
   DB_USER=dogenado  (or your database user)
   DB_PASSWORD=your-password  (from Render database)
   ```

4. **Initialize Database Schema:**
   - After setting environment variables, restart backend
   - Or manually run: `npm run db:init` (if you have SSH access)

5. **Restart Backend:**
   - On Render, click "Manual Deploy" → "Clear build cache & deploy"
   - Or just restart the service
   - Check logs again - should now say "Using PostgreSQL database"

---

## Quick Test: Verify Database is Working

1. **Make a test deposit** on your frontend
2. **Check statistics** - should show the deposit
3. **Restart backend** on Render (stop and start)
4. **Check statistics again** - deposit should still be there
5. **If deposit is gone** → Database not working (using in-memory)

---

## Render Dashboard Navigation

If you can't find logs:

1. **Render Dashboard** → https://dashboard.render.com
2. **Services** (left sidebar)
3. **Click your backend service**
4. **Logs tab** (top navigation)
5. **Or Events tab** (shows deployment events)

---

## Alternative: Check via Render CLI

If you have Render CLI installed:

```bash
# Install Render CLI
npm install -g render-cli

# Login
render login

# View logs
render logs <service-name>
```

---

## Still Can't Find It?

**Check these locations:**
- Render Dashboard → Your Service → Logs tab
- Render Dashboard → Your Service → Events tab (for startup messages)
- Check if backend is actually running (visit `/api/health`)

**If backend isn't running:**
- Check Render dashboard for errors
- Check if service is paused (free tier pauses after inactivity)
- Restart the service

---

*Need help? Share what you see in the logs and I can help interpret it!*

