# Regenerate ALL Verifier Contracts from their zkeys
# This ensures all verifiers match their circuits' public input counts

$ErrorActionPreference = "Stop"

$CIRCUIT_DIR = $PSScriptRoot
$BUILD_DIR = Join-Path $CIRCUIT_DIR "build"
$projectRoot = Split-Path (Split-Path $CIRCUIT_DIR -Parent) -Parent
$contractsSrc = Join-Path (Join-Path $projectRoot "contracts") "src"
$publicCircuits = Join-Path (Join-Path $projectRoot "public") "circuits\shielded"

Write-Host "=======================================================" -ForegroundColor Green
Write-Host "   Regenerating ALL Verifier Contracts                 " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""

# Check if snarkjs is available
$snarkjsCheck = Get-Command snarkjs -ErrorAction SilentlyContinue
if (-not $snarkjsCheck) {
    Write-Host "Error: snarkjs is required but not installed." -ForegroundColor Red
    Write-Host "Install with: npm install -g snarkjs" -ForegroundColor Yellow
    exit 1
}

# Define all verifiers to generate
$verifiers = @(
    @{
        Name = "ShieldVerifier"
        ZkeyFile = "shield_final.zkey"
        ExpectedPublicInputs = 2
        Description = "Shield (deposit) operation"
    },
    @{
        Name = "TransferVerifier"
        ZkeyFile = "transfer_final.zkey"
        ExpectedPublicInputs = 6
        Description = "Transfer (send) operation"
    },
    @{
        Name = "UnshieldVerifier"
        ZkeyFile = "unshield_final.zkey"
        ExpectedPublicInputs = 7
        Description = "Unshield (withdraw) operation"
    },
    @{
        Name = "SwapVerifier"
        ZkeyFile = "swap_final.zkey"
        ExpectedPublicInputs = 8
        Description = "Swap operation"
    }
)

$successCount = 0
$failCount = 0

foreach ($verifier in $verifiers) {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "Processing: $($verifier.Name) - $($verifier.Description)" -ForegroundColor Cyan
    Write-Host "Expected Public Inputs: $($verifier.ExpectedPublicInputs)" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    
    # Try to find zkey in multiple locations
    $zkeyPaths = @(
        Join-Path $BUILD_DIR $verifier.ZkeyFile
        Join-Path $publicCircuits $verifier.ZkeyFile
    )
    
    $zkeyFile = $null
    foreach ($path in $zkeyPaths) {
        if (Test-Path $path) {
            $zkeyFile = $path
            break
        }
    }
    
    if (-not $zkeyFile) {
        Write-Host "  ❌ ERROR: $($verifier.ZkeyFile) not found!" -ForegroundColor Red
        Write-Host "    Searched in:" -ForegroundColor Yellow
        foreach ($path in $zkeyPaths) {
            Write-Host "      - $path" -ForegroundColor Yellow
        }
        $failCount++
        continue
    }
    
    Write-Host "  ✓ Found zkey: $zkeyFile" -ForegroundColor Green
    
    # Generate verifier contract
    $verifierOutput = Join-Path $BUILD_DIR "$($verifier.Name).sol"
    Write-Host "  Generating Solidity verifier..." -ForegroundColor Cyan
    
    & snarkjs zkey export solidityverifier $zkeyFile $verifierOutput
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ ERROR: Failed to generate $($verifier.Name)" -ForegroundColor Red
        $failCount++
        continue
    }
    
    Write-Host "  ✓ Verifier contract generated" -ForegroundColor Green
    
    # Read and modify the contract (rename from Groth16Verifier to actual name)
    $contractContent = Get-Content $verifierOutput -Raw
    $contractContent = $contractContent -replace 'contract Groth16Verifier', "contract $($verifier.Name)"
    
    # Verify public input count by checking verification key
    $vkeyFile = $zkeyFile -replace '\.zkey$', '_vkey.json'
    if (-not (Test-Path $vkeyFile)) {
        # Try public directory
        $vkeyFile = Join-Path $publicCircuits ($verifier.ZkeyFile -replace '\.zkey$', '_verification_key.json')
    }
    
    if (Test-Path $vkeyFile) {
        $vkey = Get-Content $vkeyFile | ConvertFrom-Json
        $actualPublicInputs = $vkey.nPublic
        
        Write-Host "  Checking public input count..." -ForegroundColor Cyan
        Write-Host "    Expected: $($verifier.ExpectedPublicInputs)" -ForegroundColor White
        Write-Host "    Actual:   $actualPublicInputs" -ForegroundColor White
        
        if ($actualPublicInputs -eq $verifier.ExpectedPublicInputs) {
            Write-Host "  ✓ Public input count matches!" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  WARNING: Public input count mismatch!" -ForegroundColor Yellow
            Write-Host "    This verifier expects $actualPublicInputs inputs, but contract uses $($verifier.ExpectedPublicInputs)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  WARNING: Could not find verification key to verify public input count" -ForegroundColor Yellow
    }
    
    # Backup existing contract if it exists
    $contractDest = Join-Path $contractsSrc "$($verifier.Name).sol"
    if (Test-Path $contractDest) {
        $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $backupPath = "$contractDest.backup.$timestamp"
        Write-Host "  Backing up existing contract..." -ForegroundColor Cyan
        Copy-Item $contractDest $backupPath -Force
        Write-Host "  ✓ Backed up to: $backupPath" -ForegroundColor Green
    }
    
    # Copy to contracts/src
    Write-Host "  Copying to contracts/src..." -ForegroundColor Cyan
    Set-Content -Path $contractDest -Value $contractContent -NoNewline
    
    if (Test-Path $contractDest) {
        Write-Host "  ✓ $($verifier.Name) copied to: $contractDest" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  ❌ ERROR: Failed to copy $($verifier.Name)" -ForegroundColor Red
        $failCount++
    }
} # End foreach

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "   Summary                                           " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  ✓ Successfully generated: $successCount verifiers" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "  ❌ Failed: $failCount verifiers" -ForegroundColor Red
}
Write-Host ""

if ($successCount -eq $verifiers.Count) {
    Write-Host "✅ All verifiers generated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Review the generated contracts in contracts/src/" -ForegroundColor White
    Write-Host "  2. Deploy using deploy-all-verifiers-final.ts:" -ForegroundColor White
    Write-Host "     cd contracts" -ForegroundColor Cyan
    Write-Host "     npx hardhat run scripts/deploy-all-verifiers-final.ts --network dogeosTestnet" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "⚠️  Some verifiers failed to generate. Please check the errors above." -ForegroundColor Yellow
    exit 1
}
