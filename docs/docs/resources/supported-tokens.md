---
id: supported-tokens
title: Supported Tokens
sidebar_position: 2
---

# Supported Tokens

Dogenado supports multiple tokens with various pool denominations.

## Token Overview

| Token | Symbol | Decimals | Type |
|-------|--------|----------|------|
| USD Coin | USDC | 6 | Stablecoin |
| Tether | USDT | 6 | Stablecoin |
| USD1 | USD1 | 18 | Stablecoin |
| Wrapped DOGE | WDOGE | 18 | Wrapped Native |
| Wrapped Ether | WETH | 18 | Wrapped ETH |
| Liquid Bitcoin | LBTC | 8 | Wrapped BTC |

## Pool Denominations

### Stablecoins

Ideal for everyday transactions and privacy:

| Token | Pools |
|-------|-------|
| USDC | 1, 10, 100, 1,000 |
| USDT | 1, 10, 100, 1,000 |
| USD1 | 1, 10, 100, 1,000 |

### Wrapped DOGE

Privacy for DOGE holders:

| Pool | USD Equivalent* |
|------|-----------------|
| 100 WDOGE | ~$10 |
| 1,000 WDOGE | ~$100 |
| 10,000 WDOGE | ~$1,000 |
| 100,000 WDOGE | ~$10,000 |

*Approximate, based on current prices

### Wrapped ETH

Privacy for ETH on DogeOS:

| Pool | USD Equivalent* |
|------|-----------------|
| 0.01 WETH | ~$25 |
| 0.1 WETH | ~$250 |
| 1 WETH | ~$2,500 |
| 10 WETH | ~$25,000 |

### Liquid Bitcoin

Privacy for BTC holders:

| Pool | USD Equivalent* |
|------|-----------------|
| 0.001 LBTC | ~$40 |
| 0.01 LBTC | ~$400 |
| 0.1 LBTC | ~$4,000 |
| 1 LBTC | ~$40,000 |

## Choosing a Pool

### Factors to Consider

1. **Anonymity Set Size**
   - Popular pools have more deposits
   - More deposits = better privacy

2. **Your Amount**
   - Choose the largest pool that fits your needs
   - Larger pools often have bigger anonymity sets

3. **Waiting Time**
   - Busy pools accumulate deposits faster
   - Less waiting = quicker privacy

### Recommendations

| Use Case | Recommended Pool |
|----------|------------------|
| Small transfers | 10-100 USDC |
| Medium transfers | 100-1000 USDC |
| Large transfers | 1000+ USDC or WETH pools |
| BTC privacy | 0.1 LBTC |

## Getting Tokens

### On DogeOS Testnet

For testnet, you can get tokens from:
- DogeOS Testnet Faucet
- Testnet token bridges

### Token Bridges

| From | To | Bridge |
|------|-----|--------|
| Ethereum | DogeOS | Official Bridge |
| BSC | DogeOS | Official Bridge |

## Token Standards

All tokens on Dogenado are **ERC-20 compatible**:

```solidity
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}
```

## Adding New Tokens

The community may propose new tokens via governance (future feature).

Requirements for new tokens:
- ERC-20 compliant
- Sufficient liquidity
- Community demand
- Security audit

---

**See also:** [Contract Addresses](/resources/contract-addresses)

