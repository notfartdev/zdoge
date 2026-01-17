---
id: frontend-verification
title: Frontend Verification
sidebar_position: 3
---

# Frontend Verification

**Verify that you're running the authentic zDoge frontend before using the application.**

:::caution Critical Security Feature
zDoge is a client-side privacy application. Your spending keys never leave your browser, which means if the frontend code is compromised, an attacker could steal your funds. **Always verify the frontend before use.**
:::

## Why Verify?

In a client-side privacy application like zDoge:

- ✅ **Your spending keys stay in your browser** - This is good for privacy
- ⚠️ **But if the frontend is tampered with** - An attacker could steal your keys

**Frontend verification ensures:**
- The JavaScript code hasn't been modified
- ZK circuit files are authentic and unmodified
- You're running the same code as everyone else

## Quick Verification (Recommended)

### Method 1: In-Browser Verification

1. **Visit the verification page:**
   ```
   https://zdoge.cash/verify
   ```

2. **Click "Verify Circuits"** button

3. **Check the results:**
   - ✅ **All green checkmarks** = Frontend is authentic
   - ❌ **Red warnings** = DO NOT USE - Frontend may be compromised

4. **Compare the Root Hash** with published values (see below)

### Method 2: Command-Line Verification

For advanced users, verify from terminal:

```bash
# Clone the repository
git clone https://github.com/DogeProtocol/dogenado.git
cd dogenado

# Run verification
npm run verify https://zdoge.cash
```

**Expected output:**
```
✅ All circuit files verified successfully!
✅ FRONTEND VERIFICATION COMPLETE
```

## Published Hashes

**Always verify the current hash matches these published values:**

### Current Build (January 2026)

**Root Hash:**
```
f4e00ee6409277ce7126aa2ecb66a67aa26bf0f809177fc72d9e0b4a1d1c2d6f83e821a04ea61bf256341e274f9031c8
```

