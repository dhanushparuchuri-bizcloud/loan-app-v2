#!/bin/bash

# Test ACH details in loan responses
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "🧪 Testing ACH details in API responses..."

# Create test users
BORROWER_EMAIL="borrower-$(date +%s)@example.com"
LENDER_EMAIL="lender-$(date +%s)@example.com"

echo "📝 Registering borrower..."
BORROWER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BORROWER_EMAIL\",\"password\":\"password123\",\"name\":\"Test Borrower\"}")

BORROWER_TOKEN=$(echo "$BORROWER_RESPONSE" | jq -r '.token')
echo "✅ Borrower registered"

echo "💰 Creating loan with lender invitation..."
LOAN_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -d "{
    \"amount\": 15000,
    \"purpose\": \"Business expansion\",
    \"description\": \"Need funds for inventory\",
    \"interest_rate\": 8.5,
    \"term\": 24,
    \"lenders\": [
      {\"email\": \"$LENDER_EMAIL\", \"contribution_amount\": 8000},
      {\"email\": \"newlender@example.com\", \"contribution_amount\": 7000}
    ]
  }")

LOAN_ID=$(echo "$LOAN_RESPONSE" | jq -r '.loan_id')
echo "✅ Loan created: $LOAN_ID"

echo "👥 Registering lender..."
LENDER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$LENDER_EMAIL\",\"password\":\"password123\",\"name\":\"Test Lender\"}")

LENDER_TOKEN=$(echo "$LENDER_RESPONSE" | jq -r '.token')
echo "✅ Lender registered"

echo "✅ Accepting loan invitation with ACH details..."
ACCEPT_RESPONSE=$(curl -s -X PUT "$API_URL/lender/accept/$LOAN_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  -d "{
    \"bank_name\": \"Chase Bank\",
    \"account_type\": \"CHECKING\",
    \"routing_number\": \"021000021\",
    \"account_number\": \"1234567890\",
    \"special_instructions\": \"Please send ACH on Fridays\"
  }")

echo "Accept response:"
echo "$ACCEPT_RESPONSE" | jq .

echo ""
echo "🔍 Checking loan details for ACH information..."
LOAN_DETAILS=$(curl -s -H "Authorization: Bearer $BORROWER_TOKEN" "$API_URL/loans/$LOAN_ID")

echo "Loan details response:"
echo "$LOAN_DETAILS" | jq .

echo ""
echo "📊 Checking if ACH details are included in participants..."
echo "$LOAN_DETAILS" | jq '.participants[]? | select(.status == "ACCEPTED") | {lender_name, contribution_amount, ach_details}'

echo ""
echo "🎯 Summary:"
echo "Loan ID: $LOAN_ID"
echo "Borrower: $BORROWER_EMAIL"
echo "Lender: $LENDER_EMAIL"