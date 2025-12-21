# Rate Limit and Data Update Fixes

## Issues Fixed

### 1. Rate Limiting on Localhost ✅
**Problem:** Backend was rate-limiting requests from `127.0.0.1` (localhost), causing errors during development.

**Fix:** Added localhost exemption in rate limiter:
```typescript
// Skip rate limiting for localhost (development)
if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
  return next();
}
```

**Result:** Localhost requests are no longer rate-limited, but production requests still are.

---

### 2. Data Update Delays (1-2 minutes) ✅
**Problem:** Indexer was using HTTP transport for event watching, which uses polling and can have 1-2 minute delays.

**Fix:** Added WebSocket client for real-time event watching:
```typescript
// Create WebSocket client for real-time event watching
let wsClient = createPublicClient({
  chain: dogeosTestnet,
  transport: webSocket(config.wsRpcUrl), // Real-time push events
});

// Use WebSocket for event watching, HTTP for regular calls
const eventClient = wsClient || publicClient; // Fallback to HTTP if WS fails
eventClient.watchContractEvent({...});
```

**Result:** Events are now received in real-time (seconds instead of minutes).

---

## How It Works Now

### Event Watching Flow:

**Before (HTTP Polling):**
1. Backend polls RPC every X seconds/minutes
2. Checks for new blocks
3. Queries for new events
4. **Delay: 1-2 minutes**

**After (WebSocket):**
1. Backend connects to WebSocket RPC
2. RPC pushes events immediately when they happen
3. **Delay: < 1 second**

### Rate Limiting Flow:

**Before:**
- All requests rate-limited (including localhost)
- Development issues

**After:**
- Localhost exempt from rate limiting ✅
- Production requests still protected ✅

---

## Configuration

Make sure these environment variables are set in your backend:

```bash
# HTTP RPC (for regular calls)
DOGEOS_RPC_URL=https://rpc.testnet.dogeos.com

# WebSocket RPC (for real-time events) - REQUIRED for fast updates
DOGEOS_WS_RPC_URL=wss://ws.rpc.testnet.dogeos.com
```

If WebSocket URL is not set, the system falls back to HTTP polling (slower but still works).

---

## Testing

After deploying these changes:

1. **Rate Limiting:** Should no longer see `[RateLimit] api limit exceeded for 127.0.0.1`
2. **Data Updates:** Statistics should update within seconds of a deposit/withdrawal, not minutes

---

## Notes

- WebSocket connection is persistent and will auto-reconnect if it drops
- If WebSocket fails to initialize, system falls back to HTTP polling
- Rate limiting still applies in production (only localhost is exempt)

