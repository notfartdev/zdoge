# Restart Backend to Fix Swap Parameters

The backend server needs to be rebuilt and restarted to pick up the latest changes.

## Steps:

1. **Stop the backend server** (if it's running)
   - Press `Ctrl+C` in the terminal where the backend is running

2. **Rebuild the backend:**
   ```bash
   cd backend
   npm run build
   ```

3. **Start the backend:**
   ```bash
   npm start
   ```

   Or if you're running in development mode:
   ```bash
   npm run dev
   ```

## Why This Is Needed:

The backend code has been updated to expect:
- `outputCommitment1` (not `outputCommitment`)
- `swapAmount` (not `amountIn`)
- `outputCommitment2` (for change notes)

But the running server is still using the old validation that expects the old parameter names, causing the "Missing parameters" error.

## Verify It's Working:

After restarting, try the swap again. The backend logs should show:
- `[ShieldedRelayer] Received swap request:` with the correct parameter names
- No "Missing parameters" error
