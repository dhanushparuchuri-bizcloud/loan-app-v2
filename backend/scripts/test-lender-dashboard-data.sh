#!/bin/bash

# Test lender dashboard data to debug the issue
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "🔍 Testing Lender Dashboard Data"
echo "================================"

# Create a complete test scenario
TIMESTAMP=$(date +%s)
BORROWER_EMAIL="borrower-lender-test-$TIMESTAMP@example.com"
LENDER_EMAIL="lender-test-$TIMESTAMP@example.com"
PASSWORD="Password123!"

echo ""
echo "📝 1. Creating borrower and loan..."
# Register borrower
BORROWER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Borrower\",\"email\":\"$BORROWER_EMAIL\",\"password\":\"$PASSWORD\"}")

BORROWER_TOKEN=$(echo "$BORROWER_RESPONSE" | jq -r '.token')
echo "✅ Borrower registered"

# Create loan with lender invitation
LOAN_DATA="{
  \"amount\": 25000,
  \"interest_rate\": 9.5,
  \"term\": \"24 months\",
  \"purpose\": \"Business\",
  \"description\": \"Lender dashboard test loan\",
  \"lenders\": [
    {\"email\": \"$LENDER_EMAIL\", \"contribution_amount\": 15000},
    {\"email\": \"other@example.com\", \"contribution_amount\": 10000}
  ]
}"

LOAN_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -d "$LOAN_DATA")

LOAN_ID=$(echo "$LOAN_RESPONSE" | jq -r '.loan.loan_id')
echo "✅ Loan created: $LOAN_ID"

echo ""
echo "👥 2. Registering lender (should auto-activate)..."
LENDER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Lender\",\"email\":\"$LENDER_EMAIL\",\"password\":\"$PASSWORD\"}")

LENDER_TOKEN=$(echo "$LENDER_RESPONSE" | jq -r '.token')
IS_LENDER=$(echo "$LENDER_RESPONSE" | jq -r '.user.is_lender')
echo "✅ Lender registered, is_lender: $IS_LENDER"

echo ""
echo "📊 3. Testing Lender Dashboard Endpoint..."
LENDER_DASHBOARD_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  "$API_URL/user/dashboard")

HTTP_STATUS=$(echo "$LENDER_DASHBOARD_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LENDER_DASHBOARD_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS"
echo "Dashboard Response:"
echo "$RESPONSE_BODY" | jq .

echo ""
echo "📬 4. Testing Pending Invitations Endpoint..."
INVITATIONS_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  "$API_URL/lender/pending")

HTTP_STATUS2=$(echo "$INVITATIONS_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY2=$(echo "$INVITATIONS_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS2"
echo "Invitations Response:"
echo "$RESPONSE_BODY2" | jq .

echo ""
echo "🔍 5. Analyzing Response Structure..."
echo "Dashboard has lender stats:" $(echo "$RESPONSE_BODY" | jq 'has("data") and (.data | has("lender"))')
echo "Lender stats pending_invitations:" $(echo "$RESPONSE_BODY" | jq '.data.lender.pending_invitations // "null"')
echo "Invitations array length:" $(echo "$RESPONSE_BODY2" | jq '.data.invitations | length // "null"')

echo ""
echo "🎯 Summary:"
echo "==========="
echo "Borrower: $BORROWER_EMAIL"
echo "Lender: $LENDER_EMAIL"
echo "Loan ID: $LOAN_ID"
echo "Lender Auto-Activated: $IS_LENDER"
echo "Dashboard Status: $HTTP_STATUS"
echo "Invitations Status: $HTTP_STATUS2"

if [ "$HTTP_STATUS" = "200" ] && [ "$HTTP_STATUS2" = "200" ]; then
    echo "✅ Both endpoints working"
    
    # Check if invitations are properly returned
    INVITATIONS_COUNT=$(echo "$RESPONSE_BODY2" | jq '.data.invitations | length // 0')
    PENDING_COUNT=$(echo "$RESPONSE_BODY" | jq '.data.lender.pending_invitations // 0')
    
    echo "Invitations in /lender/pending: $INVITATIONS_COUNT"
    echo "Pending count in dashboard: $PENDING_COUNT"
    
    if [ "$INVITATIONS_COUNT" -gt 0 ]; then
        echo "✅ Invitations found - Frontend should show them"
        echo "Sample invitation:"
        echo "$RESPONSE_BODY2" | jq '.data.invitations[0]'
    else
        echo "❌ No invitations found - This is the issue!"
    fi
else
    echo "❌ API endpoints not working properly"
fi