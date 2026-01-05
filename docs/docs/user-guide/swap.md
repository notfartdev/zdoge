---
id: swap
title: How to Swap Tokens
sidebar_position: 4
---

# How to Swap Tokens

Swapping tokens in zDoge allows you to exchange one token for another **privately within the shielded layer**. All swaps are completely private - no one can see what tokens you're swapping or the amounts.

## Before You Start

Ensure you have:
- Shielded balance of the input token
- Sufficient amount to swap
- Small amount of DOGE for gas (if not using relayer)

## Step-by-Step Guide

### 1. Navigate to Swap

Go to the **Swap** section in the dashboard.

### 2. Select Input Token

Choose the token you want to swap FROM (the token you're spending).

### 3. Select Output Token

Choose the token you want to swap TO (the token you're receiving).

:::info Supported Pairs
You can swap between any supported tokens:
- DOGE ↔ USDC
- DOGE ↔ USDT
- USDC ↔ USDT
- And more...
:::

### 4. Enter Amount

Enter the amount of input token you want to swap. The system will:
- Calculate the output amount based on current rates
- Show the exchange rate
- Display estimated fees

### 5. Review Swap Details

Before confirming, review:
- **Input amount**: What you're spending
- **Output amount**: What you'll receive
- **Exchange rate**: Current rate between tokens
- **Relayer fee**: Fee for gasless transaction (if using relayer)

### 6. Generate Proof

Click **"Swap"** to begin:

1. **Generating Proof** (30-60 seconds)
   - A zero-knowledge proof is generated in your browser
   - This proves you own valid notes without revealing which ones

2. **Submitting Transaction**
   - The proof is submitted to the blockchain
   - Transaction is processed (directly or via relayer)

3. **Confirmation**
   - You'll see a success message with the transaction hash
   - New output token note is automatically added to your wallet

### 7. Success!

After swap confirms:
- ✅ Success message
- Transaction hash (clickable to explorer)
- Updated balances (input token decreased, output token increased)

## Understanding Swaps

Swaps work by:
1. **Spending** your input token note
2. **Creating** a new output token note
3. **Maintaining privacy** - no one can see what you swapped

All swaps happen within the shielded layer - completely private!

## Exchange Rates

Exchange rates are determined by:
- Current market prices
- Token liquidity
- Protocol fees

Rates are updated in real-time and shown before you confirm.

## Fee Structure

When using the relayer (gasless transactions):

| Fee Type | Amount | Purpose |
|----------|--------|---------|
| Relayer Fee | ~0.5% | Gas costs & service |

:::tip Direct Transactions
You can also submit transactions directly (without relayer) to avoid fees, but you'll need DOGE for gas.
:::

## Privacy Features

Private swaps hide:
- ✅ **Input token** - No one knows what you're spending
- ✅ **Output token** - No one knows what you're receiving
- ✅ **Amounts** - Both input and output amounts are hidden
- ✅ **Transaction link** - No way to link swap to your identity

## Use Cases

Swaps are useful for:
- **Privacy-preserving conversions** - Change tokens without revealing
- **Portfolio rebalancing** - Adjust holdings privately
- **Arbitrage opportunities** - Take advantage of price differences
- **Token diversification** - Spread holdings across tokens

## Troubleshooting

### "Insufficient shielded balance"

You don't have enough shielded tokens of the input type. Shield more tokens first.

### "Exchange rate unavailable"

- Refresh the page and try again
- Check that price data is available
- Try a different token pair

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

1. **Vary swap amounts** - Don't create patterns
2. **Wait between swaps** - Don't rush
3. **Use different token pairs** - Diversify
4. **Don't link transactions** - Keep swaps independent

---

**Next Step:** [How to Unshield](/user-guide/unshield)

