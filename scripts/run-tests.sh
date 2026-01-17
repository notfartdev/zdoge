#!/bin/bash

# zDOGE.CASH - Test Execution Script
# This script helps execute comprehensive tests

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           zDOGE.CASH - Comprehensive Test Suite              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
SKIPPED=0

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}: $2"
        ((FAILED++))
    fi
}

# Function to check if service is running
check_service() {
    if curl -s "$1" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

echo "=== 1. PRE-TEST CHECKS ==="
echo ""

# Check if backend is running
echo "Checking backend service..."
if check_service "http://localhost:3001/health"; then
    print_result 0 "Backend service is running"
else
    print_result 1 "Backend service is not running (expected at http://localhost:3001)"
    echo "  → Start backend: cd backend && npm run dev"
fi

# Check if frontend is running
echo "Checking frontend service..."
if check_service "http://localhost:3000"; then
    print_result 0 "Frontend service is running"
else
    print_result 1 "Frontend service is not running (expected at http://localhost:3000)"
    echo "  → Start frontend: npm run dev"
fi

# Check if contracts are deployed
echo "Checking contract deployment..."
if [ -f "contracts/.env" ]; then
    print_result 0 "Contract config found"
else
    print_result 1 "Contract config not found"
fi

echo ""
echo "=== 2. CODE QUALITY CHECKS ==="
echo ""

# Check for TypeScript errors
echo "Checking TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
    print_result 0 "TypeScript compilation successful"
else
    print_result 1 "TypeScript compilation failed"
    echo "  → Run: npm run build"
fi

# Check for linting errors
echo "Checking code linting..."
if npm run lint > /dev/null 2>&1; then
    print_result 0 "Code linting passed"
else
    print_result 1 "Code linting failed"
    echo "  → Run: npm run lint"
fi

echo ""
echo "=== 3. CONTRACT TESTS ==="
echo ""

# Check if Hardhat tests exist
if [ -d "contracts/test" ]; then
    echo "Running contract tests..."
    cd contracts
    if npx hardhat test > /dev/null 2>&1; then
        print_result 0 "Contract tests passed"
    else
        print_result 1 "Contract tests failed"
        echo "  → Run: cd contracts && npx hardhat test"
    fi
    cd ..
else
    print_result 1 "Contract tests directory not found"
fi

echo ""
echo "=== 4. BACKEND API TESTS ==="
echo ""

# Test indexer endpoints
if check_service "http://localhost:3001/health"; then
    echo "Testing indexer endpoints..."
    
    # Test health endpoint
    if curl -s "http://localhost:3001/health" | grep -q "ok"; then
        print_result 0 "Health endpoint working"
    else
        print_result 1 "Health endpoint not working"
    fi
    
    # Test metrics endpoint
    if curl -s "http://localhost:3001/metrics" > /dev/null 2>&1; then
        print_result 0 "Metrics endpoint accessible"
    else
        print_result 1 "Metrics endpoint not accessible"
    fi
else
    echo "Skipping API tests (backend not running)"
    ((SKIPPED++))
fi

echo ""
echo "=== 5. FRONTEND BUILD TEST ==="
echo ""

# Test frontend build
echo "Testing frontend build..."
if npm run build > /dev/null 2>&1; then
    print_result 0 "Frontend build successful"
else
    print_result 1 "Frontend build failed"
fi

echo ""
echo "=== 6. TEST SUMMARY ==="
echo ""
echo "Total Tests: $((PASSED + FAILED + SKIPPED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All automated tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
