# Dogenado ZK Circuits

Zero-knowledge circuits for the Dogenado privacy pool.

## Prerequisites

1. Install Circom 2.1.8+:
```bash
# Install Rust first
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh

# Clone and build Circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
```

2. Install dependencies:
```bash
npm install
```

3. Download Powers of Tau ceremony file:
```bash
npm run download:ptau
```

## Building the Circuit

### 1. Compile the circuit
```bash
npm run compile
```

This generates:
- `build/withdraw.r1cs` - R1CS constraint system
- `build/withdraw_js/` - WASM prover
- `build/withdraw.sym` - Symbol file for debugging

### 2. Generate proving key (trusted setup)
```bash
npm run setup
npm run contribute
```

### 3. Export verification key and Solidity verifier
```bash
npm run export:vkey
npm run export:verifier
```

## Circuit Details

### Withdraw Circuit

The withdrawal circuit proves:

1. **Knowledge of preimage**: Prover knows `(secret, nullifier)` such that:
   - `commitment = MiMC(secret, nullifier)`
   
2. **Merkle membership**: The `commitment` exists in the Merkle tree:
   - Uses `pathElements` and `pathIndices` to reconstruct root
   - Verifies reconstructed root matches public `root`

3. **Nullifier binding**: The `nullifierHash = MiMC(nullifier, nullifier)` matches:
   - Prevents double-spending
   - Same nullifier always produces same hash

4. **Public input binding**: Recipient, relayer, fee, denomination are constrained:
   - Prevents front-running and parameter manipulation

### Public Inputs (6)
| Input | Description |
|-------|-------------|
| root | Merkle tree root (from contract) |
| nullifierHash | Prevents double-spend |
| recipient | Where to send funds |
| relayer | Who pays gas (or 0) |
| fee | Relayer compensation |
| denomination | Pool amount |

### Private Inputs (42)
| Input | Description |
|-------|-------------|
| secret | 31-byte random secret |
| nullifier | 31-byte random nullifier |
| pathElements[20] | Merkle path siblings |
| pathIndices[20] | Left/right indicators |

## Testing

Generate a test proof:
```bash
# Create input file
cat > build/input.json << EOF
{
  "root": "123...",
  "nullifierHash": "456...",
  "recipient": "0x...",
  "relayer": "0",
  "fee": "0",
  "denomination": "100000000",
  "secret": "789...",
  "nullifier": "abc...",
  "pathElements": [...],
  "pathIndices": [...]
}
EOF

# Generate witness
node build/withdraw_js/generate_witness.js build/withdraw_js/withdraw.wasm build/input.json build/witness.wtns

# Generate proof
npm run prove

# Verify proof
npm run verify
```

## Security Considerations

1. **Trusted Setup**: The ceremony file (`pot12_final.ptau`) should be from a trusted multi-party computation ceremony. For production, use Hermez's ceremony.

2. **Circuit Auditing**: Before mainnet, have the circuit audited by a ZK security firm.

3. **Nullifier Uniqueness**: Each nullifier should be cryptographically random (32 bytes from secure RNG).

4. **Secret Storage**: Users must store their notes offline. Loss = loss of funds.

