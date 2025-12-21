# Transaction Streaming to Community Channels

## Overview

Yes, it's **absolutely possible** to stream transaction activity to Discord, Telegram, or other channels! Your backend already monitors all deposits and withdrawals in real-time.

## How It Works

Your backend (`backend/src/indexer/index.ts`) already:
- ✅ Watches `Deposit` events from contracts
- ✅ Watches `Withdrawal` events from contracts  
- ✅ Processes them in real-time via `watchContractEvent`
- ✅ Logs them to console

**We just need to add webhook/notification logic when these events happen.**

---

## Implementation Options

### Option 1: Discord Webhook (Easiest) ✅ Recommended

**How it works:**
1. Create a Discord webhook URL in your Discord server
2. When a deposit/withdrawal happens, send HTTP POST to webhook
3. Discord displays formatted message in channel

**Example message:**
```
💰 Deposit detected!
Pool: USDC 100
Commitment: 0x1a2b3c...
Block: #12345
Time: Just now
```

**Implementation Steps:**

1. **Create Discord Webhook:**
   - Go to Discord Server → Settings → Integrations → Webhooks
   - Create new webhook
   - Copy webhook URL: `https://discord.com/api/webhooks/...`

2. **Add webhook config to backend:**
   ```bash
   # Add to backend/.env or Render environment variables
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
   ```

3. **Modify backend to send notifications:**
   - In `backend/src/indexer/index.ts`
   - Add webhook call in `processDeposit()` function
   - Add webhook call in `processWithdrawal()` function

---

### Option 2: Telegram Bot (Also Easy)

**How it works:**
1. Create Telegram bot via @BotFather
2. Get bot token
3. Get channel ID
4. Send messages via Telegram Bot API

**Implementation:**
- Use Telegram Bot API: `https://api.telegram.org/bot<token>/sendMessage`
- Send formatted messages when events occur

---

### Option 3: WebSocket/SSE Stream (Advanced)

**How it works:**
1. Create new API endpoint: `GET /api/events/stream`
2. Clients connect and receive real-time events
3. Your bot/script listens and forwards to Discord/Telegram

**Use cases:**
- Multiple channels want the feed
- Custom filtering/formatting
- Real-time dashboard

---

## Quick Implementation: Discord Webhook

Here's what needs to be added:

### 1. Add webhook helper function

```typescript
// backend/src/utils/webhooks.ts
async function sendDiscordWebhook(webhookUrl: string, message: any) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('[Webhook] Failed to send:', error);
  }
}

export async function notifyDeposit(data: {
  poolAddress: string;
  commitment: string;
  leafIndex: number;
  blockNumber: bigint;
  token?: string;
  amount?: number;
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  // Format message
  const message = {
    embeds: [{
      title: '💰 New Deposit',
      color: 0xC2A633, // Dogenado gold
      fields: [
        { name: 'Pool', value: `${data.token || 'Unknown'} ${data.amount || ''}`, inline: true },
        { name: 'Commitment', value: `\`${data.commitment.slice(0, 16)}...\``, inline: true },
        { name: 'Block', value: `#${data.blockNumber}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Dogenado Privacy Pool' },
    }],
  };

  await sendDiscordWebhook(webhookUrl, message);
}

export async function notifyWithdrawal(data: {
  poolAddress: string;
  nullifierHash: string;
  recipient: string;
  relayer: string;
  fee: string;
  blockNumber: bigint;
  token?: string;
  amount?: number;
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const message = {
    embeds: [{
      title: '💸 New Withdrawal',
      color: 0x00FF00, // Green
      fields: [
        { name: 'Pool', value: `${data.token || 'Unknown'} ${data.amount || ''}`, inline: true },
        { name: 'Recipient', value: `\`${data.recipient.slice(0, 10)}...\``, inline: true },
        { name: 'Relayer Fee', value: `${data.fee}`, inline: true },
        { name: 'Block', value: `#${data.blockNumber}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Dogenado Privacy Pool' },
    }],
  };

  await sendDiscordWebhook(webhookUrl, message);
}
```

### 2. Modify indexer to call webhooks

In `backend/src/indexer/index.ts`:

```typescript
import { notifyDeposit, notifyWithdrawal } from '../utils/webhooks.js';

// In processDeposit function:
function processDeposit(...) {
  // ... existing code ...
  
  console.log(`[Indexer] Deposit: ${commitment.slice(0, 10)}... at index ${leafIndex}`);
  
  // Send Discord notification
  notifyDeposit({
    poolAddress,
    commitment,
    leafIndex: Number(leafIndex),
    blockNumber,
    // TODO: Get token/amount from pool config
  });
}

// In processWithdrawal function:
function processWithdrawal(...) {
  // ... existing code ...
  
  // Send Discord notification (need to get full withdrawal data)
  // Note: You'll need to capture more data from the withdrawal event
}
```

---

## Privacy Considerations ⚠️

**Important:** Since this is a **privacy pool**, be careful what you expose:

### ✅ Safe to Share:
- Deposit/withdrawal **counts** (anonymity set size)
- **Pool** (token + amount)
- **Block numbers** (already public)
- **Timestamps** (approximate, already public)

### ⚠️ Be Careful:
- Commitment hashes (not secret, but avoid highlighting specific ones)
- Nullifier hashes (reveals which withdrawal happened, but not who)

### ❌ Never Share:
- User wallet addresses
- Secret/nullifier values
- Links between deposits and withdrawals

**Suggested format:**
- "New deposit to USDC 100 pool (anonymity set now: 42)"
- "Withdrawal processed from WDOGE 1000 pool"
- Aggregate stats: "10 deposits today, 5 withdrawals"

---

## Example Discord Message Format

```
🔒 Dogenado Activity

💰 Deposit
Pool: USDC 100
Anonymity Set: 42 → 43
Block: #123456
```

Or aggregated hourly:
```
📊 Hourly Summary (2:00 PM - 3:00 PM)
• 5 deposits (2 USDC, 3 WDOGE)
• 2 withdrawals
• Total volume: ~$500
```

---

## Next Steps

1. **Choose your platform:** Discord webhook (easiest) or Telegram bot
2. **Set up webhook/bot:** Get the URL/token
3. **I can help you:**
   - Add the webhook code to your backend
   - Format messages nicely
   - Add filtering (only certain pools, aggregates, etc.)
   - Test it

Would you like me to implement the Discord webhook integration now?

