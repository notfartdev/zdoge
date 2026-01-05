---
id: tips-anonymity
title: Tips for Anonymity
sidebar_position: 7
---

# Tips for Anonymity

zDoge provides the cryptographic foundation for privacy, but maintaining anonymity also requires proper operational security (OpSec).

## The Anonymity Set

Your privacy is directly proportional to the **anonymity set size** - the number of shielded notes in the system. The larger the set, the harder it is to correlate your transactions.

```
Small Set (10 notes):    1 in 10 chance of correlation
Large Set (1000 notes): 1 in 1000 chance of correlation
```

### How to Maximize Anonymity Set

1. **Wait between transactions** - Let more notes accumulate after yours
2. **Vary transaction timing** - Don't create patterns
3. **Use the system actively** - More users = larger anonymity set

## Timing Considerations

### Don't Transfer Immediately After Shield

If you shield at 2:00 PM and transfer at 2:05 PM, an observer might correlate them based on timing.

**Better approach:**
- Wait hours or days between shield and transfer
- Vary your timing randomly
- Don't follow a predictable pattern

### Avoid Patterns

**Bad**: Always shield Monday, transfer Tuesday, unshield Wednesday
**Good**: Vary your timing randomly

## Amount Patterns

### Vary Transaction Amounts

Unlike fixed-denomination mixers, zDoge supports any amount. This means:

**Good practices:**
- Don't always use round numbers (100, 200, 300)
- Vary amounts slightly (98.5, 201.3, 299.7)
- Don't create obvious patterns

**Bad**: Shield 100, transfer 100, unshield 100
**Good**: Shield 100, transfer 98.5, unshield 95.2

## Network Privacy

### Use a VPN or Tor

Your IP address can be logged. For maximum privacy:

- Use a reputable VPN service
- Consider using the Tor browser
- Avoid using your home or work IP

### Fresh Recipient Addresses

**Bad**: Unshield to an address that received funds from your main wallet
**Good**: Generate a brand new address with no transaction history

## Wallet Hygiene

### Shielded Address Privacy

Your shielded address (zdoge:...) is public and can be shared. However:

- ✅ Sharing your shielded address is safe (can't spend your notes)
- ⚠️ Don't link your shielded address to your identity publicly
- ✅ Use different shielded addresses for different purposes (optional)

### Spending Key Security

Your spending key is the master key:

- ✅ Never share your spending key
- ✅ Back it up securely (offline, encrypted)
- ✅ Store multiple copies in secure locations
- ❌ Never store it online or in cloud storage

## Metadata Leakage

### Browser Fingerprinting

- Use incognito/private browsing mode
- Clear cookies after each session
- Consider a privacy-focused browser
- Use different browsers for different transactions

### RPC Endpoint Privacy

The RPC endpoint you use can log your requests. Consider:
- Self-hosted nodes
- Privacy-focused RPC providers
- Rotating between providers

## Transaction Patterns

### Shield → Transfer → Unshield

**Good pattern:**
1. Shield tokens
2. Wait (hours/days)
3. Transfer to another shielded address
4. Wait (hours/days)
5. Unshield to fresh address

This breaks the link at multiple points.

### Multiple Transfers

If you need to send to multiple recipients:

**Good**: Make separate transfers with delays between them
**Bad**: All transfers in quick succession

## Common Mistakes to Avoid

| Mistake | Risk | Solution |
|---------|------|----------|
| Immediate transfer after shield | Timing correlation | Wait for more notes |
| Same address for shield/unshield | Direct link | Use fresh addresses |
| Round number amounts | Amount correlation | Vary amounts slightly |
| Same browser session | Session tracking | Use private browsing |
| Public WiFi without VPN | IP exposure | Always use VPN |
| Discussing transactions | Social engineering | Never share details |
| Linking shielded address to identity | Identity correlation | Keep addresses separate |

## Privacy Checklist

Before making transactions, verify:

- [ ] Waited sufficient time since last transaction
- [ ] Using VPN or Tor
- [ ] Recipient address is fresh (for unshield)
- [ ] Amounts are varied (not round numbers)
- [ ] Private/incognito browser mode
- [ ] Not creating timing patterns
- [ ] Spending key is backed up securely

## Understanding the Limits

zDoge provides **cryptographic privacy** but cannot protect against:

- **Timing analysis**: If transactions happen at unique times
- **Amount analysis**: If your amounts are unique
- **Social engineering**: If you tell someone about your transaction
- **Endpoint logging**: If your RPC provider logs requests
- **Browser fingerprinting**: If your browser is uniquely identifiable
- **Metadata correlation**: If you link transactions through other means

**Privacy is a practice, not just a tool.**

## Best Practices Summary

1. **Wait between transactions** - Let anonymity set grow
2. **Vary amounts and timing** - Don't create patterns
3. **Use VPN/Tor** - Protect your IP
4. **Fresh addresses** - For unshield recipients
5. **Secure spending key** - Back it up offline
6. **Private browsing** - Reduce fingerprinting
7. **Don't link identities** - Keep transactions separate

---

:::warning Legal Note
Users are responsible for understanding and complying with local regulations regarding privacy protocols. zDoge is a tool - how you use it is your responsibility.
:::
