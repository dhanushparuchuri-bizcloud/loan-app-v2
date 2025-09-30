#!/bin/bash

# Debug lender endpoint issues
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "🔍 Debugging Lender Endpoint Issues..."

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
echo "Borrower registered, token: ${BORROWER_TOKEN:0:50}..."

# Create loan with lender invitation
LOAN_DATA="{
  \"amount\": 10000,
  \"interest_rate\": 7.5,
  \"term\": \"12 months\",
  \"purpose\": \"Business\",
  \"description\": \"Test loan for lender endpoint debugging\",
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

echo "Lender Registration Response:"
echo "$LENDER_RESPONSE" | jq .

LENDER_TOKEN=$(echo "$LENDER_RESPONSE" | jq -r '.token')
IS_LENDER=$(echo "$LENDER_RESPONSE" | jq -r '.user.is_lender')

echo ""
echo "🎫 Lender Token Info:"
echo "Token: ${LENDER_TOKEN:0:50}..."
echo "Is Lender: $IS_LENDER"
echo "Token Length: ${#LENDER_TOKEN}"

echo ""
echo "🔍 3. Test lender endpoints with detailed debugging..."

echo "Testing /lender/invitations..."
INVITATIONS_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  "$API_URL/lender/invitations")

HTTP_STATUS=$(echo "$INVITATIONS_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$INVITATIONS_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
echo "$RESPONSE_BODY" | jq .

echo ""
echo "Testing /lender/dashboard..."
DASHBOARD_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  "$API_URL/lender/dashboard")

HTTP_STATUS2=$(echo "$DASHBOARD_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY2=$(echo "$DASHBOARD_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS2"
echo "Response:"
echo "$RESPONSE_BODY2" | jq .

echo ""
echo "🎯 Debug Summary:"
echo "Borrower: $BORROWER_EMAIL"
echo "Lender: $LENDER_EMAIL"
echo "Loan ID: $LOAN_ID"
echo "Lender Token: ${LENDER_TOKEN:0:50}..."
echo "Is Lender: $IS_LENDER"
echo "Invitations Status: $HTTP_STATUS"
echo "Dashboard Status: $HTTP_STATUS2"