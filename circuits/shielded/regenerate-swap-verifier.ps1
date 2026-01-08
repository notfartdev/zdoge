# Regenerate SwapVerifier contract from updated circuit
# This script generates the Solidity verifier contract from the current swap circuit

$ErrorActionPreference = "Stop"

$CIRCUIT_DIR = $PSScriptRoot
$BUILD_DIR = Join-Path $CIRCUIT_DIR "build"
$ZKEY_FILE = Join-Path $BUILD_DIR "swap_final.zkey"
$VERIFIER_OUTPUT = Join-Path $BUILD_DIR "SwapVerifier.sol"
$projectRoot = Split-Path (Split-Path $CIRCUIT_DIR -Parent) -Parent
$contractsSrc = Join-Path (Join-Path $projectRoot "contracts") "src"
$CONTRACT_DEST = Join-Path $contractsSrc "SwapVerifier.sol"

Write-Host "=======================================================" -ForegroundColor Green
Write-Host "   Regenerating SwapVerifier Contract                  " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""

# Check if snarkjs is available
$snarkjsCheck = Get-Command snarkjs -ErrorAction SilentlyContinue
if (-not $snarkjsCheck) {
    Write-Host "Error: snarkjs is required but not installed." -ForegroundColor Red
    Write-Host "Install with: npm install -g snarkjs" -ForegroundColor Yellow
    exit 1
}

# Check if zkey exists
if (-not (Test-Path $ZKEY_FILE)) {
    Write-Host "Error: swap_final.zkey not found at: $ZKEY_FILE" -ForegroundColor Red
    Write-Host ""
    Write-Host "You need to rebuild the circuit first:" -ForegroundColor Yellow
    Write-Host "  cd circuits/shielded" -ForegroundColor Cyan
    Write-Host "  .\rebuild-swap-pot16.ps1" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "Found zkey file: $ZKEY_FILE" -ForegroundColor Green
Write-Host ""

# Generate Solidity verifier contract
Write-Host "[1/3] Generating Solidity verifier contract..." -ForegroundColor Cyan
& snarkjs zkey export solidityverifier $ZKEY_FILE $VERIFIER_OUTPUT

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to generate verifier contract" -ForegroundColor Red
    exit 1
}

Write-Host "  OK: Verifier contract generated" -ForegroundColor Green
Write-Host ""

# Check if contract already exists and backup
if (Test-Path $CONTRACT_DEST) {
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupPath = "$CONTRACT_DEST.backup.$timestamp"
    Write-Host "[2/3] Backing up existing verifier..." -ForegroundColor Cyan
    Copy-Item $CONTRACT_DEST $backupPath -Force
    Write-Host "  OK: Backed up to: $backupPath" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[2/3] No existing verifier found (first generation)" -ForegroundColor Cyan
    Write-Host ""
}

# Ensure contracts/src directory exists
if (-not (Test-Path $contractsSrc)) {
    New-Item -ItemType Directory -Path $contractsSrc -Force | Out-Null
}

# Copy to contracts/src
Write-Host "[3/3] Copying verifier to contracts/src..." -ForegroundColor Cyan
Copy-Item $VERIFIER_OUTPUT $CONTRACT_DEST -Force

if (Test-Path $CONTRACT_DEST) {
    Write-Host "  OK: Verifier contract copied to: $CONTRACT_DEST" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Failed to copy verifier contract" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "   SwapVerifier Contract Generated Successfully!      " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review the generated contract:" -ForegroundColor White
Write-Host "     contracts/src/SwapVerifier.sol" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Deploy the new SwapVerifier:" -ForegroundColor White
Write-Host "     cd contracts" -ForegroundColor Cyan
Write-Host "     npx hardhat run scripts/deploy-swap-verifier-only.ts --network dogeosTestnet" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Update ShieldedPoolMultiToken with new verifier address:" -ForegroundColor White
Write-Host "     Edit contracts/scripts/deploy-shielded-multitoken.ts" -ForegroundColor Cyan
Write-Host "     Replace the SwapVerifier deployment with the new address" -ForegroundColor Cyan
Write-Host ""
Write-Host "  4. Redeploy ShieldedPoolMultiToken:" -ForegroundColor White
Write-Host "     npx hardhat run scripts/deploy-shielded-multitoken.ts --network dogeosTestnet" -ForegroundColor Cyan
Write-Host ""
Write-Host "  5. Update lib/dogeos-config.ts with new contract addresses" -ForegroundColor White
Write-Host ""
