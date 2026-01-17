# Quick rebuild script for swap circuit using pot16 (faster)
# Use this after modifying swap.circom

$ErrorActionPreference = "Stop"

$CIRCUIT_DIR = $PSScriptRoot
$BUILD_DIR = Join-Path $CIRCUIT_DIR "build"
$PTAU_FILE = Join-Path $CIRCUIT_DIR "..\pot16_final.ptau"

Write-Host "=======================================================" -ForegroundColor Green
Write-Host "      Rebuilding Swap Circuit (pot16 - faster)        " -ForegroundColor Green
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
    Write-Host "Error: pot16_final.ptau not found at: $PTAU_FILE" -ForegroundColor Red
    Write-Host "Please ensure pot16_final.ptau exists in circuits/ directory" -ForegroundColor Yellow
    exit 1
}

# Create build directory
if (-not (Test-Path $BUILD_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
}

$circuit = "swap"
Write-Host ""
Write-Host "Rebuilding $circuit circuit with pot16..." -ForegroundColor Yellow

$circuitFile = Join-Path $CIRCUIT_DIR "$circuit.circom"

# Compile circuit
Write-Host "  [1/4] Compiling circuit..." -ForegroundColor Cyan
& circom $circuitFile --r1cs --wasm --sym --output $BUILD_DIR

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error compiling $circuit circuit" -ForegroundColor Red
    exit 1
}

Write-Host "  [1/4] OK: Compiled successfully" -ForegroundColor Green

$r1csFile = Join-Path $BUILD_DIR "$circuit.r1cs"
$zkey0File = Join-Path $BUILD_DIR "${circuit}_0000.zkey"
$zkeyFinalFile = Join-Path $BUILD_DIR "${circuit}_final.zkey"
$vkeyFile = Join-Path $BUILD_DIR "${circuit}_verification_key.json"

# Check constraint count
Write-Host "  [2/4] Checking constraint count..." -ForegroundColor Cyan
$r1csInfo = & snarkjs r1cs info $r1csFile 2>&1 | Select-String "Constraints"
$constraintCount = ($r1csInfo -split ":")[-1].Trim()
Write-Host "    Constraints: $constraintCount" -ForegroundColor Gray
$constraintNum = [int]$constraintCount
if ($constraintNum -gt 65536) {
    Write-Host "  Warning: Circuit has $constraintNum constraints, pot16 (65,536) may be too small!" -ForegroundColor Yellow
} else {
    Write-Host "  OK: Circuit fits in pot16 (max 65,536)" -ForegroundColor Green
}

# Generate verification key (phase 2) - This is the slow part, but pot16 is faster
Write-Host "  [3/4] Generating zkey with pot16 (this may take 10-30 min on Windows)..." -ForegroundColor Cyan
& snarkjs groth16 setup $r1csFile $PTAU_FILE $zkey0File

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error setting up $circuit zkey" -ForegroundColor Red
    exit 1
}

Write-Host "  [3/4] OK: Initial zkey generated" -ForegroundColor Green

# Contribute to phase 2 (add randomness)
Write-Host "  [4/4] Contributing randomness..." -ForegroundColor Cyan
$randomHex = -join ((1..64) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
$contributeName = "Dogenado_${circuit}_contribution"
& snarkjs zkey contribute $zkey0File $zkeyFinalFile ("--name=" + $contributeName) ("-e=" + $randomHex)

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error contributing to $circuit zkey" -ForegroundColor Red
    exit 1
}

Write-Host "  [4/4] OK: Final zkey generated" -ForegroundColor Green

# Export verification key
Write-Host "  Exporting verification key..." -ForegroundColor Cyan
& snarkjs zkey export verificationkey $zkeyFinalFile $vkeyFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error exporting $circuit verification key" -ForegroundColor Red
    exit 1
}

Write-Host "  OK: Verification key exported" -ForegroundColor Green

# Copy files to public directory for frontend
Write-Host ""
Write-Host "Copying files to public/circuits/shielded..." -ForegroundColor Yellow
$PUBLIC_DIR = Join-Path $CIRCUIT_DIR "..\..\public\circuits\shielded"
if (-not (Test-Path $PUBLIC_DIR)) {
    New-Item -ItemType Directory -Path $PUBLIC_DIR -Force | Out-Null
}

$wasmDir = Join-Path $BUILD_DIR "${circuit}_js"
$wasmFile = Join-Path $wasmDir "${circuit}.wasm"
$zkeyFile = Join-Path $BUILD_DIR "${circuit}_final.zkey"
$vkFile = Join-Path $BUILD_DIR "${circuit}_verification_key.json"

# Circuit version for cache-busting (must match CIRCUIT_VERSION in shielded-proof-service.ts)
$CIRCUIT_VERSION = "20260115"

if (Test-Path $wasmFile) { 
    # Copy both unversioned (for backward compatibility) and versioned (for current code)
    Copy-Item $wasmFile (Join-Path $PUBLIC_DIR "${circuit}.wasm") -Force
    Copy-Item $wasmFile (Join-Path $PUBLIC_DIR "${circuit}_${CIRCUIT_VERSION}.wasm") -Force
    Write-Host "  OK: Copied swap.wasm and swap_${CIRCUIT_VERSION}.wasm" -ForegroundColor Green
}
if (Test-Path $zkeyFile) { 
    # Copy both unversioned and versioned
    Copy-Item $zkeyFile (Join-Path $PUBLIC_DIR "${circuit}_final.zkey") -Force
    Copy-Item $zkeyFile (Join-Path $PUBLIC_DIR "${circuit}_final_${CIRCUIT_VERSION}.zkey") -Force
    Write-Host "  OK: Copied swap_final.zkey and swap_final_${CIRCUIT_VERSION}.zkey" -ForegroundColor Green
}
if (Test-Path $vkFile) { 
    Copy-Item $vkFile $PUBLIC_DIR -Force
    Write-Host "  OK: Copied swap_verification_key.json" -ForegroundColor Green
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "      Swap Circuit Rebuilt Successfully!              " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files updated:"
Write-Host "  - circuits/shielded/build/swap.wasm"
Write-Host "  - circuits/shielded/build/swap_final.zkey"
Write-Host "  - public/circuits/shielded/swap.wasm"
Write-Host "  - public/circuits/shielded/swap_${CIRCUIT_VERSION}.wasm"
Write-Host "  - public/circuits/shielded/swap_final.zkey"
Write-Host "  - public/circuits/shielded/swap_final_${CIRCUIT_VERSION}.zkey"
Write-Host "  - public/circuits/shielded/swap_verification_key.json"
Write-Host ""
Write-Host "⚠️  IMPORTANT: Verify the generated verifier matches deployed swapVerifier!" -ForegroundColor Yellow
Write-Host "   Deployed swapVerifier: 0xE264695FF93e2baa700C3518227EBc917092bd3A" -ForegroundColor Cyan
Write-Host "   If it doesn't match, you may need to use the original circuit source." -ForegroundColor Yellow
Write-Host ""
Write-Host "You can now test the swap functionality!"
Write-Host ""
