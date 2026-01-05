---
id: faq
title: FAQ
sidebar_position: 3
---

# Frequently Asked Questions

Common questions about using zDoge.

## General

### What is zDoge?

zDoge is a Zcash-style shielded transaction system on DogeOS that enables private token transfers. You can shield tokens (convert public to private), transfer tokens privately between shielded addresses, swap tokens within the shielded layer, and unshield tokens back to public addresses - all with complete privacy.

### Is zDoge a mixer?

No. zDoge is a **shielded transaction system** similar to Zcash. Unlike mixers with fixed denominations, zDoge supports variable amounts and enables private transfers between shielded addresses.

### Is my money safe?

zDoge is non-custodial. Your funds are controlled by your spending key and shielded notes. As long as you keep your spending key secure, only you can spend your notes.

### What happens if I lose my spending key?

**Your funds are permanently lost.** There is no recovery mechanism. Always back up your spending key securely in multiple locations.

### What's the difference between zDoge and traditional mixers?

| Feature | Traditional Mixer | zDoge |
|---------|------------------|-------|
| Amounts | Fixed denominations | Variable amounts |
| Transfers | Deposit/Withdraw only | Shield/Transfer/Unshield/Swap |
| Addresses | Public only | Shielded addresses |
| Note Sharing | Manual | Auto-discovery via encrypted memos |
| Use Case | Break tx link | Full private payments |

## Shielded Transactions

### How do I shield tokens?

1. Connect your wallet
2. Go to Shield section
3. Select token and enter amount (any amount)
4. Approve token spending (first time only)
5. Confirm shield transaction
6. Note is automatically stored in your wallet

### How do I transfer privately?

1. Go to Send section
2. Select token and enter amount
3. Enter recipient's shielded address (zdoge:...)
4. Confirm transfer
5. Recipient automatically receives via auto-discovery

### How do I unshield tokens?

1. Go to Unshield section
2. Select token and enter amount
3. Enter recipient public address (0x...)
4. Confirm unshield
5. Tokens are sent to recipient address

### Can I shield any amount?

Yes! Unlike traditional mixers, zDoge supports **any amount**. Shield 1 DOGE, 100 DOGE, or 1000 DOGE - whatever you need.

### How does auto-discovery work?

When you receive a private transfer:
1. Sender encrypts note details in a memo
2. Memo is stored in the Transfer event
3. Your wallet automatically scans for new transfers
4. Your wallet decrypts the memo using your spending key
5. New note is automatically added to your wallet

No manual note sharing required!

## Privacy

### How private is zDoge?

All shielded transactions hide:
- Sender identity
- Recipient identity
- Transaction amounts
- Transaction links

The blockchain only shows that transactions occurred, not who made them or how much was transferred.

### Can anyone see my transactions?

People can see:
- That shielded transactions occurred (Shield, Transfer, Unshield events)
- Transaction timestamps
- Transaction hashes

They **cannot** see:
- Who sent or received
- Transaction amounts
- Which notes were spent
- Links between transactions

### Should I use a VPN?

For maximum privacy, yes. Your IP address could potentially be logged by RPC providers or the website.

### How long should I wait between transactions?

The longer you wait, the more shielded notes accumulate, increasing your anonymity set. We recommend varying timing to avoid patterns.

## Technical

### What blockchain does zDoge use?

DogeOS (Dogecoin Layer 2).

### What are zkSNARKs?

Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge - a cryptographic method to prove something is true without revealing the underlying information.

### Is the code open source?

Yes. All smart contracts and frontend code are open source and available on GitHub.

### Has zDoge been audited?

[Update this based on audit status]

### What is a Merkle tree?

A data structure that efficiently stores commitments and allows proof of membership. zDoge uses a Merkle tree with 20 levels, supporting up to 1,048,576 shielded notes.

### What is a shielded address?

A shielded address (zdoge:...) is derived from your spending key. It's used to receive private transfers. Only someone with your spending key can decrypt memos encrypted to your shielded address.

## Troubleshooting

### "Insufficient shielded balance"

You don't have enough shielded tokens. Shield more tokens first.

### "Invalid recipient address"

For transfers, ensure the address starts with `zdoge:`. For unshield, ensure it starts with `0x` and is 42 characters.

### "Proof generation failed"

- Refresh the page and try again
- Ensure you're using a modern browser (Chrome recommended)
- Check that JavaScript is enabled
- Try a smaller amount

### "Transaction failed"

- Check your gas balance (if not using relayer)
- Ensure relayer has sufficient balance (if using relayer)
- Try again after a few minutes
- Check network status

### "Auto-discovery not working"

- Ensure your wallet is connected
- Check that auto-discovery is enabled
- Wait a few minutes for scanning
- Try refreshing the page

## Safety

### Is this legal?

Privacy is a fundamental right. However, regulations vary by jurisdiction. Users are responsible for understanding and complying with local laws.

### Could my funds be stolen?

The only way to spend your notes is with your spending key. If you keep your spending key secure and the smart contracts are bug-free, your funds are safe.

### What if the website goes down?

The smart contracts are deployed on DogeOS and are immutable. Even if the website disappears, you can interact directly with the contracts using your spending key.

### How do I back up my wallet?

Your spending key is the master key. Back it up securely:
- Write it down on paper (offline)
- Store in encrypted password manager
- Keep multiple copies in secure locations
- Never share it with anyone

---

**Still have questions?** Join our community on [X (Twitter)](https://x.com/zDogeCash)