**Published on:**
- This documentation page
- [GitHub Repository](https://github.com/DogeProtocol/dogenado)
- [Contract Addresses Page](/resources/contract-addresses)

### Circuit File Hashes

Critical ZK circuit files (SHA-384):

| File | Hash |
|------|------|
| `shield_final.zkey` | `sha384-YBtE1lWAaGJfmU21KB4ckX0dMCeg/1AL7kdsXvdO+bReuqjDZAzaXAUaVFVPpRkl` |
| `shield.wasm` | `sha384-fDmgo3KBrX6lG52ANtOZxXH62apviNBZpoE+/3Fng9PvySf9dLsmgMWRzzIIseUt` |
| `transfer_final.zkey` | `sha384-Wg4P5l7kX9ujyvQ4onZw9zpFQzJK03jN3jqUusZ3LSFIG6/Czn8uXJ14wxQHm668` |
| `transfer.wasm` | `sha384-gfEeHjd9FGFFPl29g3kjoyh5YoYCk1ypoJeFg7Voxe0PP6XTlfTxxrF/PqpPTbL9` |
| `unshield_final.zkey` | `sha384-QdBLtniz6XDg5S0QUrIq0ECS/PjmqWSZmCiPl9L+Pr2uooUaAsiWVp6bzdgoAyAP` |
| `unshield.wasm` | `sha384-hUt2G7/UBwPuiYMJPxxK68FWdrt+fJtAG7QswMcQuiNZ397WyeI4pCLD+urDipYh` |
| `swap_final.zkey` | `sha384-oVn4zcO3q++IrXDigMLTysUfTasDqkEtavjqpBvjbmNEVGpvHAn1GvfOcwZWX+1M` |
| `swap.wasm` | `sha384-rP6uVkVPmlP6sdr1Hwx/AAfvZwBihfkvRaZtCHMfZHBVEfsO7R7DGBCRwILpZuTW` |

:::info Hash Updates
Hashes are updated with each deployment. Check the verification page for the latest values.
:::

## How It Works

### Cryptographic Hashing

zDoge uses **SHA-384** (Secure Hash Algorithm 384-bit) to create fingerprints of all frontend files:

1. **Build Process:**
   - All JavaScript, CSS, and circuit files are hashed
   - A "root hash" is calculated from all file hashes
   - Hashes are published publicly

2. **Verification Process:**
   - Your browser downloads the frontend files
   - Browser calculates hashes of downloaded files
   - Hashes are compared with published values
   - Mismatch = tampering detected

### Security Properties

- **Cryptographically Secure:** SHA-384 is collision-resistant (can't fake a hash)
- **Tamper-Proof:** Any file modification changes the hash
- **Transparent:** All hashes are publicly verifiable
- **User-Friendly:** One-click verification in browser

## IPFS Deployment (Advanced)

For maximum security, zDoge can be deployed to **IPFS** (InterPlanetary File System):

### What is IPFS?

- **Decentralized hosting** - No single point of failure
- **Content-addressed** - Same content = same address (CID)
- **Immutable** - Content cannot be changed once published

### Accessing via IPFS

Once deployed, users can access zDoge via:

```
ipfs://<CID>
https://<CID>.ipfs.dweb.link
https://ipfs.io/ipfs/<CID>
```

**Benefits:**
- ✅ Guaranteed immutability (CID changes if content changes)
- ✅ No reliance on centralized hosting
- ✅ Censorship-resistant

:::info IPFS Status
IPFS deployment is optional. The standard web deployment includes full verification capabilities.
:::

## Security Headers

zDoge implements comprehensive security headers:

- **Content Security Policy (CSP)** - Restricts resource loading
- **X-Frame-Options** - Prevents clickjacking
- **Strict-Transport-Security (HSTS)** - Forces HTTPS
- **X-Content-Type-Options** - Prevents MIME sniffing

These headers are automatically enforced by the browser.

## What If Verification Fails?

### ❌ Hash Mismatch Detected

**DO NOT USE THE FRONTEND**

1. **Clear your browser cache**
2. **Try a different browser**
3. **Check if you're on the correct URL** (`https://zdoge.cash`)
4. **Compare with published hashes** from multiple sources
5. **Report the issue** on GitHub

### ⚠️ Verification Page Not Loading

If `/verify` page doesn't load:

1. **Check your internet connection**
2. **Try accessing directly:** `https://zdoge.cash/build-hash.json`
3. **Verify manually** using command-line tool
4. **Contact support** if issue persists

## Best Practices

### For Regular Users

1. ✅ **Always verify before first use**
2. ✅ **Re-verify after major updates**
3. ✅ **Compare hashes from multiple sources** (docs, GitHub, social media)
4. ✅ **Bookmark the verification page**

### For High-Value Users

1. ✅ **Verify before every session**
2. ✅ **Use IPFS deployment** when available
3. ✅ **Run local frontend** from source code
4. ✅ **Compare hashes from multiple independent sources**

## Technical Details

### Hash Algorithm

- **Algorithm:** SHA-384 (SHA-2 family)
- **Format:** Base64-encoded
- **Standard:** W3C Subresource Integrity (SRI)

### Verification Files

- `/build-hash.json` - Quick verification (root hash + circuit hashes)
- `/build-verification.json` - Full verification (all file hashes)

### Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Brave

All modern browsers support Web Crypto API for hash verification.

## Questions?

- **How often should I verify?** Before first use, and after major updates
- **What if hashes don't match?** DO NOT USE - Report the issue
- **Can I trust the verification page itself?** Yes - it's part of the same build being verified
- **Is this required for testnet?** Recommended but not required (testnet uses test tokens)

For more information:
- [Trust Model](/resources/trust-model)
- [Security Audit](/resources/contract-addresses#security-audit)
- [GitHub Repository](https://github.com/DogeProtocol/dogenado)

---

**Last Updated:** January 2026
