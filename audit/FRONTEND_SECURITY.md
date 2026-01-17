# Frontend Security Implementation

**Version:** 1.0.0  
**Date:** January 17, 2026  
**Status:** Implemented

## Overview

zDoge is a client-side privacy application where spending keys never leave the browser. This makes frontend security **critical** - a compromised frontend can result in total loss of funds.

This document details the security measures implemented to protect users.

---

## Security Measures

### 1. Content Security Policy (CSP)

**Status:** ✅ Implemented

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:;
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.dogeos.com wss://*.dogeos.com ...;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

**Trade-offs:**
- `'unsafe-eval'` is required for snarkjs ZK proof generation (WASM execution)
- `'unsafe-inline'` is required for Next.js and Tailwind CSS
- These are documented and necessary trade-offs for a client-side ZK application

**SRI (Subresource Integrity) Note:**
- All JavaScript is self-hosted (bundled by Next.js) - no external CDN scripts
- CSP `'self'` already protects against tampering of self-hosted resources
- SRI is primarily for external CDN resources, which this app does not use
- If external scripts are added in the future, SRI will be implemented

### 2. Additional Security Headers

**Status:** ✅ Implemented

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | XSS filter (legacy) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy protection |
| `Permissions-Policy` | `camera=(), microphone=()...` | Disable unused APIs |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |
| `Cross-Origin-Resource-Policy` | `same-origin` | Resource isolation |

### 3. Build Hash Verification

**Status:** ✅ Implemented

Users can verify frontend integrity at `/verify` or via command line.

**Generated files:**
- `/build-hash.json` - Quick verification (root hash + circuit hashes)
- `/build-verification.json` - Full verification (all file hashes)

**Verification process:**
1. Run `npm run build:verify` after build
2. Publish `rootHash` to documentation/social media
3. Users compare hash before using the app

**Command-line verification:**
```bash
node scripts/verify-frontend.js https://zdoge.cash
```

### 4. ZK Circuit Integrity

**Status:** ✅ Implemented

Circuit files (.wasm, .zkey) are the most critical assets. If tampered:
- Proofs could leak private information
- Funds could be stolen

**Verification:**
- SHA-384 hashes of all circuit files
- In-browser verification at `/verify`
- External verification via scripts

### 5. IPFS Deployment (Optional)

**Status:** ✅ Scripts ready, deployment optional

IPFS provides immutable, content-addressed hosting:
- Same CID = same content (mathematically guaranteed)
- Users can verify they're running the exact published code

**Deployment:**
```bash
npm run build:static
npm run ipfs
```

**Access:**
- `https://<cid>.ipfs.dweb.link`
- `ipfs://<cid>` (Brave browser)

---

## Verification Page

**URL:** `https://zdoge.cash/verify`

The verification page allows users to:
1. View build information (ID, timestamp, root hash)
2. Verify ZK circuit files in-browser
3. Compare hashes with published values

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build:verify` | Build + generate verification hashes |
| `npm run hash` | Generate hashes for existing build |
| `npm run verify` | Verify a deployed frontend |
| `npm run ipfs` | Prepare for IPFS deployment |

---

## Threat Model

### Protected Against:
- CDN tampering (hash verification)
- DNS hijacking (users can verify hashes)
- MITM attacks (HTTPS + HSTS)
- Clickjacking (X-Frame-Options + CSP)
- XSS (CSP restrictions)

### Known Limitations:
- First-time users must trust initial hash source
- Automated verification requires user action
- `unsafe-eval` required for ZK proofs

### Recommendations for High-Value Users:
1. Verify hashes before each session
2. Use IPFS gateway for guaranteed immutability
3. Compare hashes from multiple sources (docs, Twitter, GitHub)
4. Run local frontend from source code

---

## Published Hashes

**Always verify the current hash at:**
- `https://docs.zdoge.cash/resources/contract-addresses`
- `https://github.com/DogeProtocol/dogenado`

**Circuit File Hashes (current deployment):**

| File | SHA-384 Hash |
|------|--------------|
| `shield_final.zkey` | *(run npm run hash to generate)* |
| `shield.wasm` | *(run npm run hash to generate)* |
| `transfer_final.zkey` | *(run npm run hash to generate)* |
| `transfer.wasm` | *(run npm run hash to generate)* |
| `unshield_final.zkey` | *(run npm run hash to generate)* |
| `unshield.wasm` | *(run npm run hash to generate)* |
| `swap_final.zkey` | *(run npm run hash to generate)* |
| `swap.wasm` | *(run npm run hash to generate)* |

---

## Changelog

### v1.0.0 (January 17, 2026)
- Initial implementation
- CSP and security headers
- Build hash generation
- Verification page
- IPFS deployment scripts
