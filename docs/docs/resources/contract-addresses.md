---
id: contract-addresses
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

All zDoge smart contracts deployed on DogeOS Testnet.

## Core Contracts

| Contract | Address | Purpose | Version |
|----------|---------|---------|---------|
| ShieldedPoolMultiToken | `0x37A7bA0f6769ae08c4331A48f737d4Ffe1bb721a` | Main shielded pool contract (shield/transfer/unshield/swap) | **V4** |
| ShieldVerifier | `0xD5AB6Ee21afcb4468DD11dA9a2BF58005A9cB5f9` | Shield proof verification (Groth16) | V4 |
| TransferVerifier | `0xBAa02AB5Ca5bC2F5c0bC95d0fEE176F06c9DBb0D` | Transfer proof verification (Groth16) | V4 |
| UnshieldVerifier | `0x0FFd1824c84b064083F377392537645313eEA540` | Unshield proof verification (supports partial unshield) | **V4** |
| SwapVerifier | `0xFB463d228d5f1BB7aF5672b3197871Cc9b87b1A5` | Swap proof verification (Groth16) | V4 |
| Hasher | `0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D` | MiMC Sponge hash function | V1 |
| DogeRouter | `0x0A26D94E458EA685dAb82445914519DE6D26EB57` | Native DOGE deposits/withdrawals (auto-wraps to wDOGE) | V1 |

### Version Information

**ShieldedPoolMultiToken V4** (Current Deployment - January 2025)
- 🔒 **Security Fixes** - All audit findings addressed (swap rate validation, rug pull prevention, etc.)
- 🔒 **Platform Fee Enforcement** - 5 DOGE per swap (calculated internally, cannot be bypassed)
- 🔒 **Proof Verification** - All verifiers match zkey files (canonical validation removed - snarkjs proofs not always canonical)
- 🔒 **Root Manipulation Protection** - 500 root history buffer (increased from 30)
- 🔒 **Commitment Uniqueness** - Prevents duplicate commitments in transfers
- ✅ **Partial Unshield** - Unshield part of a note (e.g., unshield 5 DOGE from 10 DOGE note)
- ✅ **Change Notes** - Automatically creates change note for partial unshields
- ✅ **Multi-token Support** - DOGE, USDC, USDT, USD1, WETH, LBTC
- ⚠️ **Note:** `batchTransfer` and `batchUnshield` from V2/V3 are not in V4, but backend automatically falls back to individual calls

**Previous Versions:**
- **V3** (Jan 16, 2025): Partial unshield, change notes, platform fee
- **V2** (Jan 14, 2025): Added batchTransfer, batchUnshield, privacy-preserving events, token blacklist
- **V1** (Original): Basic shield/transfer/unshield/swap functionality

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

## Platform Treasury

The platform treasury receives fees from swap operations:

| Address | Purpose |
|---------|---------|
| `0xdFc15203f5397495Dada3D7257Eed1b00DCFF548` | Platform treasury (receives 5 DOGE per swap) |

## Network Configuration

**DogeOS Testnet (Chikyū)**

- Chain ID: 6281971
- RPC: `https://rpc.testnet.dogeos.com`
- WebSocket: `wss://ws.rpc.testnet.dogeos.com`
- Block Explorer: `https://blockscout.testnet.dogeos.com`
- L2Scan: `https://dogeos-testnet.l2scan.co/`

## Frontend Verification

:::tip Security Best Practice
**Always verify the frontend before use.** zDoge is a client-side privacy application where your spending keys stay in your browser. If the frontend is compromised, funds could be at risk.

**Quick Verification:**
1. Visit `https://zdoge.cash/verify`
2. Click "Verify Circuits"
3. Compare root hash with published values below

See [Frontend Verification Guide](/resources/frontend-verification) for complete instructions.
:::

### Current Build Hash (January 2026)

**Root Hash (SHA-384):**
```
f4e00ee6409277ce7126aa2ecb66a67aa26bf0f809177fc72d9e0b4a1d1c2d6f83e821a04ea61bf256341e274f9031c8
```

**Verification:**
- Compare this hash with the value shown at `https://zdoge.cash/verify`
- Hash changes with each deployment - always check for latest
- Published on: [GitHub](https://github.com/DogeProtocol/dogenado), [Frontend Verification Guide](/resources/frontend-verification)

## Important Notes

### Contract Version Compatibility

- **V4 Events**: Same as V3 - Unshield event includes a `changeCommitment` parameter for partial unshield support
- **V3 Events**: The Unshield event includes a `changeCommitment` parameter for partial unshield support
- **V2 Events**: Older Unshield events don't include `changeCommitment` (automatically handled)
- **Backward Compatible**: V4 supports V3 features (partial unshield, change notes). Note: `batchTransfer` and `batchUnshield` from V2/V3 are not in V4, but backend automatically falls back to individual calls
- **Migration**: Users who shielded tokens in V3 can unshield them in V4 (wasEverSupported mapping)
- **Security**: V4 includes all security fixes from audit findings

### Event Format Differences

**V3 Unshield Event:**
```solidity
event Unshield(
    bytes32 indexed nullifierHash,
    address indexed recipient,
    address indexed token,
    uint256 amount,
    bytes32 changeCommitment,  // NEW in V3
    address relayer,
    uint256 fee,
    uint256 timestamp
)
```

**V2 Unshield Event:**
```solidity
event Unshield(
    bytes32 indexed nullifierHash,
    address indexed recipient,
    address indexed token,
    uint256 amount,
    address relayer,
    uint256 fee,
    uint256 timestamp
)
```

## Verification

All contracts are verified on the [DogeOS Block Explorer](https://blockscout.testnet.dogeos.com).

To verify a contract:
1. Navigate to the contract address on the explorer
2. Click "Contract" tab
3. View verified source code

---

**⚠️ Always verify you're interacting with the correct contract addresses before transacting.**
