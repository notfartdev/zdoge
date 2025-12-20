---
id: tips-anonymity
title: Tips for Anonymity
sidebar_position: 5
---

# Tips for Anonymity

Dogenado provides the cryptographic foundation for privacy, but maintaining anonymity also requires proper operational security (OpSec).

## The Anonymity Set

Your privacy is directly proportional to the **anonymity set size** - the number of deposits in a pool. The larger the set, the harder it is to correlate your deposit with your withdrawal.

```
Small Set (5 deposits):    1 in 5 chance of correlation
Large Set (1000 deposits): 1 in 1000 chance of correlation
```

### How to Maximize Anonymity Set

1. **Choose popular pools** - Pools with more deposits offer better privacy
2. **Wait before withdrawing** - Let more deposits accumulate after yours
3. **Check pool statistics** - View deposit counts before choosing a pool

## Timing Considerations

### Don't Withdraw Immediately

If you deposit at 2:00 PM and withdraw at 2:05 PM, an observer might correlate them based on timing.

**Better approach:**
- Wait hours or days between deposit and withdrawal
- Use the 1-hour or 24-hour timelock options
- Don't follow a predictable pattern

### Avoid Patterns

❌ **Bad**: Always deposit Monday, withdraw Tuesday
✅ **Good**: Vary your timing randomly

## Amount Patterns

### Use Common Denominations

Popular pool sizes have larger anonymity sets:

| Token | Recommended Pools |
|-------|-------------------|
| USDC | 100, 1000 |
| WETH | 0.1, 1 |
| WDOGE | 1000, 10000 |

### Don't Create Correlations

❌ **Bad**: Deposit 100 USDC, deposit 100 USDC, withdraw 200 USDC worth to same address
✅ **Good**: Use consistent denominations, separate destination addresses

## Network Privacy

### Use a VPN or Tor

Your IP address can be logged. For maximum privacy:

- Use a reputable VPN service
- Consider using the Tor browser
- Avoid using your home or work IP

### Fresh Recipient Addresses

❌ **Bad**: Withdraw to an address that received funds from your main wallet
✅ **Good**: Generate a brand new address with no transaction history

## Wallet Hygiene

### Don't Connect Wallet for Withdrawals

Dogenado doesn't require a wallet connection to withdraw. The transaction is submitted by the service.

### Separate Deposit and Withdrawal Devices

For maximum privacy:
- Deposit from Device A
- Withdraw from Device B (with VPN/Tor)

## Metadata Leakage

### Browser Fingerprinting

- Use incognito/private browsing mode
- Clear cookies after each session
- Consider a privacy-focused browser

### RPC Endpoint Privacy

The RPC endpoint you use can log your requests. Consider:
- Self-hosted nodes
- Privacy-focused RPC providers

## Common Mistakes to Avoid

| Mistake | Risk | Solution |
|---------|------|----------|
| Immediate withdrawal | Timing correlation | Wait for more deposits |
| Same address for deposit/withdraw | Direct link | Use fresh addresses |
| Unique amounts across pools | Amount correlation | Use standard denominations |
| Same browser session | Session tracking | Use private browsing |
| Public WiFi without VPN | IP exposure | Always use VPN |
| Discussing transactions | Social engineering | Never share details |

## Privacy Checklist

Before withdrawing, verify:

- [ ] Waited sufficient time after deposit
- [ ] Using VPN or Tor
- [ ] Recipient address is fresh (no history)
- [ ] Not connected to depositor wallet
- [ ] Private/incognito browser mode
- [ ] Pool has sufficient anonymity set

## Understanding the Limits

Dogenado provides **cryptographic privacy** but cannot protect against:

- **Timing analysis**: If deposit and withdrawal happen at unique times
- **Amount analysis**: If your amounts are unique
- **Social engineering**: If you tell someone about your transaction
- **Endpoint logging**: If your RPC provider logs requests
- **Browser fingerprinting**: If your browser is uniquely identifiable

**Privacy is a practice, not just a tool.**

---

:::warning Legal Note
Users are responsible for understanding and complying with local regulations regarding privacy protocols. Dogenado is a tool - how you use it is your responsibility.
:::

