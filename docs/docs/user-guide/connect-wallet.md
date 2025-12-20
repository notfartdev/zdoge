---
id: connect-wallet
title: Connect Your Wallet
sidebar_position: 1
---

# Connect Your Wallet

Before using Dogenado, you need to connect a compatible Web3 wallet.

## Supported Wallets

| Wallet | Status | Notes |
|--------|--------|-------|
| MetaMask | ✅ Supported | Recommended |
| WalletConnect | ✅ Supported | Mobile wallets |
| Coinbase Wallet | ✅ Supported | |
| Trust Wallet | ✅ Supported | Via WalletConnect |

## Network Configuration

Dogenado operates on **DogeOS**. Your wallet needs to be configured for this network:

### DogeOS Testnet

| Parameter | Value |
|-----------|-------|
| Network Name | DogeOS Testnet |
| RPC URL | `https://rpc.testnet.dogeos.com` |
| Chain ID | `1337` |
| Currency Symbol | `DOGE` |
| Block Explorer | `https://blockscout.testnet.dogeos.com` |

## Step-by-Step Connection

### 1. Navigate to Dogenado

Go to [dogenado.cash](https://dogenado.cash) and click **"Launch App"** or navigate directly to the dashboard.

### 2. Click Connect Wallet

![Connect Wallet Button](/img/guides/connect-wallet.png)

Click the **"Connect Wallet"** button in the navigation bar.

### 3. Select Your Wallet

Choose your preferred wallet from the list:

![Wallet Selection](/img/guides/wallet-select.png)

### 4. Approve Connection

Your wallet will prompt you to approve the connection. Review and confirm.

### 5. Switch Network (if needed)

If you're not on DogeOS, the app will prompt you to switch networks. Click **"Switch Network"** and approve in your wallet.

## Verifying Connection

Once connected, you'll see:
- Your wallet address (truncated) in the top navigation
- Your token balances in the **Account** section

## Disconnecting

To disconnect your wallet:

1. Click the **Account** button
2. Click **"Disconnect Wallet"**

## Troubleshooting

### Wallet Not Connecting

- Ensure your wallet extension is unlocked
- Try refreshing the page
- Disable other wallet extensions that might conflict

### Wrong Network

- The app will automatically prompt to switch networks
- Manually add DogeOS Testnet using the parameters above

### Transaction Stuck

- Check your gas settings
- Wait for network congestion to clear
- Try increasing gas price

---

**Next Step:** [Make a Deposit](/user-guide/deposit)

