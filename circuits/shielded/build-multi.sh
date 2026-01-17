#!/bin/bash

# Build script for multi-input transfer circuit
# This compiles the circuit, generates proving/verification keys

set -e

echo "🔧 Building Multi-Input Transfer Circuit..."
echo "This may take 30-60 minutes depending on your machine"
echo ""

CIRCUIT_NAME="transfer_multi"
BUILD_DIR="build"
PTAU_FILE="../pot20_final.ptau"

# Create build directory
mkdir -p $BUILD_DIR

echo "Step 1/6: Compiling circuit..."
circom ${CIRCUIT_NAME}.circom --r1cs --wasm --sym -o $BUILD_DIR

echo "Step 2/6: Generating witness calculator..."
cd $BUILD_DIR/${CIRCUIT_NAME}_js
node generate_witness.js ${CIRCUIT_NAME}.wasm ../../test_input.json witness.wtns 2>/dev/null || echo "Test witness generation (will work after we create test input)"
cd ../..

echo "Step 3/6: Generating zkey (phase 1)..."
npx snarkjs groth16 setup $BUILD_DIR/${CIRCUIT_NAME}.r1cs $PTAU_FILE $BUILD_DIR/${CIRCUIT_NAME}_0000.zkey

echo "Step 4/6: Contributing to ceremony (phase 2)..."
echo "random entropy" | npx snarkjs zkey contribute $BUILD_DIR/${CIRCUIT_NAME}_0000.zkey $BUILD_DIR/${CIRCUIT_NAME}_final.zkey --name="Contribution" -v

echo "Step 5/6: Exporting verification key..."
npx snarkjs zkey export verificationkey $BUILD_DIR/${CIRCUIT_NAME}_final.zkey $BUILD_DIR/${CIRCUIT_NAME}_vkey.json

echo "Step 6/6: Generating Solidity verifier..."
npx snarkjs zkey export solidityverifier $BUILD_DIR/${CIRCUIT_NAME}_final.zkey $BUILD_DIR/TransferMultiVerifier.sol

echo ""
echo "✅ Build complete!"
echo ""
echo "Generated files:"
echo "  - $BUILD_DIR/${CIRCUIT_NAME}.r1cs (circuit constraints)"
echo "  - $BUILD_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm (witness generator)"
echo "  - $BUILD_DIR/${CIRCUIT_NAME}_final.zkey (proving key)"
echo "  - $BUILD_DIR/${CIRCUIT_NAME}_vkey.json (verification key)"
echo "  - $BUILD_DIR/TransferMultiVerifier.sol (Solidity verifier contract)"
echo ""
echo "Next steps:"
echo "  1. Copy .wasm and .zkey to public/circuits/"
echo "  2. Deploy TransferMultiVerifier.sol"
echo "  3. Update frontend to use new proof generation"
