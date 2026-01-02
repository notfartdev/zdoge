# Dogenado Shielded Circuits

ZK circuits for private shielded transactions on DogeOS.

## Overview

These circuits enable Zcash-style shielded transactions:

- **Shield (t→z)**: Deposit public DOGE into a shielded note
- **Transfer (z→z)**: Send shielded funds to another shielded address  
- **Unshield (z→t)**: Withdraw shielded funds to a public address

## Circuit Details

### Shield Circuit (`shield.circom`)

**Purpose:** Proves that a commitment was correctly constructed.

**Public Inputs:**
- `commitment`: The note commitment (goes on-chain)
- `amount`: The deposit amount (must match msg.value)

**Private Inputs:**
- `ownerPubkey`: Recipient's shielded address
- `secret`: Random secret
- `blinding`: Random blinding factor

**Constraints:** ~5,000

### Transfer Circuit (`transfer.circom`)

**Purpose:** Proves ownership and enables private transfers.

**Public Inputs:**
- `root`: Merkle tree root
- `nullifierHash`: Prevents double-spending
- `outputCommitment1`: New note for recipient
- `outputCommitment2`: Change note for sender
- `relayer`: Relayer address (or 0)
- `fee`: Relayer fee (or 0)

**Private Inputs:**
- Input note details (amount, owner, secret, blinding)
- Merkle path (pathElements, pathIndices)
- Spending key (proves ownership)
- Output note details (for both outputs)

**Constraints:** ~80,000

### Unshield Circuit (`unshield.circom`)

**Purpose:** Proves ownership and enables withdrawal to public address.

**Public Inputs:**
- `root`: Merkle tree root
- `nullifierHash`: Prevents double-spending
- `recipient`: Public Ethereum address
- `amount`: Withdrawal amount
- `relayer`: Relayer address
- `fee`: Relayer fee

**Private Inputs:**
- Note details
- Merkle path
- Spending key

**Constraints:** ~40,000

## Building

### Prerequisites

1. **Circom** (>= 2.1.8)
   ```bash
   curl -Ls https://raw.githubusercontent.com/iden3/circom/master/install.sh | bash
   ```

2. **snarkjs**
   ```bash
   npm install -g snarkjs
   ```

3. **Node.js** (>= 18)

### Build All Circuits

```bash
cd circuits/shielded
./build.sh
```

This will:
1. Compile all circuits
2. Generate proving keys (zkey)
3. Generate verification keys
4. Generate Solidity verifiers
5. Copy files to `public/circuits/shielded/`

### Build Single Circuit

```bash
# Compile
circom shield.circom --r1cs --wasm --sym --output build

# Setup
snarkjs groth16 setup build/shield.r1cs ../pot15_final.ptau build/shield_0000.zkey

# Contribute
snarkjs zkey contribute build/shield_0000.zkey build/shield_final.zkey -e="random entropy"

# Export verification key
snarkjs zkey export verificationkey build/shield_final.zkey build/shield_verification_key.json

# Generate Solidity verifier
snarkjs zkey export solidityverifier build/shield_final.zkey build/ShieldVerifier.sol
```

## Testing

### Generate Test Proof

```bash
# Create input.json with test values
echo '{
  "commitment": "12345...",
  "amount": "100000000000000000000",
  "ownerPubkey": "67890...",
  "secret": "11111...",
  "blinding": "22222..."
}' > build/shield_input.json

# Generate witness
node build/shield_js/generate_witness.js \
  build/shield_js/shield.wasm \
  build/shield_input.json \
  build/shield_witness.wtns

# Generate proof
snarkjs groth16 prove \
  build/shield_final.zkey \
  build/shield_witness.wtns \
  build/shield_proof.json \
  build/shield_public.json

# Verify proof
snarkjs groth16 verify \
  build/shield_verification_key.json \
  build/shield_public.json \
  build/shield_proof.json
```

## Cryptographic Primitives

### Commitment

```
C = MiMC(MiMC(amount, ownerPubkey), MiMC(secret, blinding))
```

### Nullifier

```
N = MiMC(MiMC(secret, leafIndex), spendingKey)
NH = MiMC(N, N)  // Published on-chain
```

### Shielded Address Derivation

```
shieldedAddress = MiMC(spendingKey, 2)  // 2 = DOMAIN.SHIELDED_ADDRESS
```

## Security Notes

1. **Trusted Setup**: These circuits use Powers of Tau from the Hermez ceremony. For production, consider running your own ceremony.

2. **Randomness**: The secret and blinding values must be cryptographically random. Never reuse them.

3. **Key Security**: The spending key is the master key. Losing it means losing access to all shielded funds.

4. **Merkle Tree**: Uses 20 levels (supports ~1M notes). MiMC hash is used for compatibility.

## File Structure

```
circuits/shielded/
├── shield.circom       # Shield circuit
├── transfer.circom     # Transfer circuit
├── unshield.circom     # Unshield circuit
├── build.sh            # Build script
├── README.md           # This file
└── build/              # Build output (generated)
    ├── shield.r1cs
    ├── shield.wasm
    ├── shield_final.zkey
    ├── shield_verification_key.json
    ├── shieldVerifier.sol
    └── ... (same for transfer and unshield)
```

## License

MIT


