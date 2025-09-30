#!/bin/bash

# Test the corrected lender endpoints
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "🔍 Testing Corrected Lender Endpoints..."

# Create a lender user by registering with an invited email
TIMESTAMP=$(date +%s)
BORROWER_EMAIL="borrower-$TIMESTAMP@example.com"
LENDER_EMAIL="lender-$TIMESTAMP@example.com"
PASSWORD="Password123!"

echo "📝 1. Create borrower and loan with lender invitation..."
# Register borrower
BORROWER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Borrower\",\"email\":\"$BORROWER_EMAIL\",\"password\":\"$PASSWORD\"}")

BORROWER_TOKEN=$(echo "$BORROWER_RESPONSE" | jq -r '.token')
echo "Borrower registered"

# Create loan with lender invitation
LOAN_DATA="{
  \"amount\": 10000,
  \"interest_rate\": 7.5,
  \"term\": \"12 months\",
  \"purpose\": \"Business\",
  \"description\": \"Test loan for corrected endpoint testing\",
  \"lenders\": [
    {\"email\": \"$LENDER_EMAIL\", \"contribution_amount\": 10000}
  ]
}"

LOAN_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -d "$LOAN_DATA")

LOAN_ID=$(echo "$LOAN_RESPONSE" | jq -r '.loan.loan_id')
echo "Loan created: $LOAN_ID"

echo ""
echo "👥 2. Register lender (should auto-activate)..."
LENDER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Lender\",\"email\":\"$LENDER_EMAIL\",\"password\":\"$PASSWORD\"}")

LENDER_TOKEN=$(echo "$LENDER_RESPONSE" | jq -r '.token')
IS_LENDER=$(echo "$LENDER_RESPONSE" | jq -r '.user.is_lender')

echo "Lender registered, is_lender: $IS_LENDER"

echo ""
echo "🔍 3. Test CORRECTED lender endpoints..."

echo "Testing /lender/pending (corrected from /lender/invitations)..."
PENDING_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  "$API_URL/lender/pending")

HTTP_STATUS=$(echo "$PENDING_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$PENDING_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
echo "$RESPONSE_BODY" | jq .

echo ""
echo "Testing /user/dashboard (for lender stats)..."
DASHBOARD_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  "$API_URL/user/dashboard")

HTTP_STATUS2=$(echo "$DASHBOARD_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY2=$(echo "$DASHBOARD_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS2"
echo "Response:"
echo "$RESPONSE_BODY2" | jq .

echo ""
echo "🎯 Test Results:"
echo "Lender Email: $LENDER_EMAIL"
echo "Loan ID: $LOAN_ID"
echo "Is Lender: $IS_LENDER"
echo "Pending Invitations Status: $HTTP_STATUS"
echo "Dashboard Status: $HTTP_STATUS2"

if [ "$HTTP_STATUS" = "200" ] && [ "$HTTP_STATUS2" = "200" ]; then
    echo "✅ All endpoints working correctly!"
else
    echo "❌ Some endpoints still failing"
fi