# Build script for multi-input transfer circuit (PowerShell)
# This compiles the circuit, generates proving/verification keys

Write-Host "Building Multi-Input Transfer Circuit..." -ForegroundColor Cyan
Write-Host "This may take 30-60 minutes depending on your machine" -ForegroundColor Yellow
Write-Host ""

$CIRCUIT_NAME = "transfer_multi"
$BUILD_DIR = "build"
$PTAU_FILE = "..\pot20_final.ptau"

# Create build directory
New-Item -ItemType Directory -Force -Path $BUILD_DIR | Out-Null

Write-Host "Step 1/6: Compiling circuit..." -ForegroundColor Green
circom "$CIRCUIT_NAME.circom" --r1cs --wasm --sym -o $BUILD_DIR
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Circuit compilation failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2/6: Skipping witness test (no test input)..." -ForegroundColor Yellow

Write-Host "Step 3/6: Generating zkey (phase 1) - THIS TAKES A LONG TIME..." -ForegroundColor Green
npx snarkjs groth16 setup "$BUILD_DIR\$CIRCUIT_NAME.r1cs" $PTAU_FILE "$BUILD_DIR\${CIRCUIT_NAME}_0000.zkey"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Phase 1 setup failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Step 4/6: Contributing to ceremony (phase 2)..." -ForegroundColor Green
echo "random entropy for dogenado" | npx snarkjs zkey contribute "$BUILD_DIR\${CIRCUIT_NAME}_0000.zkey" "$BUILD_DIR\${CIRCUIT_NAME}_final.zkey" --name="Dogenado" -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Phase 2 contribution failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Step 5/6: Exporting verification key..." -ForegroundColor Green
npx snarkjs zkey export verificationkey "$BUILD_DIR\${CIRCUIT_NAME}_final.zkey" "$BUILD_DIR\${CIRCUIT_NAME}_vkey.json"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Verification key export failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Step 6/6: Generating Solidity verifier..." -ForegroundColor Green
npx snarkjs zkey export solidityverifier "$BUILD_DIR\${CIRCUIT_NAME}_final.zkey" "$BUILD_DIR\TransferMultiVerifier.sol"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Solidity verifier generation failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Generated files:"
Write-Host "  - $BUILD_DIR\$CIRCUIT_NAME.r1cs (circuit constraints)"
Write-Host "  - $BUILD_DIR\${CIRCUIT_NAME}_js\$CIRCUIT_NAME.wasm (witness generator)"
Write-Host "  - $BUILD_DIR\${CIRCUIT_NAME}_final.zkey (proving key)"
Write-Host "  - $BUILD_DIR\${CIRCUIT_NAME}_vkey.json (verification key)"
Write-Host "  - $BUILD_DIR\TransferMultiVerifier.sol (Solidity verifier contract)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Copy .wasm and .zkey to public/circuits/"
Write-Host "  2. Deploy TransferMultiVerifier.sol"
Write-Host "  3. Update frontend to use new proof generation"
