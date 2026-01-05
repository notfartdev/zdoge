---
id: shield
title: How to Shield
sidebar_position: 2
---

# How to Shield

Shielding tokens in zDoge converts your public tokens to private shielded notes. This is the first step to achieving transaction privacy.

## Before You Start

Ensure you have:
- Connected wallet on DogeOS
- Sufficient token balance to shield
- Small amount of DOGE for gas fees (if not using relayer)

## Step-by-Step Guide

### 1. Navigate to Shield

Go to the **Shield** section in the dashboard.

### 2. Select Token

Use the dropdown to select the token you want to shield.

Supported tokens:
- **DOGE** - Native Dogecoin
- **USDC** - USD Coin
- **USDT** - Tether
- **USD1** - USD1 Stablecoin
- **WETH** - Wrapped Ether
- **LBTC** - Liquid Bitcoin

### 3. Enter Amount

Enter the amount you want to shield. **Any amount is supported** - there are no fixed denominations.

:::tip Variable Amounts
Unlike traditional mixers, zDoge supports any amount. Shield 1 DOGE, 100 DOGE, or 1000 DOGE - whatever you need!
:::

### 4. Check Balance

The interface will show:
- Your public balance
- Your shielded balance
- The amount you're about to shield

:::warning Balance Validation
The system will prevent you from shielding more than your available balance. For native DOGE, a small amount (0.001 DOGE) is reserved for gas fees.
:::

### 5. Approve Token Spending (ERC20 only)

If shielding an ERC20 token (USDC, USDT, etc.) and this is your first time, you'll need to approve the contract:

1. Click **"Approve"**
2. Confirm the transaction in your wallet
3. Wait for confirmation

:::tip
You only need to approve once per token. Future shields will skip this step.
:::

### 6. Complete Shield

1. Click **"Shield"**
2. Confirm the transaction in your wallet
3. Wait for confirmation (usually 10-30 seconds)

You'll see progress indicators:
- **Step 1 of 2**: Preparing transaction
- **Step 2 of 2**: Confirming on-chain

### 7. Success!

After the shield confirms, you'll see:
- ✅ Success message
- Transaction hash (clickable to explorer)
- Updated shielded balance

Your note is automatically stored in your wallet and synced to the backend.

## Understanding Shielded Notes

Shielded notes are stored locally in your wallet and contain:
- **Amount**: The shielded amount
- **Token**: The token type
- **Commitment**: Cryptographic commitment in the Merkle tree
- **Leaf Index**: Position in the Merkle tree
- **Secret & Blinding**: Private values for spending

:::info Auto-Storage
Your notes are automatically stored and synced. You don't need to manually save them like in traditional mixers.
:::

## What Happens After Shield

1. Your tokens are locked in the smart contract
2. Your commitment is added to the Merkle tree
3. The Shield event is recorded on-chain
4. Your note is stored in your wallet
5. Your shielded balance updates automatically

## Viewing Shielded Balance

Check your shielded balance in the **Shield** section header. You'll see:
- Total shielded balance per token
- Breakdown by token type
- USD value (if price data available)

## Tips for Better Privacy

1. **Shield in batches** - Don't shield everything at once
2. **Vary amounts** - Don't create patterns
3. **Wait before transferring** - Let more notes accumulate
4. **Use different tokens** - Diversify your shielded portfolio

---

**Next Step:** [How to Transfer Privately](/user-guide/transfer)

