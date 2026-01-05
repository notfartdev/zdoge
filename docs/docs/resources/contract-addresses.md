---
id: contract-addresses
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

All zDoge smart contracts deployed on DogeOS.

:::info Testnet
These addresses are for **DogeOS Testnet**. Mainnet addresses will be published when available.
:::

## Core Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| ShieldedPoolMultiToken | `0xc5F64faee07A6EFE235C12378101D62e370c0cD5` | Main shielded pool contract |
| ShieldVerifier | `[To be updated]` | Shield proof verification |
| TransferVerifier | `[To be updated]` | Transfer proof verification |
| UnshieldVerifier | `[To be updated]` | Unshield proof verification |
| SwapVerifier | `[To be updated]` | Swap proof verification |
| Hasher | `0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D` | MiMC hash function |

## Token Contracts

| Token | Address | Decimals |
|-------|---------|----------|
| Native DOGE | `0x0000000000000000000000000000000000000000` | 18 (native) |
| USDC | `0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925` | 18 |
| USDT | `0xC81800b77D91391Ef03d7868cB81204E753093a9` | 18 |
| USD1 | `0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F` | 18 |
| WETH | `0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000` | 18 |
| LBTC | `0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E` | 18 |

## Network Configuration

### DogeOS Testnet (Chikyū)

```json
{
  "chainId": 6281971,
  "chainName": "DogeOS Chikyū Testnet",
  "nativeCurrency": {
    "name": "Dogecoin",
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
