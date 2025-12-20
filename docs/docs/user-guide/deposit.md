---
id: deposit
title: How to Deposit
sidebar_position: 2
---

# How to Deposit

Depositing tokens into Dogenado is the first step to achieving transaction privacy.

## Before You Start

Ensure you have:
- ✅ Connected wallet on DogeOS
- ✅ Sufficient token balance for deposit
- ✅ Small amount of DOGE for gas fees

## Step-by-Step Guide

### 1. Select Token

In the Deposit section, use the dropdown to select your token.

Supported tokens:
- **USDC** - USD Coin
- **USDT** - Tether
- **USD1** - USD1 Stablecoin
- **WDOGE** - Wrapped DOGE
- **WETH** - Wrapped Ether
- **LBTC** - Wrapped Bitcoin

### 2. Select Pool Amount

Choose a pool denomination. Larger pools often have better anonymity sets:

| Token | Available Pools |
|-------|-----------------|
| USDC | 1, 10, 100, 1000 |
| USDT | 1, 10, 100, 1000 |
| USD1 | 1, 10, 100, 1000 |
| WDOGE | 100, 1,000, 10,000, 100,000 |
| WETH | 0.01, 0.1, 1, 10 |
| LBTC | 0.001, 0.01, 0.1, 1 |

### 3. Approve Token Spending

If this is your first deposit of this token, you'll need to approve the contract to spend your tokens:

1. Click **"Approve"**
2. Confirm the transaction in your wallet
3. Wait for confirmation

:::tip
You only need to approve once per token. Future deposits will skip this step.
:::

### 4. Complete Deposit

1. Click **"Deposit"**
2. Confirm the transaction in your wallet
3. Wait for confirmation (usually 10-30 seconds)

### 5. Save Your Note

After the deposit confirms, you'll receive a **secret note**:

```
dogenado-usdc100-1-0xabc123...xyz789
```

:::danger CRITICAL - SAVE YOUR NOTE
This note is the **ONLY** way to withdraw your funds. 
- Copy it immediately
- Store it securely (password manager, encrypted file)
- Never share it with anyone
- If lost, funds are **permanently unrecoverable**
:::

## Understanding Your Note

The note contains encoded information:

```
dogenado-[token][amount]-[network]-0x[data]
```

| Part | Meaning |
|------|---------|
| `dogenado` | Protocol identifier |
| `usdc100` | Token and amount (100 USDC) |
| `1` | Network ID |
| `0x...` | Encrypted commitment, nullifier, and secret |

## What Happens After Deposit

1. Your tokens are locked in the smart contract
2. Your commitment is added to the Merkle tree
3. The deposit event is recorded on-chain
4. Your deposit joins the anonymity set

## Viewing Deposit History

Check your deposit history in the **Inbox** section. You can see:
- Transaction hash (clickable to explorer)
- Pool and amount
- Timestamp
- Commitment (truncated)

## Tips for Better Privacy

1. **Choose popular pools** - Larger anonymity sets are better
2. **Wait before withdrawing** - Let more deposits accumulate
3. **Use different amounts** - Don't create patterns
4. **Don't rush** - Patience improves privacy

---

**Next Step:** [How to Withdraw](/user-guide/withdraw)

