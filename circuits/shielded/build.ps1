# Build script for Shielded Transaction Circuits (PowerShell)
# Requires: circom, snarkjs, node

$ErrorActionPreference = "Stop"

$CIRCUIT_DIR = $PSScriptRoot
$BUILD_DIR = Join-Path $CIRCUIT_DIR "build"
$PTAU_FILE = Join-Path $CIRCUIT_DIR "..\pot20_final.ptau"

Write-Host "=======================================================" -ForegroundColor Green
Write-Host "      Dogenado Shielded Circuits Build Script          " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green

# Check dependencies
$circomCheck = Get-Command circom -ErrorAction SilentlyContinue
if (-not $circomCheck) {
    Write-Host "Error: circom is required but not installed." -ForegroundColor Red
    exit 1
}

$snarkjsCheck = Get-Command snarkjs -ErrorAction SilentlyContinue
if (-not $snarkjsCheck) {
    Write-Host "Error: snarkjs is required but not installed." -ForegroundColor Red
    exit 1
}

# Check PTAU file
if (-not (Test-Path $PTAU_FILE)) {
    Write-Host "Downloading Powers of Tau..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau" -OutFile $PTAU_FILE
}

# Create build directory
if (-not (Test-Path $BUILD_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
}

# Build each circuit
$CIRCUITS = @("shield", "transfer", "unshield", "swap")

foreach ($circuit in $CIRCUITS) {
    Write-Host ""
    Write-Host "Building $circuit circuit..." -ForegroundColor Yellow
    
    $circuitFile = Join-Path $CIRCUIT_DIR "$circuit.circom"
    
    # Compile circuit
    Write-Host "  [1/5] Compiling circuit..."
    & circom $circuitFile --r1cs --wasm --sym --output $BUILD_DIR
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error compiling $circuit circuit" -ForegroundColor Red
        exit 1
    }
    
    $r1csFile = Join-Path $BUILD_DIR "$circuit.r1cs"
    $zkey0File = Join-Path $BUILD_DIR "${circuit}_0000.zkey"
    $zkeyFinalFile = Join-Path $BUILD_DIR "${circuit}_final.zkey"
    $vkeyFile = Join-Path $BUILD_DIR "${circuit}_verification_key.json"
    $solFile = Join-Path $BUILD_DIR "${circuit}Verifier.sol"
    
    # Generate verification key (phase 2)
    Write-Host "  [2/5] Generating zkey (phase 2 - this takes a while)..."
    & snarkjs groth16 setup $r1csFile $PTAU_FILE $zkey0File
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error setting up $circuit zkey" -ForegroundColor Red
        exit 1
    }
    
    # Contribute to phase 2 (add randomness)
    Write-Host "  [3/5] Contributing randomness..."
    $randomHex = -join ((1..64) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
    $contributeName = "Dogenado_${circuit}_contribution"
    & snarkjs zkey contribute $zkey0File $zkeyFinalFile ("--name=" + $contributeName) ("-e=" + $randomHex)
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error contributing to $circuit zkey" -ForegroundColor Red
        exit 1
    }
    
    # Export verification key
    Write-Host "  [4/5] Exporting verification key..."
    & snarkjs zkey export verificationkey $zkeyFinalFile $vkeyFile
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error exporting $circuit verification key" -ForegroundColor Red
        exit 1
    }
    
    # Generate Solidity verifier
    Write-Host "  [5/5] Generating Solidity verifier..."
    & snarkjs zkey export solidityverifier $zkeyFinalFile $solFile
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error generating $circuit Solidity verifier" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  Done: $circuit circuit built successfully!" -ForegroundColor Green
}

# Copy files to public directory for frontend
Write-Host ""
Write-Host "Copying files to public/circuits/shielded..." -ForegroundColor Yellow
$PUBLIC_DIR = Join-Path $CIRCUIT_DIR "..\..\public\circuits\shielded"
if (-not (Test-Path $PUBLIC_DIR)) {
    New-Item -ItemType Directory -Path $PUBLIC_DIR -Force | Out-Null
}

foreach ($circuit in $CIRCUITS) {
    $wasmDir = Join-Path $BUILD_DIR "${circuit}_js"
    $wasmFile = Join-Path $wasmDir "${circuit}.wasm"
    $zkeyFile = Join-Path $BUILD_DIR "${circuit}_final.zkey"
    $vkFile = Join-Path $BUILD_DIR "${circuit}_verification_key.json"
    
    if (Test-Path $wasmFile) { Copy-Item $wasmFile $PUBLIC_DIR -Force }
    if (Test-Path $zkeyFile) { Copy-Item $zkeyFile $PUBLIC_DIR -Force }
    if (Test-Path $vkFile) { Copy-Item $vkFile $PUBLIC_DIR -Force }
}

# Copy verifier contracts to contracts/src/verifiers
Write-Host "Copying verifier contracts to contracts/src/verifiers..." -ForegroundColor Yellow
$CONTRACTS_DIR = Join-Path $CIRCUIT_DIR "..\..\contracts\src\verifiers"
if (-not (Test-Path $CONTRACTS_DIR)) {
    New-Item -ItemType Directory -Path $CONTRACTS_DIR -Force | Out-Null
}

foreach ($circuit in $CIRCUITS) {
    $srcFile = Join-Path $BUILD_DIR "${circuit}Verifier.sol"
    $capitalizedCircuit = (Get-Culture).TextInfo.ToTitleCase($circuit)
    $destFile = Join-Path $CONTRACTS_DIR "${capitalizedCircuit}Verifier.sol"
    if (Test-Path $srcFile) { Copy-Item $srcFile $destFile -Force }
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "      Build Complete!                                  " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Circuit files are in: $BUILD_DIR"
Write-Host "Frontend files copied to: public/circuits/shielded/"
Write-Host "Verifier contracts copied to: contracts/src/verifiers/"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Deploy ShieldedPool with real verifier addresses"
Write-Host "  2. Update SHIELDED_POOL_ADDRESS in frontend"
