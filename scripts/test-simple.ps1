# Simple test script
Write-Host "=== zDOGE.CASH Automated Tests ===" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0

# Test 1: Check backend
Write-Host "Test 1: Backend Service" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  PASSED: Backend is running" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  FAILED: Backend not running" -ForegroundColor Red
    $failed++
}

# Test 2: Check frontend
Write-Host "Test 2: Frontend Service" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  PASSED: Frontend is running" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  FAILED: Frontend not running" -ForegroundColor Red
    $failed++
}

# Test 3: Check files
Write-Host "Test 3: File Structure" -ForegroundColor Yellow
if (Test-Path "components\shielded") {
    Write-Host "  PASSED: Components directory exists" -ForegroundColor Green
    $passed++
} else {
    Write-Host "  FAILED: Components directory missing" -ForegroundColor Red
    $failed++
}

if (Test-Path "contracts\src\ShieldedPoolMultiTokenV2.sol") {
    Write-Host "  PASSED: V2 contract exists" -ForegroundColor Green
    $passed++
} else {
    Write-Host "  FAILED: V2 contract missing" -ForegroundColor Red
    $failed++
}

# Summary
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
