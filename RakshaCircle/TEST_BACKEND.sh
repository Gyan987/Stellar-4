#!/bin/bash
# RakshaCircle Backend Smoke Test
# Verifies all 7 critical endpoints are responding

if [ "$#" -ne 1 ]; then
    echo "Usage: ./test-backend.sh <backend-url>"
    echo "Example: ./test-backend.sh http://localhost:3000"
    exit 1
fi

BASE_URL="$1"
API_URL="$BASE_URL/api/v1/raksha"

# Demo wallet
WALLET_1="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
WALLET_2="GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWYU"
WALLET_3="GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCGLH"

echo "=========================================="
echo "RakshaCircle Backend Smoke Test"
echo "=========================================="
echo "Target: $API_URL"
echo ""

# Test 1: Health Check
echo "Test 1/7: Health Check"
HEALTH=$(curl -s "$BASE_URL/health")
if echo "$HEALTH" | grep -q "ok"; then
    echo "✓ PASS: Backend is healthy"
else
    echo "✗ FAIL: Backend health check failed"
    exit 1
fi
echo ""

# Test 2: Create Profile
echo "Test 2/7: Create Profile"
PROFILE=$(curl -s -X POST "$API_URL/profile" \
  -H "Content-Type: application/json" \
  -d "{\"walletAddress\": \"$WALLET_1\", \"name\": \"Test User 1\"}")
if echo "$PROFILE" | grep -q "Test User 1"; then
    echo "✓ PASS: Profile created"
else
    echo "✗ FAIL: Profile creation failed"
    echo "$PROFILE"
    exit 1
fi
echo ""

# Test 3: Add Trusted Contacts
echo "Test 3/7: Add Trusted Contacts"
CONTACTS=$(curl -s -X POST "$API_URL/trusted-contacts" \
  -H "Content-Type: application/json" \
  -d "{\"walletAddress\": \"$WALLET_1\", \"contacts\": [{\"name\": \"Mom\", \"walletAddress\": \"$WALLET_2\"}, {\"name\": \"Sister\", \"walletAddress\": \"$WALLET_3\"}]}")
if echo "$CONTACTS" | grep -q "Mom"; then
    echo "✓ PASS: Contacts added"
else
    echo "✗ FAIL: Contact addition failed"
    echo "$CONTACTS"
    exit 1
fi
echo ""

# Test 4: Trigger SOS
echo "Test 4/7: Trigger SOS"
SOS=$(curl -s -X POST "$API_URL/sos" \
  -H "Content-Type: application/json" \
  -d "{\"walletAddress\": \"$WALLET_1\", \"eventType\": \"SOS\", \"contextText\": \"Test alert\"}")
if echo "$SOS" | grep -q "SOS recorded"; then
    echo "✓ PASS: SOS triggered"
    EVENT_ID=$(echo "$SOS" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
else
    echo "✗ FAIL: SOS trigger failed"
    echo "$SOS"
    exit 1
fi
echo ""

# Test 5: Acknowledge SOS
echo "Test 5/7: Acknowledge SOS"
ACK=$(curl -s -X POST "$API_URL/acknowledge" \
  -H "Content-Type: application/json" \
  -d "{\"eventId\": \"$EVENT_ID\", \"contactWallet\": \"$WALLET_2\", \"note\": \"I'm here\"}")
if echo "$ACK" | grep -q "acknowledgment"; then
    echo "✓ PASS: SOS acknowledged"
else
    echo "✗ FAIL: SOS acknowledgment failed"
    echo "$ACK"
fi
echo ""

# Test 6: View Dashboard
echo "Test 6/7: View Dashboard"
DASHBOARD=$(curl -s "$API_URL/dashboard/$WALLET_1")
if echo "$DASHBOARD" | grep -q "totalEvents"; then
    echo "✓ PASS: Dashboard retrieved"
else
    echo "✗ FAIL: Dashboard retrieval failed"
    echo "$DASHBOARD"
    exit 1
fi
echo ""

# Test 7: Blockchain Status
echo "Test 7/7: Blockchain Status"
STATUS=$(curl -s "$API_URL/blockchain-status")
if echo "$STATUS" | grep -q "Stellar"; then
    echo "✓ PASS: Blockchain status retrieved"
else
    echo "✗ FAIL: Blockchain status retrieval failed"
    echo "$STATUS"
    exit 1
fi
echo ""

echo "=========================================="
echo "All tests passed! ✓"
echo "=========================================="
