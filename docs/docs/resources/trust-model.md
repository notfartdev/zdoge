---
id: trust-model
title: Trust Model
sidebar_position: 4
---

# Trust Model & Security Assumptions

**Understanding what zDoge protects cryptographically and what you must trust.**

:::caution Testnet Phase
zDoge is currently live on **DogeOS Testnet**. This is experimental software and should be used for testing purposes only. The system may have bugs, and funds are at risk.
:::

## What is Cryptographically Enforced ✅

These security properties are guaranteed by cryptography and mathematics:

### 1. **Privacy Guarantees**
- ✅ **Sender anonymity**: Zero-knowledge proofs ensure no one can determine who sent a transaction
- ✅ **Recipient anonymity**: Recipient addresses are hidden in shielded transfers
- ✅ **Amount privacy**: Transaction amounts are hidden through commitments
- ✅ **Unlinkability**: Multiple transactions cannot be linked to each other
- ✅ **Transaction graph privacy**: The relationship between inputs and outputs is cryptographically hidden

### 2. **Fund Security**
- ✅ **Non-custodial**: You control your funds via your spending key - no third party can access them
- ✅ **Double-spend prevention**: Nullifiers prevent the same note from being spent twice
- ✅ **Merkle tree integrity**: Transactions must prove membership in the current Merkle tree state
- ✅ **Contract immutability**: Once deployed, smart contracts cannot be changed

### 3. **Cryptographic Integrity**
- ✅ **Proof verification**: All zero-knowledge proofs are verified on-chain before transactions execute
- ✅ **Commitment binding**: Commitments cryptographically bind to specific amounts and recipients
- ✅ **Nullifier uniqueness**: Each nullifier can only be used once, enforced by the smart contract

## What You Must Trust ⚠️

These components require trust in various parties:

### 1. **Relayer Service** (Medium Trust)
The relayer pays gas fees on your behalf for shielded transactions:

- **Trust Required:**
  - Relayer will submit your transaction honestly (does not modify parameters)
  - Relayer has sufficient funds to pay gas
  - Relayer is online and operational

- **What Relayer CANNOT Do:**
  - ❌ Cannot steal your funds (you control spending key)
  - ❌ Cannot see your transaction amounts or recipients (encrypted)
  - ❌ Cannot block your transactions if you have valid proofs

- **Mitigation:**
  - Relayer is permissionless - anyone can run one
  - Multiple relayers can exist
  - You can always pay gas yourself as fallback

### 2. **Token Pricing** (Swap Operations)
For token swaps, pricing comes from an oracle or DEX:

- **Trust Required:**
  - Pricing is fair and not manipulated
  - Liquidity is available at quoted prices

- **Current Implementation:**
  - Uses mock/simulated pricing on testnet
  - Mainnet will use verified oracles or DEX aggregators

### 3. **UI/Frontend** (Low-Medium Trust)
The web interface you interact with:

- **Trust Required:**
  - UI correctly displays balances
  - UI submits correct transaction parameters
  - UI doesn't leak private information

- **Mitigation:**
  - Open-source code (you can verify)
  - Always verify transactions in your wallet before signing
  - Don't trust UI blindly - check on-chain data

### 4. **RPC Providers** (Low Trust)
Blockchain RPC endpoints used for data:

- **Trust Required:**
  - RPC providers return correct blockchain data
  - RPC providers don't censor or block requests

- **Mitigation:**
  - Multiple RPC providers available
  - RPC rotation implemented (privacy enhancement)
  - Can run your own RPC node

### 5. **Smart Contract Implementation** (High Trust)
The deployed smart contracts:

- **Trust Required:**
  - Contracts are correctly implemented
  - No bugs or vulnerabilities exist
  - Circuit verifier correctly matches circuit

- **Mitigation:**
  - Contracts are open-source
  - Can be audited before mainnet
  - Immutable once deployed (cannot be changed)

### 6. **Backend Indexer** (Low Trust)
The indexer service that tracks transactions:

- **Trust Required:**
  - Indexer correctly tracks Merkle tree state
  - Indexer returns correct Merkle paths for proofs

- **What Indexer CANNOT Do:**
  - ❌ Cannot create false proofs (cryptographically impossible)
  - ❌ Cannot spend your funds
  - ❌ Cannot break privacy

- **Mitigation:**
  - Indexer is read-only
  - You can verify Merkle paths independently
  - Can run your own indexer

## Risk Levels Summary

| Component | Trust Level | Risk if Malicious |
|-----------|-------------|-------------------|
| **Cryptography** | None required | N/A - mathematically proven |
| **Smart Contracts** | High | Could lose funds (audit before mainnet) |
| **Relayer** | Medium | Transaction might not go through (can self-relay) |
| **UI/Frontend** | Low-Medium | Might submit wrong parameters (verify in wallet) |
| **Indexer** | Low | Might return wrong Merkle path (can verify) |
| **RPC Providers** | Low | Might censor or return wrong data (can switch) |
| **Token Pricing** | Medium | Might get unfavorable swap rates |

## Security Best Practices

1. **Always verify transactions in your wallet** before signing
2. **Don't trust UI balances blindly** - check on-chain when critical
3. **Keep your spending key secure** - losing it means losing funds forever
4. **Test with small amounts first** on testnet before using real funds
5. **Verify contract addresses** match documentation before interacting
6. **Review transaction parameters** (amount, recipient) carefully
7. **Use reputable RPC providers** or run your own node
8. **Monitor for relayer outages** and be ready to self-relay if needed

## What Happens if Components Fail?

### Relayer Goes Down
- ✅ **Solution**: Pay gas yourself or use different relayer
- ✅ **Funds**: Safe - relayer doesn't control them

### Indexer Goes Down
- ⚠️ **Impact**: Cannot generate proofs (need Merkle paths)
- ✅ **Solution**: Run your own indexer or wait for service restoration

### UI Has Bug
- ⚠️ **Impact**: Might submit wrong parameters
- ✅ **Solution**: Always verify in wallet before signing

### Smart Contract Has Bug
- ❌ **Impact**: Could lose funds (critical)
- ✅ **Mitigation**: Audits before mainnet, bug bounties

### RPC Provider Censors
- ⚠️ **Impact**: Cannot read blockchain data
- ✅ **Solution**: Switch to different RPC provider

## Testnet vs Mainnet

:::warning Experimental
**Testnet is experimental software.** On testnet:
- Contracts may have bugs
- Funds have no real value
- System may reset or change
- Use only for testing
:::

**Mainnet will require:**
- ✅ Full security audit
- ✅ Formal verification (where possible)
- ✅ Bug bounty program
- ✅ Extensive testing
- ✅ Clear trust model disclosure
- ✅ Emergency procedures documented

## Questions?

If you have questions about the trust model or security assumptions:
- Review the [Technical Documentation](/technical/architecture)
- Check the [FAQ](/resources/faq)
- Open an issue on GitHub
- Join community discussions

---

**Last Updated:** January 2025
