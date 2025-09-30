#!/bin/bash

# Script to capture actual API response formats for frontend integration
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "🔍 Capturing API Response Formats..."

# Test data
TIMESTAMP=$(date +%s)
TEST_EMAIL="test-$TIMESTAMP@example.com"
LENDER_EMAIL="lender-$TIMESTAMP@example.com"
PASSWORD="Password123!"

echo "📝 1. Testing Registration Response Format..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"$TEST_EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Registration Response:"
echo "$REGISTER_RESPONSE" | jq .
echo ""

# Extract token
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')

echo "🔐 2. Testing Login Response Format..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Login Response:"
echo "$LOGIN_RESPONSE" | jq .
echo ""

echo "👤 3. Testing Profile Response Format..."
PROFILE_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/user/profile")

echo "Profile Response:"
echo "$PROFILE_RESPONSE" | jq .
echo ""

echo "📊 4. Testing Dashboard Response Format..."
DASHBOARD_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/user/dashboard")

echo "Dashboard Response:"
echo "$DASHBOARD_RESPONSE" | jq .
echo ""

echo "💰 5. Testing Create Loan Response Format..."
LOAN_DATA="{
  \"amount\": 15000,
  \"interest_rate\": 7.5,
  \"term\": \"24 months\",
  \"purpose\": \"Business\",
  \"description\": \"Test loan for API format testing\",
  \"lenders\": [
    {\"email\": \"$LENDER_EMAIL\", \"contribution_amount\": 8000},
    {\"email\": \"newlender@example.com\", \"contribution_amount\": 7000}
  ]
}"

LOAN_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$LOAN_DATA")

echo "Create Loan Response:"
echo "$LOAN_RESPONSE" | jq .
echo ""

# Extract loan ID
LOAN_ID=$(echo "$LOAN_RESPONSE" | jq -r '.loan.loan_id // .loan_id // empty')

echo "📋 6. Testing My Loans Response Format..."
MY_LOANS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/loans/my-loans")

echo "My Loans Response:"
echo "$MY_LOANS_RESPONSE" | jq .
echo ""

if [ -n "$LOAN_ID" ]; then
  echo "🔍 7. Testing Loan Details Response Format..."
  LOAN_DETAILS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/loans/$LOAN_ID")

  echo "Loan Details Response:"
  echo "$LOAN_DETAILS_RESPONSE" | jq .
  echo ""
fi

echo "👥 8. Testing Lender Registration Response Format..."
LENDER_REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Lender\",\"email\":\"$LENDER_EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Lender Registration Response:"
echo "$LENDER_REGISTER_RESPONSE" | jq .
echo ""

# Extract lender token
LENDER_TOKEN=$(echo "$LENDER_REGISTER_RESPONSE" | jq -r '.token')

echo "📬 9. Testing Pending Invitations Response Format..."
INVITATIONS_RESPONSE=$(curl -s -H "Authorization: Bearer $LENDER_TOKEN" "$API_URL/lender/invitations")

echo "Pending Invitations Response:"
echo "$INVITATIONS_RESPONSE" | jq .
echo ""

if [ -n "$LOAN_ID" ]; then
  echo "✅ 10. Testing Accept Loan Response Format..."
  ACCEPT_DATA="{
    \"bank_name\": \"Test Bank\",
    \"account_type\": \"checking\",
    \"routing_number\": \"123456789\",
    \"account_number\": \"987654321\",
    \"special_instructions\": \"Test ACH details\"
  }"

  ACCEPT_RESPONSE=$(curl -s -X PUT "$API_URL/lender/accept/$LOAN_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LENDER_TOKEN" \
    -d "$ACCEPT_DATA")

  echo "Accept Loan Response:"
  echo "$ACCEPT_RESPONSE" | jq .
  echo ""
fi

echo "📊 11. Testing Lender Dashboard Response Format..."
LENDER_DASHBOARD_RESPONSE=$(curl -s -H "Authorization: Bearer $LENDER_TOKEN" "$API_URL/lender/dashboard")

echo "Lender Dashboard Response:"
echo "$LENDER_DASHBOARD_RESPONSE" | jq .
echo ""

echo "🎯 Response Format Analysis Complete!"
echo "Test Email: $TEST_EMAIL"
echo "Lender Email: $LENDER_EMAIL"
echo "Loan ID: $LOAN_ID"