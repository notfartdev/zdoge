---
id: supported-tokens
title: Supported Tokens
sidebar_position: 2
---

# Supported Tokens

zDoge supports multiple tokens with **variable amounts** - you can shield any amount of any supported token.

## Token Overview

| Token | Symbol | Decimals | Type |
|-------|--------|----------|------|
| Dogecoin | DOGE | 18 | Native token |
| USD Coin | USDC | 18 | Stablecoin (18 decimals on DogeOS) |
| Tether | USDT | 18 | Stablecoin (18 decimals on DogeOS) |
| USD1 | USD1 | 18 | Stablecoin |
| Wrapped Ether | WETH | 18 | Wrapped ETH |
| Liquid Bitcoin | LBTC | 18 | Wrapped BTC (18 decimals on DogeOS) |

## Variable Amount Support

Unlike traditional mixers with fixed denominations, zDoge supports **any amount**:

- ✅ Shield 1 DOGE or 1000 DOGE
- ✅ Shield 0.5 USDC or 5000 USDC
- ✅ Shield any amount you need

This flexibility makes zDoge suitable for:
- Small everyday transactions
- Large value transfers
- Any use case you need

## Token Details

### Native DOGE

The native Dogecoin token on DogeOS. No wrapping required - shield DOGE directly.

**Features:**
- Native token support
- No wrapping fees
- Direct shielding

### USDC (USD Coin)

A stablecoin pegged to the US Dollar. 18 decimals on DogeOS (not 6 like on Ethereum mainnet).

**Use Cases:**
- Stable value transfers
- Privacy for USD-denominated transactions
- Cross-chain privacy

### USDT (Tether)

Another stablecoin pegged to the US Dollar. 18 decimals on DogeOS.

**Use Cases:**
- Alternative stablecoin option
- Privacy for USD-denominated transactions
- High liquidity

### USD1

A stablecoin on DogeOS. 18 decimals.

**Use Cases:**
- DogeOS-native stablecoin
- Privacy for local transactions

### WETH (Wrapped Ether)

Wrapped Ethereum on DogeOS. 18 decimals.

**Use Cases:**
- Privacy for ETH holdings
- Cross-chain privacy
- DeFi integration

### LBTC (Liquid Bitcoin)

Wrapped Bitcoin on DogeOS. 18 decimals on DogeOS (not 8 like native Bitcoin).

**Use Cases:**
- Privacy for BTC holdings
- Cross-chain privacy
- Large value transfers

## Getting Tokens

### On DogeOS Testnet

For testnet, you can get tokens from:
- [DogeOS Testnet Faucet](https://faucet.testnet.dogeos.com)
- Testnet token bridges
- Testnet exchanges

### Token Bridges

| From | To | Bridge |
|------|-----|--------|
| Ethereum | DogeOS | Official Bridge |
| BSC | DogeOS | Official Bridge |

## Token Standards

All tokens on zDoge are **ERC-20 compatible**:

```solidity
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}
```

## Choosing Tokens

### Factors to Consider

1. **Liquidity**
   - More liquid tokens = better swap rates
   - Popular tokens = larger anonymity sets

2. **Use Case**
   - Stablecoins for stable value
   - Native DOGE for direct use
   - Wrapped tokens for cross-chain

3. **Privacy Needs**
   - All tokens offer the same privacy level
   - Choose based on your needs

### Recommendations

| Use Case | Recommended Token |
|----------|------------------|
| Everyday transactions | DOGE, USDC, USDT |
| Stable value | USDC, USDT, USD1 |
| Large transfers | DOGE, WETH, LBTC |
| Cross-chain privacy | WETH, LBTC |

## Adding New Tokens

The community may propose new tokens via governance (future feature).

Requirements for new tokens:
- ERC-20 compliant
- Sufficient liquidity
- Community demand
- Security audit

---

**See also:** [Contract Addresses](/resources/contract-addresses)
