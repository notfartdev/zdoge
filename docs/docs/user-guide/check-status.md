---
id: check-status
title: Check Transaction Status
sidebar_position: 6
---

# Check Transaction Status

View your transaction history and verify the status of your shielded transactions in the Activity page.

## Viewing Transaction History

### 1. Navigate to Activity

Go to the **Activity** section in the dashboard.

### 2. View All Transactions

The Activity page shows all your shielded transactions:
- **Shield** - Public → Private conversions
- **Transfer** - Private → Private sends
- **Swap** - Token swaps within shielded layer
- **Unshield** - Private → Public conversions

### 3. Transaction Details

Each transaction shows:
- **Type** - Shield, Transfer, Swap, or Unshield
- **Token** - Token involved
- **Amount** - Transaction amount
- **Status** - Pending, Confirmed, or Failed
- **Timestamp** - When transaction occurred
- **Transaction Hash** - Clickable link to block explorer

## Transaction Statuses

### Pending

Transaction has been submitted but not yet confirmed on-chain.

**What to do:**
- Wait for confirmation (usually 10-30 seconds)
- Check the transaction hash on the explorer
- Refresh the page

### Confirmed

Transaction has been confirmed on-chain and is final.

**What you'll see:**
- ✅ Success indicator
- Transaction hash (clickable)
- Updated balances

### Failed

Transaction failed for some reason.

**Common causes:**
- Insufficient gas
- Relayer out of funds
- Network congestion
- Invalid proof

**What to do:**
- Check the error message
- Try again
- Contact support if persistent

## Viewing on Block Explorer

Click any transaction hash to view it on the block explorer:
- Transaction details
- Block number
- Gas used
- Event logs

## Privacy Note

:::info Transaction History
Your transaction history is stored locally and synced to the backend. Only you can see your full transaction history. The blockchain only shows that transactions occurred, not who made them.
:::

## Troubleshooting

### "Transactions not showing"

- Refresh the page
- Check that you're connected with the correct wallet
- Ensure backend is accessible

### "Transaction stuck on pending"

- Check the transaction hash on the explorer
- Network may be congested
- Wait a few minutes and refresh

### "Missing transactions"

- Check if transaction was successful on explorer
- Try syncing with backend
- Contact support if issue persists

---

**Next:** [Tips for Anonymity](/user-guide/tips-anonymity)
