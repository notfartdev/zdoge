#!/bin/bash

# Build script for Shielded Transaction Circuits
# Requires: circom, snarkjs, node

set -e

CIRCUIT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$CIRCUIT_DIR/build"
PTAU_FILE="$CIRCUIT_DIR/../pot15_final.ptau"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      Dogenado Shielded Circuits Build Script               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"

# Check dependencies
command -v circom >/dev/null 2>&1 || { echo -e "${RED}Error: circom is required but not installed.${NC}" >&2; exit 1; }
command -v snarkjs >/dev/null 2>&1 || { echo -e "${RED}Error: snarkjs is required but not installed.${NC}" >&2; exit 1; }

# Check PTAU file
if [ ! -f "$PTAU_FILE" ]; then
    echo -e "${YELLOW}Downloading Powers of Tau...${NC}"
    curl -L -o "$PTAU_FILE" https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau
fi

# Create build directory
mkdir -p "$BUILD_DIR"

# Build each circuit
CIRCUITS=("shield" "transfer" "unshield" "swap")

for circuit in "${CIRCUITS[@]}"; do
    echo ""
    echo -e "${YELLOW}Building $circuit circuit...${NC}"
    
    # Compile circuit
    echo "  [1/5] Compiling circuit..."
    circom "$CIRCUIT_DIR/$circuit.circom" \
        --r1cs \
        --wasm \
        --sym \
        --output "$BUILD_DIR"
    
    # Generate verification key (phase 2)
    echo "  [2/5] Generating zkey (phase 2 - this takes a while)..."
    snarkjs groth16 setup \
        "$BUILD_DIR/${circuit}.r1cs" \
        "$PTAU_FILE" \
        "$BUILD_DIR/${circuit}_0000.zkey"
    
    # Contribute to phase 2 (add randomness)
    echo "  [3/5] Contributing randomness..."
    snarkjs zkey contribute \
        "$BUILD_DIR/${circuit}_0000.zkey" \
        "$BUILD_DIR/${circuit}_final.zkey" \
        --name="Dogenado $circuit contribution" \
        -e="$(head -c 64 /dev/urandom | xxd -ps)"
    
    # Export verification key
    echo "  [4/5] Exporting verification key..."
    snarkjs zkey export verificationkey \
        "$BUILD_DIR/${circuit}_final.zkey" \
        "$BUILD_DIR/${circuit}_verification_key.json"
    
    # Generate Solidity verifier
    echo "  [5/5] Generating Solidity verifier..."
    snarkjs zkey export solidityverifier \
        "$BUILD_DIR/${circuit}_final.zkey" \
        "$BUILD_DIR/${circuit}Verifier.sol"
    
    echo -e "${GREEN}  ✓ $circuit circuit built successfully!${NC}"
done

# Copy files to public directory for frontend
echo ""
echo -e "${YELLOW}Copying files to public/circuits/shielded...${NC}"
PUBLIC_DIR="../../public/circuits/shielded"
mkdir -p "$PUBLIC_DIR"

for circuit in "${CIRCUITS[@]}"; do
    cp "$BUILD_DIR/${circuit}_js/${circuit}.wasm" "$PUBLIC_DIR/"
    cp "$BUILD_DIR/${circuit}_final.zkey" "$PUBLIC_DIR/"
    cp "$BUILD_DIR/${circuit}_verification_key.json" "$PUBLIC_DIR/"
done

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      Build Complete!                                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Circuit files are in: $BUILD_DIR"
echo "Frontend files copied to: public/circuits/shielded/"
echo ""
echo "Next steps:"
echo "  1. Copy *Verifier.sol files to contracts/src/"
echo "  2. Deploy ShieldedPool with verifier addresses"
echo "  3. Update SHIELDED_POOL_ADDRESS in frontend"

