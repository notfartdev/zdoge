---
id: transfer
title: How to Transfer Privately
sidebar_position: 3
---

# How to Transfer Privately

Transferring tokens privately in zDoge allows you to send tokens between shielded addresses without revealing sender, recipient, or amount on-chain.

## Before You Start

Ensure you have:
- Shielded balance (at least one shielded note)
- Recipient's shielded address (zdoge:...)
- Small amount of DOGE for gas (if not using relayer)

## Step-by-Step Guide

### 1. Navigate to Send

Go to the **Send** section in the dashboard.

### 2. Select Token

Choose the token you want to send from the dropdown.

### 3. Enter Recipient Address

Enter the recipient's shielded address. It should start with `zdoge:`:

```
zdoge:1692ef053331b2a1369a0ae03a5f38156e6c31bd2a9bb16e9c2dfdb237c8037a
```

:::tip Getting Shielded Address
The recipient can find their shielded address in the **Receive** section of their wallet.
:::

### 4. Enter Amount

Enter the amount you want to send. The system will:
- Automatically select notes to spend
- Calculate change (if needed)
- Show the relayer fee (if using relayer)

:::info Automatic Note Selection
The system automatically selects the best notes to spend, similar to Bitcoin's UTXO model. You don't need to manually choose notes.
:::

### 5. Review Transaction

Before confirming, review:
- **Amount to send**: What recipient will receive
- **Relayer fee**: Fee for gasless transaction (if using relayer)
- **Change**: Amount returned to you (if any)
- **Total cost**: Amount deducted from your shielded balance

### 6. Generate Proof

Click **"Send"** to begin:

1. **Generating Proof** (30-60 seconds)
   - A zero-knowledge proof is generated in your browser
   - This proves you own valid notes without revealing which ones
   - Encrypted memo is created for recipient

2. **Submitting Transaction**
   - The proof is submitted to the blockchain
   - Transaction is processed (directly or via relayer)

3. **Confirmation**
   - You'll see a success message with the transaction hash
   - Change note (if any) is automatically added to your wallet

## Auto-Discovery for Recipient

The recipient doesn't need to do anything! Their wallet will:

1. **Scan for new transfers** automatically
2. **Decrypt the memo** using their spending key
3. **Add the note** to their wallet
4. **Update balance** automatically
5. **Show notification** when received

:::success Privacy
The recipient's wallet automatically discovers incoming transfers via encrypted memos. No manual note sharing required!
:::

## Understanding Encrypted Memos

Each transfer includes an encrypted memo containing:
- Note details (amount, token, secret, blinding)
- Ephemeral public key
- Encrypted with recipient's shielded address

Only the recipient can decrypt the memo using their spending key.

## Fee Structure

When using the relayer (gasless transactions):

| Fee Type | Amount | Purpose |
|----------|--------|---------|
| Relayer Fee | ~0.5% | Gas costs & service |

:::tip Direct Transactions
You can also submit transactions directly (without relayer) to avoid fees, but you'll need DOGE for gas.
:::

## Privacy Features

Private transfers hide:
- **Sender identity** - No on-chain link to your address
- **Recipient identity** - Recipient address is hidden
- **Transaction amount** - Amount is encrypted
- **Transaction link** - No way to link sender and recipient

## Troubleshooting

### "Insufficient shielded balance"

You don't have enough shielded tokens. Shield more tokens first.

### "Invalid recipient address"

Ensure the address:
- Starts with `zdoge:`
- Is a valid shielded address format
- Belongs to the recipient

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

1. **Use fresh recipient addresses** - Don't reuse addresses
2. **Vary amounts** - Don't create patterns
3. **Wait between transactions** - Don't rush
4. **Use VPN or Tor** - Additional privacy layer
5. **Don't link transactions** - Keep transfers independent

---

**Next Step:** [How to Unshield](/user-guide/unshield)

