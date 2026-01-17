# zDOGE.CASH - Test Execution Script (PowerShell)
# This script helps execute comprehensive tests

Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           zDOGE.CASH - Comprehensive Test Suite              ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Test results
$script:PASSED = 0
$script:FAILED = 0
$script:SKIPPED = 0

# Function to print test result
function Print-Result {
    param(
        [bool]$Success,
        [string]$Message
    )
    
    if ($Success) {
        Write-Host "✓ PASSED: $Message" -ForegroundColor Green
        $script:PASSED++
    } else {
        Write-Host "✗ FAILED: $Message" -ForegroundColor Red
        $script:FAILED++
    }
}

# Function to check if service is running
function Test-Service {
    param([string]$Url)
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            return $true
        } else {
            return $false
        }
    } catch {
        return $false
    }
}

Write-Host "=== 1. PRE-TEST CHECKS ===" -ForegroundColor Yellow
Write-Host ""

# Check if backend is running
Write-Host "Checking backend service..."
if (Test-Service "http://localhost:3001/health") {
    Print-Result $true "Backend service is running"
} else {
    Print-Result $false "Backend service is not running (expected at http://localhost:3001)"
    Write-Host "  → Start backend: cd backend && npm run dev" -ForegroundColor Gray
}

# Check if frontend is running
Write-Host "Checking frontend service..."
if (Test-Service "http://localhost:3000") {
    Print-Result $true "Frontend service is running"
} else {
    Print-Result $false "Frontend service is not running (expected at http://localhost:3000)"
    Write-Host "  → Start frontend: npm run dev" -ForegroundColor Gray
}

# Check if contracts are deployed
Write-Host "Checking contract deployment..."
if (Test-Path "contracts\.env") {
    Print-Result $true "Contract config found"
} else {
    Print-Result $false "Contract config not found"
}

Write-Host ""
Write-Host "=== 2. CODE QUALITY CHECKS ===" -ForegroundColor Yellow
Write-Host ""

# Check for TypeScript errors
Write-Host "Checking TypeScript compilation..."
try {
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Print-Result $true "TypeScript compilation successful"
    } else {
        Print-Result $false "TypeScript compilation failed"
        Write-Host "  → Run: npm run build" -ForegroundColor Gray
    }
} catch {
    Print-Result $false "Could not run build command"
}

# Check for linting errors
Write-Host "Checking code linting..."
try {
    $lintOutput = npm run lint 2>&1
    if ($LASTEXITCODE -eq 0) {
        Print-Result $true "Code linting passed"
    } else {
        Print-Result $false "Code linting failed"
        Write-Host "  → Run: npm run lint" -ForegroundColor Gray
    }
} catch {
    Print-Result $false "Could not run lint command"
}

Write-Host ""
Write-Host "=== 3. CONTRACT TESTS ===" -ForegroundColor Yellow
Write-Host ""

# Check if Hardhat tests exist
if (Test-Path "contracts\test") {
    Write-Host "Running contract tests..."
    Push-Location contracts
    try {
        $testOutput = npx hardhat test 2>&1
        if ($LASTEXITCODE -eq 0) {
            Print-Result $true "Contract tests passed"
        } else {
            Print-Result $false "Contract tests failed"
            Write-Host "  → Run: cd contracts && npx hardhat test" -ForegroundColor Gray
        }
    } catch {
        Print-Result $false "Could not run contract tests"
    }
    Pop-Location
} else {
    Print-Result $false "Contract tests directory not found"
}

Write-Host ""
Write-Host "=== 4. BACKEND API TESTS ===" -ForegroundColor Yellow
Write-Host ""

# Test indexer endpoints
if (Test-Service "http://localhost:3001/health") {
    Write-Host "Testing indexer endpoints..."
    
    # Test health endpoint
    try {
        $healthResponse = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method Get
        if ($healthResponse.Content -match "ok") {
            Print-Result $true "Health endpoint working"
        } else {
            Print-Result $false "Health endpoint not working"
        }
    } catch {
        Print-Result $false "Health endpoint not accessible"
    }
    
    # Test metrics endpoint
    if (Test-Service "http://localhost:3001/metrics") {
        Print-Result $true "Metrics endpoint accessible"
    } else {
        Print-Result $false "Metrics endpoint not accessible"
    }
} else {
    Write-Host "Skipping API tests (backend not running)" -ForegroundColor Gray
    $script:SKIPPED++
}

Write-Host ""
Write-Host "=== 5. FRONTEND BUILD TEST ===" -ForegroundColor Yellow
Write-Host ""

# Test frontend build
Write-Host "Testing frontend build..."
try {
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Print-Result $true "Frontend build successful"
    } else {
        Print-Result $false "Frontend build failed"
    }
} catch {
    Print-Result $false "Could not test frontend build"
}

Write-Host ""
Write-Host "=== 6. TEST SUMMARY ===" -ForegroundColor Yellow
Write-Host ""
$total = $script:PASSED + $script:FAILED + $script:SKIPPED
Write-Host "Total Tests: $total"
Write-Host "Passed: $script:PASSED" -ForegroundColor Green
Write-Host "Failed: $script:FAILED" -ForegroundColor Red
Write-Host "Skipped: $script:SKIPPED" -ForegroundColor Yellow
Write-Host ""

if ($script:FAILED -eq 0) {
    Write-Host "All automated tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Please review the output above." -ForegroundColor Red
    exit 1
}
