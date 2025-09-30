#!/bin/bash

# Debug loan access issue
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"
LOAN_ID="346da7ab-6a5b-4e8e-b273-6f09fb63296e"

echo "🔍 Debugging Loan Access Issue"
echo "=============================="
echo "Loan ID: $LOAN_ID"
echo ""

# Create a test user to check loan access
TIMESTAMP=$(date +%s)
TEST_EMAIL="debug-loan-$TIMESTAMP@example.com"
PASSWORD="Password123!"

echo "📝 1. Creating test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Debug User\",\"email\":\"$TEST_EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.user_id')

echo "✅ User created: $USER_ID"

echo ""
echo "🔍 2. Testing loan access with authentication..."
LOAN_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_URL/loans/$LOAN_ID")

HTTP_STATUS=$(echo "$LOAN_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LOAN_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
echo "$RESPONSE_BODY" | jq .

echo ""
echo "📋 3. Checking what loans exist for this user..."
MY_LOANS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/loans/my-loans")
echo "My Loans Response:"
echo "$MY_LOANS_RESPONSE" | jq .

echo ""
echo "🔍 4. Checking if loan exists in database..."
aws dynamodb scan --table-name marketplace-loans-dev \
  --filter-expression "loan_id = :loan_id" \
  --expression-attribute-values '{":loan_id":{"S":"'$LOAN_ID'"}}' \
  --query 'Items[0]' 2>/dev/null || echo "❌ Loan not found in database or AWS CLI not configured"

echo ""
echo "🎯 Debug Summary:"
echo "=================="
echo "Test User: $TEST_EMAIL"
echo "User ID: $USER_ID"
echo "Loan ID: $LOAN_ID"
echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "404" ]; then
    echo "❌ Loan not found - The loan ID doesn't exist"
elif [ "$HTTP_STATUS" = "403" ]; then
    echo "❌ Access denied - User doesn't have permission to view this loan"
elif [ "$HTTP_STATUS" = "401" ]; then
    echo "❌ Authentication failed - Token issue"
elif [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Loan found and accessible"
else
    echo "❓ Unexpected status code: $HTTP_STATUS"
fi