#!/bin/bash

# Quick test to check ACH details in loan response
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"
LOAN_ID="a9fed833-8b2f-474d-a68f-923ba331f853"

echo "🔍 Testing ACH details in loan response..."

# Get a fresh token by registering a new user
TEST_EMAIL="test-$(date +%s)@example.com"
echo "📝 Getting auth token..."

TOKEN_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Password123!\",\"name\":\"Test User\"}")

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Failed to get token"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Got token"

# Get loan details
echo "🔍 Fetching loan details..."
LOAN_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/loans/$LOAN_ID")

echo "📊 Loan response:"
echo "$LOAN_RESPONSE" | jq .

echo ""
echo "🏦 ACH Details for accepted participants:"
echo "$LOAN_RESPONSE" | jq '.participants[]? | select(.status == "ACCEPTED") | {lender_name, contribution_amount, ach_details}'