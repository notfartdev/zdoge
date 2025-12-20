---
id: withdraw
title: How to Withdraw
sidebar_position: 3
---

# How to Withdraw

Withdrawing from Dogenado allows you to receive your tokens at any address without revealing a connection to your original deposit.

## Before You Start

Ensure you have:
- Your secret deposit note
- A recipient wallet address
- No wallet connection required (for maximum privacy)

:::info Privacy Note
You don't need to connect a wallet to withdraw. The withdrawal is processed by the Dogenado service, preserving your anonymity.
:::

## Step-by-Step Guide

### 1. Navigate to Withdraw

Go to the **Withdraw** section in the dashboard.

### 2. Paste Your Note

Enter your complete secret note:

```
dogenado-usdc100-1-0xabc123...xyz789
```

### 3. Verify Note

Click **"Verify Note"** to validate:
- Note format is correct
- Deposit exists in the pool
- Note hasn't been used

You'll see the deposit details:

| Field | Example |
|-------|---------|
| Token | USDC |
| Amount | 100 |
| Status | Valid, not withdrawn |

### 4. Enter Recipient Address

Enter the wallet address to receive the funds.

:::tip Fresh Address
For maximum privacy, use a fresh wallet address that has never been associated with your identity.
:::

### 5. Choose Withdrawal Timing

Select when to process the withdrawal:

| Option | Delay | Privacy Level |
|--------|-------|---------------|
| **Instant** | None | Standard |
| **1 Hour** | 3,600 seconds | Enhanced |
| **24 Hours** | 86,400 seconds | Maximum |

Delayed withdrawals use the on-chain timelock for additional security.

### 6. Review Breakdown

Before confirming, review the fee breakdown:

```
Withdrawal Summary
──────────────────────────────
Pool Amount:        100.00 USDC
Service Fee (0.5%):  -0.50 USDC
──────────────────────────────
You Receive:         99.50 USDC
                    (~$99.50)
```

### 7. Confirm Withdrawal

Click **"Withdraw"** to begin the process:

1. **Generating Proof** (30-60 seconds)
   - A zero-knowledge proof is generated in your browser
   - This proves you own a valid deposit without revealing which one

2. **Submitting Transaction**
   - The proof is submitted to the blockchain
   - Transaction is processed

3. **Confirmation**
   - You'll see a success message with the transaction hash

## Scheduled Withdrawals

If you chose a delayed withdrawal:

1. After proof generation, withdrawal is **scheduled**
2. Check the **Inbox** for pending withdrawals
3. After the delay period, click **"Execute"** to complete

```
Scheduled Withdrawal
────────────────────
Status: Pending
Execute After: Dec 21, 2025 3:00 PM
Amount: 99.50 USDC
```

## Fee Structure

| Fee Type | Amount | Purpose |
|----------|--------|---------|
| Service Fee | 0.5% | Protocol operation & gas costs |

:::info Example
Depositing 1000 USDC → Withdrawing 995 USDC (0.5% = 5 USDC fee)
:::

## Troubleshooting

### "Note already spent"

This note has already been used for a withdrawal. Each note can only be used once.

### "Invalid note format"

Check that you copied the complete note including the `dogenado-` prefix.

### "Proof generation failed"

- Refresh the page and try again
- Ensure you're using a modern browser (Chrome, Firefox, Edge)
- Check that JavaScript is enabled

### "Recipient address invalid"

Ensure the address:
- Starts with `0x`
- Is 42 characters long
- Is a valid Ethereum-compatible address

## Privacy Best Practices

1. **Use a VPN or Tor** when withdrawing
2. **Wait for more deposits** before withdrawing
3. **Use a fresh recipient address**
4. **Don't withdraw the exact amount you deposited** across multiple transactions
5. **Vary withdrawal timing** - don't create patterns

---

**Next Step:** [Check Note Status](/user-guide/check-status)

