---
id: contract-addresses
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

All Dogenado smart contracts deployed on DogeOS.

:::info Testnet
These addresses are for **DogeOS Testnet**. Mainnet addresses will be published when available.
:::

## Core Contracts

| Contract | Address |
|----------|---------|
| Verifier | `0xYourVerifierAddress` |
| Hasher | `0xYourHasherAddress` |

## Token Contracts

| Token | Address |
|-------|---------|
| USDC | `0x8fa907B03a024D30a0f40eF601aFaBB2ceD1e68f` |
| USDT | `0xE85E9B6D2ad2C9EC285C927b7A513F4A44953D0D` |
| USD1 | `0x63cF24075d00dd25cb8Eb650E69B824F86E9a355` |
| WDOGE | `0x9e97a8A16178de869e89C5Eb32b7c9a50dA69E15` |
| WETH | `0xC7b5B1497F7E6c50EA32925D9e132A3e38d0B76A` |
| LBTC | `0x24c25710d4A50d7BB23Cb61b8DcED3C0a3E23F37` |

## Pool Contracts

### USDC Pools

| Amount | Address |
|--------|---------|
| 1 USDC | `0x0bC6a5A6E6C7b37c88e0B7C9cB0A8E8d1C1F0E2A` |
| 10 USDC | `0x1234567890abcdef1234567890abcdef12345678` |
| 100 USDC | `0x2345678901abcdef2345678901abcdef23456789` |
| 1000 USDC | `0x3456789012abcdef3456789012abcdef34567890` |

### USDT Pools

| Amount | Address |
|--------|---------|
| 1 USDT | `0x...` |
| 10 USDT | `0x...` |
| 100 USDT | `0x...` |
| 1000 USDT | `0x...` |

### USD1 Pools

| Amount | Address |
|--------|---------|
| 1 USD1 | `0x...` |
| 10 USD1 | `0x...` |
| 100 USD1 | `0x...` |
| 1000 USD1 | `0x...` |

### WDOGE Pools

| Amount | Address |
|--------|---------|
| 100 WDOGE | `0x...` |
| 1,000 WDOGE | `0x...` |
| 10,000 WDOGE | `0x...` |
| 100,000 WDOGE | `0x...` |

### WETH Pools

| Amount | Address |
|--------|---------|
| 0.01 WETH | `0x...` |
| 0.1 WETH | `0x...` |
| 1 WETH | `0x...` |
| 10 WETH | `0x...` |

### LBTC Pools

| Amount | Address |
|--------|---------|
| 0.001 LBTC | `0x...` |
| 0.01 LBTC | `0x...` |
| 0.1 LBTC | `0x...` |
| 1 LBTC | `0x...` |

## Network Configuration

### DogeOS Testnet

```json
{
  "chainId": "0x539",
  "chainName": "DogeOS Testnet",
  "nativeCurrency": {
    "name": "DOGE",
    "symbol": "DOGE",
    "decimals": 18
  },
  "rpcUrls": ["https://rpc.testnet.dogeos.com"],
  "blockExplorerUrls": ["https://blockscout.testnet.dogeos.com"]
}
```

## Verification

All contracts are verified on [DogeOS Block Explorer](https://blockscout.testnet.dogeos.com).

To verify a contract:
1. Go to the contract address
2. Click "Contract" tab
3. View verified source code

---

:::warning
Always verify you're interacting with the correct contract addresses. Bookmark this page or verify against multiple sources.
:::

