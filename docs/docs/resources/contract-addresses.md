---
id: contract-addresses
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

All zDoge smart contracts deployed on DogeOS Testnet.

## Core Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| ShieldedPoolMultiToken | `0x2e93EC915E439920a770e5c9d8c207A6160929a8` | Main shielded pool contract (shield/transfer/unshield/swap) |
| ShieldVerifier | `0x2cD2A2126825fC8000C1AD2dFD25D15F8Cc365f1` | Shield proof verification |
| TransferVerifier | `0x0568BF5FaAEf348B71BdD18a05e1EC55a23459B2` | Transfer proof verification |
| UnshieldVerifier | `0x7DFEa7a81B6f7098DB4a973b052A08899865b60b` | Unshield proof verification |
| SwapVerifier | `0xE264695FF93e2baa700C3518227EBc917092bd3A` | Swap proof verification |
| Hasher | `0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D` | MiMC hash function |
| DogeRouter | `0x0A26D94E458EA685dAb82445914519DE6D26EB57` | Native DOGE deposits/withdrawals (auto-wraps to wDOGE) |

## Token Contracts

| Token | Address | Decimals |
|-------|---------|----------|
| Native DOGE | `0x0000000000000000000000000000000000000000` | 18 |
| WDOGE | `0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE` | 18 |
| USDC | `0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925` | 18 |
| USDT | `0xC81800b77D91391Ef03d7868cB81204E753093a9` | 18 |
| USD1 | `0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F` | 18 |
| WETH | `0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000` | 18 |
| LBTC | `0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E` | 18 |

## Legacy Pool Contracts (Fixed Denominations)

These are the original mixer pool contracts with fixed denominations. The shielded pool uses variable amounts instead.

| Pool | Address | Token | Denomination |
|------|---------|-------|--------------|
| USDC-1 | `0x3c1FDFdBc9f436c9D370c57C658C1ca67EBAa146` | USDC | 1 USDC |
| USDC-10 | `0xd8d301c460023D320f44da2f696831ECc7F60504` | USDC | 10 USDC |
| USDC-100 | `0xe00bC9e7431dFF487ac9EB7b51d8B14C5B7b0847` | USDC | 100 USDC |
| USDC-1000 | `0xde641902e9986eFD55A664230AC0203d3286E2b0` | USDC | 1000 USDC |
| USDT-1 | `0x3B80e33752634d856AE6e6f68570157637912000` | USDT | 1 USDT |
| USDT-10 | `0x6f9210EDd0985eA6f9FEeAB080FA85933178D38c` | USDT | 10 USDT |
| USDT-100 | `0x13DC6fda3cF0990e7D15750A2c3ce8693c351e46` | USDT | 100 USDT |
| USDT-1000 | `0x308C8f3692c6C19B84A24466D1792f7B794cF5ae` | USDT | 1000 USDT |
| USD1-1 | `0x72CdC6eA899621be7dF24c8084C667276D23F5b3` | USD1 | 1 USD1 |
| USD1-10 | `0x47fE455020B010c114356C88C291118918e32c57` | USD1 | 10 USD1 |
| USD1-100 | `0x248A93958693fD9Cc260676B63440F5eBAf25B79` | USD1 | 100 USD1 |
| USD1-1000 | `0x307d1D56a321eE5f4334b6A3A00E6Cc6ad8598b1` | USD1 | 1000 USD1 |
| DOGE-1 | `0xb253d81E44bCE93Fb742EE8cD26D96eD910f401a` | DOGE | 1 DOGE |
| DOGE-10 | `0x01aA22f48DBA28934b0aABB0D949F56d942775e6` | DOGE | 10 DOGE |
| DOGE-100 | `0x0E9A2FD5b4176fFb7C3dE11a8D90D8AAD5dC0811` | DOGE | 100 DOGE |
| DOGE-1000 | `0xe1c751D6F65768EB6d3BCb84760bDd68C6d3F7D4` | DOGE | 1000 DOGE |
| WETH-0.01 | `0x72734eDD05E680a4dB4312974EE46ce903aE807C` | WETH | 0.01 WETH |
| WETH-0.1 | `0x1d5d2c74e3b402749Fd9BeD709a749A0E5E2ea8e` | WETH | 0.1 WETH |
| WETH-1 | `0xb3748014f9bDB54F7fc33d8aea6Fbff7a0750d6b` | WETH | 1 WETH |
| WETH-10 | `0xfAfD381E6246E67607603BCf617AB522Ce4de1D9` | WETH | 10 WETH |
| LBTC-0.001 | `0x821EdB78D739759F0E226DF9a0B8D87f7c78cA77` | LBTC | 0.001 LBTC |
| LBTC-0.01 | `0xda43aA668640CA2F48364adCC01B1Ed5c11D6385` | LBTC | 0.01 LBTC |
| LBTC-0.1 | `0x5ffc61930595BA9Fae2a0D0b0651cd65BC105e92` | LBTC | 0.1 LBTC |
| LBTC-1 | `0x526A143FD0C0429cE71FB8FA09ACa6f4876d29a5` | LBTC | 1 LBTC |

## Network Configuration

**DogeOS Testnet (Chikyū)**

- Chain ID: 6281971
- RPC: `https://rpc.testnet.dogeos.com`
- WebSocket: `wss://ws.rpc.testnet.dogeos.com`
- Block Explorer: `https://blockscout.testnet.dogeos.com`
- L2Scan: `https://dogeos-testnet.l2scan.co/`

## Verification

All contracts are verified on the [DogeOS Block Explorer](https://blockscout.testnet.dogeos.com).

To verify a contract:
1. Navigate to the contract address on the explorer
2. Click "Contract" tab
3. View verified source code

---

Always verify you're interacting with the correct contract addresses before transacting.
