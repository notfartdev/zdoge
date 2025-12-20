---
id: intro
title: Introduction
slug: /
sidebar_position: 1
---

<div className="hero-banner">
  <img src="/img/dogenadobanner.png" alt="DogenadoCash - Privacy Protocol for DogeOS" />
</div>

# Introduction to DogenadoCash

**DogenadoCash** is a **non-custodial privacy protocol** enabling **permissionless shielded transactions** on DogeOS (Dogecoin Layer 2). A decentralized privacy protocol enabling private transactions on Doge.

:::info What is DogenadoCash?
DogenadoCash is a privacy protocol that uses zero-knowledge proofs (zkSNARKs) to enable anonymous token transfers. When you deposit tokens, you receive a secret note. This note can be used to withdraw to any address without revealing the connection to your original deposit.
:::

## How Privacy is Achieved

DogenadoCash achieves anonymity by breaking the on-chain link between source and destination addresses through **anonymity pools**:

1. **Deposit**: You deposit a fixed amount of tokens into a pool and receive a secret note
2. **Wait**: Your deposit joins other deposits in the anonymity set
3. **Withdraw**: Use your secret note to withdraw to any address - the blockchain cannot link it to your deposit

The larger the anonymity set (more deposits), the stronger the privacy guarantee.

## Key Features

| Feature | Description |
|---------|-------------|
| **Zero-Knowledge Proofs** | Mathematical guarantees that no one can link deposits to withdrawals |
| **Non-Custodial** | You always control your funds via your secret note |
| **Fast Transactions** | Built on DogeOS for quick, low-cost transactions |
| **Multi-Token Support** | Privacy for USDC, USDT, USD1, WDOGE, WETH, and LBTC |
| **Optional Timelock** | Enhanced security with scheduled withdrawals |

## Network Status

:::caution Testnet Phase
DogenadoCash is currently live on **DogeOS Testnet** as we prepare for the upcoming **Doge zkEVM Mainnet** launch. All features are fully functional for testing purposes.
:::

**Current deployment:**
- **DogeOS Testnet** — Live and fully operational
- **Doge zkEVM Mainnet** — Coming soon

## Supported Tokens & Pools

Each token has multiple pool denominations to choose from:

| Token | Pool Amounts |
|-------|--------------|
| USDC | 1, 10, 100, 1000 |
| USDT | 1, 10, 100, 1000 |
| USD1 | 1, 10, 100, 1000 |
| WDOGE | 100, 1000, 10000, 100000 |
| WETH | 0.01, 0.1, 1, 10 |
| LBTC | 0.001, 0.01, 0.1, 1 |

## Fee Structure

DogenadoCash charges a **0.5% service fee** on withdrawals to cover:
- Gas costs for transaction processing
- Infrastructure maintenance
- Protocol development

:::tip Example
If you deposit 100 USDC and withdraw:
- **Gross amount**: 100 USDC
- **Service fee (0.5%)**: 0.5 USDC
- **You receive**: 99.5 USDC
:::

## Getting Started

Ready to start using DogenadoCash? Follow these guides:

1. [Connect Your Wallet](/user-guide/connect-wallet)
2. [Make a Deposit](/user-guide/deposit)
3. [Withdraw Anonymously](/user-guide/withdraw)

---

:::warning Disclaimer
DogenadoCash is provided as-is. Users are responsible for understanding local regulations regarding privacy protocols. Always secure your secret notes - if lost, funds cannot be recovered.
:::
