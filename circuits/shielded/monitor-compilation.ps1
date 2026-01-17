# Real-time compilation progress monitor
# Shows live progress of transfer_multi circuit compilation

$ErrorActionPreference = "Continue"

Write-Host "🔍 Monitoring Multi-Input Circuit Compilation..." -ForegroundColor Cyan
Write-Host ""

$buildDir = "build"
$r1csFile = "$buildDir\transfer_multi.r1cs"
$zkeyFile = "$buildDir\transfer_multi_0000.zkey"
$finalZkeyFile = "$buildDir\transfer_multi_final.zkey"
$verifierFile = "$buildDir\TransferMultiVerifier.sol"

# Get reference sizes
$refR1cs = if (Test-Path "$buildDir\transfer.r1cs") { (Get-Item "$buildDir\transfer.r1cs").Length } else { 0 }
$refZkey = if (Test-Path "$buildDir\transfer_0000.zkey") { (Get-Item "$buildDir\transfer_0000.zkey").Length } else { 0 }

# Expected sizes (based on constraint count ratio)
$expectedZkeySize = [math]::Round($refZkey * 10, 0)  # ~10x more constraints

Write-Host "📊 Circuit Stats:" -ForegroundColor Yellow
Write-Host "  R1CS file: $([math]::Round((Get-Item $r1csFile).Length / 1MB, 2)) MB" -ForegroundColor Green
Write-Host "  Constraints: 353,194" -ForegroundColor Green
Write-Host "  Expected zkey size: ~$([math]::Round($expectedZkeySize / 1MB, 2)) MB" -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date
$lastSize = 0
$checkCount = 0

Write-Host "⏳ Waiting for zkey generation to start..." -ForegroundColor Yellow
Write-Host ""

while ($true) {
    $checkCount++
    $currentTime = Get-Date
    $elapsed = $currentTime - $startTime
    $elapsedMinutes = [math]::Round($elapsed.TotalMinutes, 1)
    
    Clear-Host
    Write-Host "🔍 Multi-Input Circuit Compilation Monitor" -ForegroundColor Cyan
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check Step 3: Phase 1 zkey generation
    if (Test-Path $zkeyFile) {
        $zkey = Get-Item $zkeyFile
        $currentSize = $zkey.Size
        $sizeMB = [math]::Round($currentSize / 1MB, 2)
        $percent = [math]::Round(($currentSize / $expectedZkeySize) * 100, 1)
        
        if ($percent -gt 100) { $percent = 100 }
        
        Write-Host "✅ Step 3/6: Phase 1 zkey generation (IN PROGRESS)" -ForegroundColor Green
        Write-Host "   File: transfer_multi_0000.zkey" -ForegroundColor White
        Write-Host "   Current size: $sizeMB MB" -ForegroundColor Cyan
        Write-Host "   Expected size: $([math]::Round($expectedZkeySize / 1MB, 2)) MB" -ForegroundColor Yellow
        Write-Host "   Progress: $percent%" -ForegroundColor $(if ($percent -lt 50) { "Yellow" } elseif ($percent -lt 90) { "Cyan" } else { "Green" })
        Write-Host "   Elapsed: $elapsedMinutes minutes" -ForegroundColor White
        
        # Show progress bar
        $barLength = 50
        $filled = [math]::Floor($percent / 100 * $barLength)
        $bar = "[" + ("=" * $filled) + (" " * ($barLength - $filled)) + "]"
        Write-Host "   $bar" -ForegroundColor $(if ($percent -lt 50) { "Yellow" } elseif ($percent -lt 90) { "Cyan" } else { "Green" })
        
        if ($currentSize -eq $lastSize -and $currentSize -gt 0) {
            Write-Host ""
            Write-Host "⚠️  File size unchanged - checking if process is still running..." -ForegroundColor Yellow
        } else {
            $lastSize = $currentSize
        }
        
    } else {
        Write-Host "⏳ Step 3/6: Phase 1 zkey generation (WAITING)" -ForegroundColor Yellow
        Write-Host "   File not created yet..." -ForegroundColor White
        Write-Host "   Elapsed: $elapsedMinutes minutes" -ForegroundColor White
        Write-Host ""
        Write-Host "💡 This step typically takes 20-40 minutes for 353k constraints" -ForegroundColor Cyan
    }
    
    Write-Host ""
    
    # Check Step 4: Phase 2 contribution
    if (Test-Path $finalZkeyFile) {
        Write-Host "✅ Step 4/6: Phase 2 contribution (COMPLETE)" -ForegroundColor Green
    } else {
        Write-Host "⏳ Step 4/6: Phase 2 contribution (PENDING)" -ForegroundColor Gray
    }
    
    # Check Step 5: Verification key
    if (Test-Path "$buildDir\transfer_multi_vkey.json") {
        Write-Host "✅ Step 5/6: Verification key export (COMPLETE)" -ForegroundColor Green
    } else {
        Write-Host "⏳ Step 5/6: Verification key export (PENDING)" -ForegroundColor Gray
    }
    
    # Check Step 6: Solidity verifier
    if (Test-Path $verifierFile) {
        Write-Host "✅ Step 6/6: Solidity verifier (COMPLETE)" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 COMPILATION COMPLETE!" -ForegroundColor Green
        break
    } else {
        Write-Host "⏳ Step 6/6: Solidity verifier (PENDING)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "Last check: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor DarkGray
    Write-Host "Checks: $checkCount" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor DarkGray
    
    Start-Sleep -Seconds 5
}
