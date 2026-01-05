---
id: unshield
title: How to Unshield
sidebar_position: 4
---

# How to Unshield

Unshielding tokens in zDoge converts your private shielded notes back to public tokens that can be sent to any address.

## Before You Start

Ensure you have:
- Shielded balance (at least one shielded note)
- Recipient public wallet address (0x...)
- Small amount of DOGE for gas (if not using relayer)

## Step-by-Step Guide

### 1. Navigate to Unshield

Go to the **Unshield** section in the dashboard.

### 2. Select Token

Choose the token you want to unshield from the dropdown.

### 3. Enter Amount

Enter the amount you want to unshield. The system will:
- Automatically select notes to spend
- Calculate the relayer fee (if using relayer)
- Show the amount you'll receive

:::info Note Consolidation
If you have multiple small notes, the system may consolidate them into fewer transactions for efficiency.
:::

### 4. Enter Recipient Address

Enter the public wallet address (0x...) where you want to receive the tokens.

:::tip Fresh Address
For maximum privacy, use a fresh wallet address that has never been associated with your identity.
:::

### 5. Review Transaction

Before confirming, review:
- **Amount to unshield**: What you're spending
- **Relayer fee**: Fee for gasless transaction (if using relayer)
- **Amount received**: What you'll receive after fees
- **Recipient**: Where tokens will be sent

### 6. Generate Proof

Click **"Unshield"** to begin:

1. **Generating Proof** (30-60 seconds)
   - A zero-knowledge proof is generated in your browser
   - This proves you own valid notes without revealing which ones

2. **Submitting Transaction**
   - The proof is submitted to the blockchain
   - Transaction is processed (directly or via relayer)

3. **Confirmation**
   - You'll see a success message with the transaction hash
   - Tokens are sent to your recipient address

### 7. Success!

After unshield confirms:
- ✅ Success message
- Transaction hash (clickable to explorer)
- Updated balances (shielded decreased, public increased)

## Note Consolidation

If you have multiple small notes, the system may:
1. **Spend multiple notes** in one transaction
2. **Consolidate** into fewer, larger notes
3. **Show multiple transaction hashes** if consolidation occurs

This is normal and improves efficiency.

## Fee Structure

When using the relayer (gasless transactions):

| Fee Type | Amount | Purpose |
|----------|--------|---------|
| Relayer Fee | ~0.5% | Gas costs & service |

:::tip Direct Transactions
You can also submit transactions directly (without relayer) to avoid fees, but you'll need DOGE for gas.
:::

## What Happens After Unshield

1. Your shielded notes are spent (nullifiers marked)
2. Tokens are transferred to recipient address
3. Your shielded balance decreases
4. Recipient's public balance increases
5. Transaction is recorded on-chain (but unlinkable to your shield)

## Privacy Considerations

Unshielding reveals:
- ⚠️ **Recipient address** - Public on-chain
- ⚠️ **Transaction time** - When unshield occurred
- ⚠️ **Amount** - How much was unshielded

To maintain privacy:
- Use fresh recipient addresses
- Wait between shield and unshield
- Vary amounts
- Don't create patterns

## Troubleshooting

### "Insufficient shielded balance"

You don't have enough shielded tokens. Shield more tokens first.

### "Invalid recipient address"

Ensure the address:
- Starts with `0x`
- Is 42 characters long
- Is a valid Ethereum-compatible address

### "Proof generation failed"

- Refresh the page and try again
- Ensure you're using a modern browser
- Check that JavaScript is enabled
- Try a smaller amount

### "Transaction failed"

- Check your gas balance (if not using relayer)
- Ensure relayer has sufficient balance (if using relayer)
- Try again after a few minutes

## Privacy Best Practices

1. **Use fresh addresses** - Never reuse recipient addresses
2. **Wait before unshielding** - Let more notes accumulate
3. **Vary amounts** - Don't create patterns
4. **Don't link transactions** - Keep shield/unshield independent
5. **Use VPN or Tor** - Additional privacy layer

---

**Next Step:** [Check Transaction Status](/user-guide/check-status)

