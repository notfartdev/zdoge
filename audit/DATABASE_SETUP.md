# PostgreSQL Database Setup Guide

## Option A: Using Docker (Recommended - Easiest)

### Prerequisites
- Install Docker Desktop from: https://www.docker.com/products/docker-desktop/

### Steps

1. **Start Docker Desktop** and wait for it to be ready.

2. **Navigate to backend folder:**
   ```powershell
   cd C:\Users\Ivan\Desktop\dogenado\backend
   ```

3. **Start PostgreSQL container:**
   ```powershell
   docker-compose up -d
   ```

4. **Verify it's running:**
   ```powershell
   docker ps
   ```
   You should see `dogenado-db` running.

5. **Create `.env` file in backend folder:**
   ```
   RELAYER_PRIVATE_KEY=<your-relayer-private-key-here>
   
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=dogenado
   DB_USER=dogenado
   DB_PASSWORD=<your-database-password-here>
   ```

6. **Start the backend:**
   ```powershell
   npm run dev
   ```

You should see: `[Database] Connected to PostgreSQL at localhost:5432/dogenado`

---

## Option B: Install PostgreSQL Locally (Windows)

### Step 1: Download PostgreSQL

1. Go to: https://www.postgresql.org/download/windows/
2. Click "Download the installer"
3. Download the latest version (PostgreSQL 16)

### Step 2: Install PostgreSQL

1. Run the installer
2. Choose installation directory (default is fine)
3. Select components:
   - [x] PostgreSQL Server
   - [x] pgAdmin 4 (optional, for GUI management)
   - [x] Command Line Tools
4. Set data directory (default is fine)
5. **Set password for 'postgres' superuser** - REMEMBER THIS!
6. Set port: `5432` (default)
7. Complete installation

### Step 3: Create Database and User

1. **Open Command Prompt as Administrator**

2. **Connect to PostgreSQL:**
   ```cmd
   "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
   ```
   Enter the password you set during installation.

3. **Create database and user:**
   ```sql
   CREATE DATABASE dogenado;
   CREATE USER dogenado WITH PASSWORD '<your-database-password-here>';
   GRANT ALL PRIVILEGES ON DATABASE dogenado TO dogenado;
   \c dogenado
   GRANT ALL ON SCHEMA public TO dogenado;
   \q
   ```

### Step 4: Initialize Schema

```powershell
cd C:\Users\Ivan\Desktop\dogenado\backend
npm run db:init
```

### Step 5: Configure Backend

Create `.env` file in `backend` folder:
```
RELAYER_PRIVATE_KEY=<your-relayer-private-key-here>

DB_HOST=localhost
DB_PORT=5432
DB_NAME=dogenado
DB_USER=dogenado
DB_PASSWORD=<your-database-password-here>
```

### Step 6: Start Backend

```powershell
npm run dev
```

---

## Option C: Cloud Database (Production)

### Recommended Providers:
- **Supabase** (free tier): https://supabase.com
- **Neon** (free tier): https://neon.tech
- **Railway** (free tier): https://railway.app
- **AWS RDS** (paid): https://aws.amazon.com/rds/postgresql/

### Supabase Setup (Easiest):

1. Create account at https://supabase.com
2. Create new project
3. Go to Settings > Database
4. Copy connection string
5. Update `.env`:
   ```
   DB_HOST=db.xxxxx.supabase.co
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=your-supabase-password
   ```

---

## Verify Connection

After starting the backend, check the health endpoint:

```powershell
curl http://localhost:3001/api/health
```

Look for:
```json
{
  "status": "ok",
  "storageMode": "postgresql"
}
```

If you see `"storageMode": "memory"`, the database connection failed.

---

## Troubleshooting

### "Connection refused"
- Make sure PostgreSQL is running
- Check if port 5432 is open
- Verify Docker is running (for Option A)

### "Authentication failed"
- Double-check password in `.env`
- Verify user was created correctly

### "Database does not exist"
- Run: `npm run db:init`
- Or create manually: `CREATE DATABASE dogenado;`

### Docker Issues
```powershell
# Stop and remove container
docker-compose down

# Remove volume (WARNING: deletes all data)
docker-compose down -v

# Rebuild and start
docker-compose up -d --build
```

---

## Common Commands

```powershell
# Start database (Docker)
docker-compose up -d

# Stop database (Docker)
docker-compose down

# View logs (Docker)
docker logs dogenado-db

# Connect to database (Docker)
docker exec -it dogenado-db psql -U dogenado -d dogenado

# Initialize/update schema
npm run db:init
```

