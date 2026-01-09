---
id: intro
title: Introduction
slug: /
sidebar_position: 1
---

<div className="hero-banner">
  <img src="/img/dogenadobanner.png" alt="zDoge - Shielded Transactions for DogeOS" />
</div>

# Introduction to zDoge

**zDoge** is a **non-custodial privacy protocol** enabling **permissionless shielded transactions** on DogeOS (Dogecoin Layer 2). A Zcash-style shielded transaction system enabling private payments with variable amounts.

:::info What is zDoge?
zDoge is a privacy protocol that uses zero-knowledge proofs (zkSNARKs) to enable anonymous token transfers. You can shield tokens (convert public tokens to private shielded notes), transfer tokens privately between shielded addresses, swap tokens within the shielded layer, and unshield tokens back to public addresses - all with complete privacy.
:::

## How Privacy is Achieved

zDoge achieves anonymity through **shielded transactions** using zero-knowledge proofs:

1. **Shield**: Convert public tokens to private shielded notes (any amount)
2. **Transfer**: Send tokens privately between shielded addresses (z→z)
3. **Swap**: Exchange tokens within the shielded layer (z→z)
4. **Unshield**: Convert shielded notes back to public tokens (z→t)

All transactions hide sender, recipient, and amount on-chain. The system uses encrypted memos for auto-discovery, so recipients automatically receive incoming transfers.

## Key Features

| Feature | Description |
|---------|-------------|
| **Zero-Knowledge Proofs** | Mathematical guarantees that no one can link transactions |
| **Variable Amounts** | Shield any amount - no fixed denominations required |
| **Private Transfers** | Send tokens privately between shielded addresses |
| **Auto-Discovery** | Recipients automatically discover incoming transfers |
| **Token Swaps** | Swap tokens privately within the shielded layer |
| **Non-Custodial** | You always control your funds via your spending key |
| **Fast Transactions** | Built on DogeOS for quick, low-cost transactions |
| **Multi-Token Support** | Privacy for DOGE, USDC, USDT, USD1, WETH, and LBTC |
| **Smart Error Messages** | Context-aware error suggestions help resolve common issues |
| **Transaction History** | Track all your shielded transactions locally |
| **Note Management** | View, filter, and manage your shielded notes |
| **Estimated Fees** | See transaction fees before confirming |
| **Progress Tracking** | Real-time progress for proof generation and transactions |

## Network Status

:::caution Testnet Phase
zDoge is currently live on **DogeOS Testnet** as we prepare for the upcoming **Doge zkEVM Mainnet** launch. All features are fully functional for testing purposes.
:::

**Current deployment:**
- **DogeOS Testnet** — Live and fully operational
- **Doge zkEVM Mainnet** — Coming soon

## Supported Tokens

zDoge supports multiple tokens with **variable amounts** (any amount can be shielded):

| Token | Symbol | Type |
|-------|--------|------|
| Dogecoin | DOGE | Native token |
| USD Coin | USDC | Stablecoin (18 decimals on DogeOS) |
| Tether | USDT | Stablecoin (18 decimals on DogeOS) |
| USD1 | USD1 | Stablecoin |
| Wrapped Ether | WETH | Wrapped ETH |
| Liquid Bitcoin | LBTC | Wrapped BTC (18 decimals on DogeOS) |

## Fee Structure

zDoge charges a **relayer fee** on transactions (when using the relayer service) to cover:
- Gas costs for transaction processing
- Infrastructure maintenance
- Protocol development

The fee is typically 0.5% of the transaction amount, with a minimum fee to ensure profitability.

:::tip Example
If you transfer 100 DOGE using the relayer:
- **Gross amount**: 100 DOGE
- **Relayer fee (0.5%)**: 0.5 DOGE
- **Recipient receives**: 99.5 DOGE
:::

## Getting Started

Ready to start using zDoge? Follow these guides:

1. [Connect Your Wallet](/user-guide/connect-wallet)
2. [Shield Tokens](/user-guide/shield)
3. [Send Privately](/user-guide/transfer)
4. [Unshield Tokens](/user-guide/unshield)

---

:::warning Important
Before using zDoge, please review the [Trust Model](/resources/trust-model) to understand what is cryptographically enforced and what requires trust. Also read the [Disclaimer](/disclaimer) for important legal and risk information.
:::

:::caution Testnet = Experimental
**zDoge is currently on testnet** - this is experimental software. Learn more about what you must trust in our [Trust Model documentation](/resources/trust-model).
:::
