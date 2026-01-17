# Files to Upload for Hashlock AI Audit

This document lists all files that should be uploaded for the security audit.

---

## Required Solidity Files (.sol)

### Core Contracts (Priority 1 - Must Upload)

1. **contracts/src/ShieldedPoolMultiToken.sol**
   - Main shielded pool contract (V4)
   - Most critical contract - handles all shielded operations
   - Implements shield, transfer, unshield, swap operations
   - V4 includes all security fixes from audit findings

2. **contracts/src/MerkleTreeWithHistory.sol**
   - Base contract for Merkle tree management
   - Inherited by ShieldedPoolMultiToken
   - Critical for tree state management and replay prevention

3. **contracts/src/verifiers/ShieldVerifier.sol**
   - Shield proof verification contract
   - Verifies Groth16 proofs for shield operations

4. **contracts/src/verifiers/TransferVerifier.sol**
   - Transfer proof verification contract
   - Verifies Groth16 proofs for transfer operations

5. **contracts/src/verifiers/UnshieldVerifier.sol**
   - Unshield proof verification contract
   - Verifies Groth16 proofs for unshield operations (including partial)

6. **contracts/src/verifiers/SwapVerifier.sol**
   - Swap proof verification contract
   - Verifies Groth16 proofs for swap operations

### Supporting Contracts (Priority 2 - Should Upload)

7. **contracts/src/Hasher.sol**
   - MiMC Sponge hash function implementation
   - Used for commitment and nullifier generation

8. **contracts/src/HasherAdapter.sol**
   - Adapter for Hasher contract
   - Interface wrapper for hash operations

9. **contracts/src/DogeRouter.sol**
   - Native DOGE deposit/withdrawal router
   - Handles native token wrapping

10. **contracts/src/interfaces/IShieldedVerifiers.sol**
    - Interface definitions for all verifier contracts
    - Important for understanding contract interactions

11. **contracts/src/interfaces/IVerifier.sol**
    - Base verifier interface
    - Defines proof verification interface

12. **contracts/src/interfaces/IHasher.sol**
    - Hasher interface
    - Defines hash function interface

### Legacy Contracts (Priority 3 - Optional, for Context)

13. **contracts/src/ShieldedPoolMultiTokenV2.sol**
    - Previous version (V2) - for comparison
    - Shows evolution of contract design

14. **contracts/src/MixerPool.sol**
    - Legacy fixed-denomination pool
    - For historical context

15. **contracts/src/MixerPoolNative.sol**
    - Legacy native DOGE pool
    - For historical context

---

## Context Files (.md, .txt)

### Security and Privacy Documentation (High Priority)

1. **audit/AUDIT_REPORT.md**
   - Comprehensive security audit report
   - Contains security analysis, findings, and recommendations
   - Critical context for understanding security posture

2. **audit/PRIVACY_REVIEW.md**
   - Privacy analysis and threat assessment
   - Documents privacy guarantees and limitations
   - Important for understanding privacy model

3. **audit/THREAT_MODEL.md**
   - Detailed threat model
   - Defines what is protected and what is not
   - Attack scenarios and mitigations

4. **audit/FRONTEND_SECURITY.md**
   - Frontend security implementation details
   - CSP configuration and security headers
   - Build hash verification system
   - IPFS deployment instructions
   - User verification instructions

5. **docs/docs/resources/contract-addresses.md**
   - Contract addresses and deployment information
   - Network configuration
   - Architecture overview
   - All deployed contract addresses
   - Version information
   - Token addresses
   - Platform treasury address

### Frontend Security Scripts (Medium Priority)

6. **scripts/generate-build-hashes.js**
   - Generates SHA-384 hashes for all build files
   - Creates verification files for users
   - Used for frontend integrity verification

7. **scripts/verify-frontend.js**
   - Command-line verification tool
   - Verifies circuit files against published hashes
   - Can verify any deployed instance

8. **scripts/deploy-ipfs.js**
   - IPFS deployment preparation
   - Creates CAR files for IPFS pinning
   - Enables immutable frontend hosting

### Technical Documentation (Low Priority, Optional)

9. **docs/TECHNICAL_DEEP_DIVE.md** (if exists)
   - Technical architecture details
   - Implementation specifics

7. **README.md** (project root)
   - Project overview
   - Basic architecture description

---

## Upload Strategy

### Minimum Required Upload

For a basic audit, upload at minimum:

**Solidity Files:**
- ShieldedPoolMultiToken.sol
- MerkleTreeWithHistory.sol
- All 4 verifier contracts (Shield, Transfer, Unshield, Swap)
- Hasher.sol

**Context Files:**
- AUDIT_REPORT.md
- FRONTEND_SECURITY.md
- docs/docs/resources/contract-addresses.md

### Comprehensive Upload

For a thorough audit, upload all Priority 1 and Priority 2 Solidity files, plus all context files listed above.

---

## Contract Interaction Flow

**Shield Operation:**
1. User calls `shield()` on ShieldedPoolMultiToken
2. Contract verifies proof using ShieldVerifier
3. Contract adds commitment to MerkleTreeWithHistory
4. Emits Shield event

**Transfer Operation:**
1. User calls `transfer()` on ShieldedPoolMultiToken
2. Contract verifies proof using TransferVerifier
3. Contract checks nullifier not spent
4. Contract adds output commitments to MerkleTreeWithHistory
5. Contract marks nullifier as spent
6. Emits Transfer event

**Unshield Operation:**
1. User calls `unshield()` on ShieldedPoolMultiToken
2. Contract verifies proof using UnshieldVerifier
3. Contract checks nullifier not spent
4. Contract transfers tokens to recipient (native or ERC20)
5. Contract marks nullifier as spent
6. If partial unshield, creates change note commitment
7. Emits Unshield event

**Swap Operation:**
1. User calls `swap()` on ShieldedPoolMultiToken
2. Contract verifies proof using SwapVerifier
3. Contract checks nullifiers not spent
4. Contract executes DEX swap via router
5. Contract adds output commitments to MerkleTreeWithHistory
6. Contract marks nullifiers as spent
7. Contract sends platform fee to treasury
8. Emits Swap event

---

## Key Security Considerations for Audit

1. **Reentrancy Protection:** All state-changing functions use ReentrancyGuard
2. **Nullifier Uniqueness:** Nullifier set prevents double-spending
3. **Merkle Tree Integrity:** History tracking prevents replay attacks
4. **Proof Verification:** All operations require valid Groth16 proofs
5. **Token Safety:** SafeERC20 used for all ERC20 operations
6. **Access Control:** Owner functions properly protected
7. **Value Conservation:** Circuits ensure input = output (no minting)
8. **Fee Handling:** Platform fees correctly routed to treasury

---

## Notes for Auditors

- Contracts are deployed on DogeOS Testnet (EVM-compatible)
- Uses Solidity 0.8.20
- OpenZeppelin contracts used for security (ReentrancyGuard, SafeERC20)
- Groth16 zero-knowledge proofs for privacy
- MiMC Sponge hash function for commitments (ZK-friendly)
- Multi-token support with native DOGE handling
- V4 is the current production version (V1, V2, and V3 are legacy)
- V4 includes all security fixes from audit findings

---

**Last Updated:** January 2026
