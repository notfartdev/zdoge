---
id: faq
title: FAQ
sidebar_position: 3
---

# Frequently Asked Questions

Common questions about using Dogenado.

## General

### What is Dogenado?

Dogenado is a privacy protocol on DogeOS that allows you to deposit tokens and withdraw them to a different address, breaking the on-chain link between the two addresses using zero-knowledge proofs.

### Is Dogenado a mixer?

Technically, Dogenado uses "anonymity pools" rather than traditional mixing. Funds are never actually mixed together - instead, cryptographic proofs allow withdrawal without revealing which deposit you're claiming.

### Is my money safe?

Dogenado is non-custodial. Your funds are controlled by your secret note. As long as you keep your note secure, only you can withdraw your funds.

### What happens if I lose my note?

**Your funds are permanently lost.** There is no recovery mechanism. Always store your notes securely in multiple locations.

## Deposits

### How do I deposit?

1. Connect your wallet
2. Select token and amount
3. Approve token spending (first time only)
4. Confirm deposit transaction
5. **Save your secret note**

### Why do I need to approve first?

ERC-20 tokens require approval before a contract can spend them. This is a one-time action per token.

### How long until my deposit is confirmed?

Typically 10-30 seconds on DogeOS, depending on network conditions.

### Can I deposit any amount?

No. Dogenado uses fixed-denomination pools (e.g., 1, 10, 100, 1000 USDC). This standardization is essential for privacy.

## Withdrawals

### How do I withdraw?

1. Paste your secret note
2. Enter recipient address
3. Choose withdrawal timing
4. Confirm and wait for proof generation (30-60 seconds)
5. Receive funds at recipient address

### Why does proof generation take so long?

Zero-knowledge proofs require complex mathematical computations. The 30-60 second wait happens in your browser and ensures your privacy is cryptographically protected.

### Do I need to connect a wallet to withdraw?

No! Withdrawal transactions are processed without requiring wallet connection, maximizing your privacy.

### Can I withdraw to any address?

Yes. You can withdraw to any valid DogeOS address.

### What is the 0.5% fee?

A service fee that covers:
- Gas costs for transaction processing
- Infrastructure maintenance
- Protocol development

## Privacy

### How private is Dogenado?

Cryptographically, it's impossible to link your deposit to your withdrawal on-chain. However, privacy also depends on your operational security (see [Tips for Anonymity](/user-guide/tips-anonymity)).

### Can anyone see my transactions?

People can see:
- That a deposit was made (amount, time, depositor address)
- That a withdrawal was made (amount, time, recipient address)

They **cannot** see:
- Which deposit corresponds to which withdrawal

### Should I use a VPN?

For maximum privacy, yes. Your IP address could potentially be logged by RPC providers or the website.

### How long should I wait before withdrawing?

The longer you wait, the more deposits accumulate in the pool, increasing your anonymity set. We recommend waiting at least a few hours, ideally days.

## Technical

### What blockchain does Dogenado use?

DogeOS (Dogecoin Layer 2).

### What are zkSNARKs?

Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge - a cryptographic method to prove something is true without revealing the underlying information.

### Is the code open source?

Yes. All smart contracts and frontend code are open source and available on GitHub.

### Has Dogenado been audited?

[Update this based on audit status]

### What is a Merkle tree?

A data structure that efficiently stores commitments and allows proof of membership. Dogenado uses a Merkle tree with 20 levels, supporting up to 1,048,576 deposits per pool.

## Troubleshooting

### My deposit isn't showing up

1. Check the transaction on the block explorer
2. Ensure you're looking at the correct pool
3. Wait for network confirmation
4. Refresh the page

### Withdrawal is stuck on "Generating proof"

1. Ensure JavaScript is enabled
2. Try a different browser (Chrome recommended)
3. Refresh and try again
4. Check console for errors

### "Note already spent" error

This note has already been used for a withdrawal. Each note can only be used once.

### "Invalid note format" error

Ensure you copied the complete note including the `dogenado-` prefix and the entire hex string.

### Transaction failed

1. Check your gas balance
2. Verify the pool still has the funds
3. Try again with higher gas

## Safety

### Is this legal?

Privacy is a fundamental right. However, regulations vary by jurisdiction. Users are responsible for understanding and complying with local laws.

### Could my funds be stolen?

The only way to withdraw funds is with the secret note. If you keep your note secure and the smart contracts are bug-free, your funds are safe.

### What if the website goes down?

The smart contracts are deployed on DogeOS and are immutable. Even if the website disappears, funds can be recovered by interacting directly with the contracts using your secret note.

---

**Still have questions?** Join our community on [Discord/Telegram/etc.]

