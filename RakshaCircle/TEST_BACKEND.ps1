@echo off
REM RakshaCircle Backend Smoke Test (Windows PowerShell)
REM Verifies all critical backend endpoints

$BASE_URL = "http://localhost:3000"
$API_URL = "$BASE_URL/api/v1/raksha"

$WALLET_1 = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
$WALLET_2 = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWYU"
$WALLET_3 = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCGLH"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "RakshaCircle Backend Smoke Test" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Target: $API_URL`n"

# Test 1: Health Check
Write-Host "Test 1/7: Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -ErrorAction Stop
    Write-Host "✓ PASS: Backend is healthy`n" -ForegroundColor Green
} catch {
    Write-Host "✗ FAIL: Backend health check failed" -ForegroundColor Red
    exit 1
}

# Test 2: Create Profile
Write-Host "Test 2/7: Create Profile" -ForegroundColor Yellow
try {
    $profile = Invoke-RestMethod -Uri "$API_URL/profile" -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body (@{walletAddress=$WALLET_1; name="Test User 1"} | ConvertTo-Json) `
        -ErrorAction Stop
    Write-Host "✓ PASS: Profile created`n" -ForegroundColor Green
} catch {
    Write-Host "✗ FAIL: Profile creation failed: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Add Trusted Contacts
Write-Host "Test 3/7: Add Trusted Contacts" -ForegroundColor Yellow
try {
    $contacts = Invoke-RestMethod -Uri "$API_URL/trusted-contacts" -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body (@{
            walletAddress=$WALLET_1
            contacts=@(
                @{name="Mom"; walletAddress=$WALLET_2},
                @{name="Sister"; walletAddress=$WALLET_3}
            )
        } | ConvertTo-Json) `
        -ErrorAction Stop
    Write-Host "✓ PASS: Contacts added`n" -ForegroundColor Green
} catch {
    Write-Host "✗ FAIL: Contact addition failed: $_" -ForegroundColor Red
    exit 1
}

# Test 4: Trigger SOS
Write-Host "Test 4/7: Trigger SOS" -ForegroundColor Yellow
try {
    $sos = Invoke-RestMethod -Uri "$API_URL/sos" -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body (@{
            walletAddress=$WALLET_1
            eventType="SOS"
            contextText="Test alert"
        } | ConvertTo-Json) `
        -ErrorAction Stop
    $EVENT_ID = $sos.event.id
    Write-Host "✓ PASS: SOS triggered (ID: $EVENT_ID)`n" -ForegroundColor Green
} catch {
    Write-Host "✗ FAIL: SOS trigger failed: $_" -ForegroundColor Red
    exit 1
}

# Test 5: Acknowledge SOS
Write-Host "Test 5/7: Acknowledge SOS" -ForegroundColor Yellow
try {
    $ack = Invoke-RestMethod -Uri "$API_URL/acknowledge" -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body (@{
            eventId=$EVENT_ID
            contactWallet=$WALLET_2
            note="I'm here"
        } | ConvertTo-Json) `
        -ErrorAction Stop
    Write-Host "✓ PASS: SOS acknowledged`n" -ForegroundColor Green
} catch {
    Write-Host "✗ FAIL: SOS acknowledgment failed: $_" -ForegroundColor Red
}

# Test 6: View Dashboard
Write-Host "Test 6/7: View Dashboard" -ForegroundColor Yellow
try {
    $dashboard = Invoke-RestMethod -Uri "$API_URL/dashboard/$WALLET_1" -ErrorAction Stop
    Write-Host "✓ PASS: Dashboard retrieved (Total Events: $($dashboard.totalEvents))`n" -ForegroundColor Green
} catch {
    Write-Host "✗ FAIL: Dashboard retrieval failed: $_" -ForegroundColor Red
    exit 1
}

# Test 7: Blockchain Status
Write-Host "Test 7/7: Blockchain Status" -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "$API_URL/blockchain-status" -ErrorAction Stop
    Write-Host "✓ PASS: Blockchain status retrieved`n" -ForegroundColor Green
} catch {
    Write-Host "✗ FAIL: Blockchain status retrieval failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "All tests passed! ✓" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
