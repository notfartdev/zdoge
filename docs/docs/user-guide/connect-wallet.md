---
id: connect-wallet
title: Connect Your Wallet
sidebar_position: 1
---

# Connect Your Wallet

Before using zDoge, you need to connect a compatible Web3 wallet.

## Supported Wallets

| Wallet | Status | Notes |
|--------|--------|-------|
| MetaMask | Supported | Recommended |
| WalletConnect | Supported | Mobile wallets via WalletConnect |

## Network Configuration

zDoge operates on **DogeOS**. Your wallet needs to be configured for this network:

### DogeOS Testnet (Chikyū)

| Parameter | Value |
|-----------|-------|
| Network Name | DogeOS Chikyū Testnet |
| RPC URL | `https://rpc.testnet.dogeos.com` |
| Chain ID | `6281971` |
| Currency Symbol | `DOGE` |
| Block Explorer | `https://blockscout.testnet.dogeos.com` |

## Step-by-Step Connection

### 1. Navigate to zDoge

Go to [zdoge.cash](https://zdoge.cash) and click **"Launch App"** or navigate directly to the dashboard.

### 2. Click Connect Wallet

Click the **"Connect Wallet"** button in the navigation bar.

### 3. Select Your Wallet

Choose your preferred wallet from the list.

### 4. Approve Connection

Your wallet will prompt you to approve the connection. Review and confirm.

### 5. Switch Network (if needed)

If you're not on DogeOS, the app will prompt you to switch networks. Click **"Switch Network"** and approve in your wallet.

## Verifying Connection

Once connected, you'll see:
- Your wallet address (truncated) in the top navigation
- Your token balances in the dashboard
- Shielded wallet initialization option

## Shielded Wallet Setup

After connecting your wallet, you'll need to initialize your shielded wallet:

1. **Sign Message**: Your wallet will prompt you to sign a message
2. **Generate Identity**: Your shielded identity is generated from this signature
3. **Get Shielded Address**: You'll receive your shielded address (zdoge:...)

:::info Privacy
Your shielded identity is derived from your wallet signature. This ensures only you can access your shielded notes.
:::

## Disconnecting

To disconnect your wallet:

1. Click the **Account** button
2. Click **"Disconnect Wallet"**

:::warning Note
Disconnecting your wallet does not affect your shielded notes. They are stored locally and synced to the backend.
:::

## Troubleshooting

### Wallet Not Connecting

- Ensure your wallet extension is unlocked
- Try refreshing the page
- Disable other wallet extensions that might conflict
- Clear browser cache and try again

### Wrong Network

- The app will automatically prompt to switch networks
- Manually add DogeOS Testnet using the parameters above
- Ensure you're on the correct network before transactions

### Transaction Stuck

- Check your gas settings
- Wait for network congestion to clear
- Try increasing gas price
- Check block explorer for transaction status

### Shielded Wallet Not Initializing

- Ensure you approve the signature request
- Check that your wallet supports message signing
- Try refreshing the page
- Check browser console for errors

---

**Next Step:** [How to Shield](/user-guide/shield)
