# Quick status check for compilation
$buildDir = "build"
$zkeyFile = "$buildDir\transfer_multi_0000.zkey"
$expectedSizeMB = 228.1

Write-Host "Multi-Input Circuit Compilation Status" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $zkeyFile) {
    $zkey = Get-Item $zkeyFile
    $currentSizeMB = [math]::Round($zkey.Size / 1MB, 2)
    $percent = [math]::Min(100, [math]::Round(($zkey.Size / ($expectedSizeMB * 1MB)) * 100, 1))
    $elapsed = (Get-Date) - $zkey.CreationTime
    $elapsedMinutes = [math]::Round($elapsed.TotalMinutes, 1)
    
    Write-Host "Step 3/6: Phase 1 zkey generation" -ForegroundColor Green
    Write-Host "   File size: $currentSizeMB MB / ~$expectedSizeMB MB" -ForegroundColor Yellow
    Write-Host "   Progress: $percent%" -ForegroundColor Cyan
    Write-Host "   Running for: $elapsedMinutes minutes" -ForegroundColor White
    Write-Host ""
    
    # Progress bar
    $barLength = 50
    $filled = [math]::Floor($percent / 100 * $barLength)
    $bar = "[" + ("=" * $filled) + (" " * ($barLength - $filled)) + "]"
    Write-Host "   $bar" -ForegroundColor Green
    
    if ($percent -ge 100) {
        Write-Host ""
        Write-Host "Phase 1 complete! Moving to Phase 2..." -ForegroundColor Green
    }
} else {
    Write-Host "Step 3/6: Phase 1 zkey generation (WAITING)" -ForegroundColor Yellow
    Write-Host "   File not created yet - snarkjs is processing..." -ForegroundColor White
    Write-Host "   Expected time: 20-40 minutes for 353k constraints" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Next steps after completion:" -ForegroundColor Cyan
Write-Host "  4. Phase 2 contribution (~2 minutes)" -ForegroundColor White
Write-Host "  5. Export verification key (~1 minute)" -ForegroundColor White
Write-Host "  6. Generate Solidity verifier (~1 minute)" -ForegroundColor White
