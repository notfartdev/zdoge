# Regenerate UnshieldVerifier contract from updated circuit
# This script generates the Solidity verifier contract from the current unshield circuit

$ErrorActionPreference = "Stop"

$CIRCUIT_DIR = $PSScriptRoot
$BUILD_DIR = Join-Path $CIRCUIT_DIR "build"
$ZKEY_FILE = Join-Path $BUILD_DIR "unshield_final.zkey"
$VERIFIER_OUTPUT = Join-Path $BUILD_DIR "UnshieldVerifier.sol"
$projectRoot = Split-Path (Split-Path $CIRCUIT_DIR -Parent) -Parent
$contractsSrc = Join-Path (Join-Path $projectRoot "contracts") "src"
# Use the main UnshieldVerifier.sol (will be renamed from Groth16Verifier by snarkjs)
$CONTRACT_DEST = Join-Path $contractsSrc "UnshieldVerifier.sol"

Write-Host "=======================================================" -ForegroundColor Green
Write-Host "   Regenerating UnshieldVerifier Contract             " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""

# Check if snarkjs is available
$snarkjsCheck = Get-Command snarkjs -ErrorAction SilentlyContinue
if (-not $snarkjsCheck) {
    Write-Host "Error: snarkjs is required but not installed." -ForegroundColor Red
    Write-Host "Install with: npm install -g snarkjs" -ForegroundColor Yellow
    exit 1
}

# Check if zkey exists (try both build directory and public directory)
$ZKEY_PUBLIC = Join-Path (Join-Path (Join-Path $projectRoot "public") "circuits") "shielded\unshield_final.zkey"
if (-not (Test-Path $ZKEY_FILE)) {
    if (Test-Path $ZKEY_PUBLIC) {
        Write-Host "Found zkey in public directory, using that..." -ForegroundColor Yellow
        $ZKEY_FILE = $ZKEY_PUBLIC
    } else {
        Write-Host "Error: unshield_final.zkey not found at:" -ForegroundColor Red
        Write-Host "  $ZKEY_FILE" -ForegroundColor Red
        Write-Host "  or $ZKEY_PUBLIC" -ForegroundColor Red
        Write-Host ""
        Write-Host "You need to rebuild the circuit first:" -ForegroundColor Yellow
        Write-Host "  cd circuits/shielded" -ForegroundColor Cyan
        Write-Host "  .\rebuild-transfer-unshield.ps1" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }
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

# Copy to contracts/src and rename contract from Groth16Verifier to UnshieldVerifier
Write-Host "[3/3] Copying and renaming verifier to contracts/src..." -ForegroundColor Cyan

# Read the generated contract
$contractContent = Get-Content $VERIFIER_OUTPUT -Raw

# Replace Groth16Verifier with UnshieldVerifier (snarkjs generates Groth16Verifier by default)
$contractContent = $contractContent -replace 'contract Groth16Verifier', 'contract UnshieldVerifier'

# Write to destination
Set-Content -Path $CONTRACT_DEST -Value $contractContent -NoNewline

if (Test-Path $CONTRACT_DEST) {
    Write-Host "  OK: Verifier contract copied and renamed to: $CONTRACT_DEST" -ForegroundColor Green
    Write-Host "  Contract name changed from Groth16Verifier to UnshieldVerifier" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Failed to copy verifier contract" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "   UnshieldVerifier Contract Generated Successfully!  " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review the generated contract:" -ForegroundColor White
Write-Host "     contracts/src/UnshieldVerifier.sol" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Deploy using redeploy-unshield-fix.ts:" -ForegroundColor White
Write-Host "     cd contracts" -ForegroundColor Cyan
Write-Host "     npx hardhat run scripts/redeploy-unshield-fix.ts --network dogeosTestnet" -ForegroundColor Cyan
Write-Host ""
