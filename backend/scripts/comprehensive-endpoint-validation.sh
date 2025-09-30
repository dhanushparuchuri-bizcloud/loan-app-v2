#!/bin/bash

# Comprehensive endpoint and response format validation
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "🔍 COMPREHENSIVE ENDPOINT & RESPONSE FORMAT VALIDATION"
echo "====================================================="

# Test data
TIMESTAMP=$(date +%s)
BORROWER_EMAIL="validate-$TIMESTAMP@example.com"
LENDER_EMAIL="lender-validate-$TIMESTAMP@example.com"
PASSWORD="Password123!"

echo ""
echo "📋 TESTING ALL ENDPOINTS WITH EXACT RESPONSE FORMATS"
echo "===================================================="

echo ""
echo "1️⃣ AUTH ENDPOINTS"
echo "=================="

echo ""
echo "🔹 POST /auth/register"
REGISTER_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Validate User\",\"email\":\"$BORROWER_EMAIL\",\"password\":\"$PASSWORD\"}")

HTTP_STATUS=$(echo "$REGISTER_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$REGISTER_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response Structure:"
echo "$RESPONSE_BODY" | jq 'keys'
echo "Full Response:"
echo "$RESPONSE_BODY" | jq .

BORROWER_TOKEN=$(echo "$RESPONSE_BODY" | jq -r '.token')

echo ""
echo "🔹 POST /auth/login"
LOGIN_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BORROWER_EMAIL\",\"password\":\"$PASSWORD\"}")

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response Structure:"
echo "$RESPONSE_BODY" | jq 'keys'
echo "Full Response:"
echo "$RESPONSE_BODY" | jq .

echo ""
echo "2️⃣ USER ENDPOINTS"
echo "================="

echo ""
echo "🔹 GET /user/profile"
PROFILE_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  "$API_URL/user/profile")

HTTP_STATUS=$(echo "$PROFILE_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$PROFILE_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response Structure:"
echo "$RESPONSE_BODY" | jq 'keys'
echo "Data Structure:"
echo "$RESPONSE_BODY" | jq '.data | keys'

echo ""
echo "🔹 GET /user/dashboard"
DASHBOARD_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  "$API_URL/user/dashboard")

HTTP_STATUS=$(echo "$DASHBOARD_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$DASHBOARD_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response Structure:"
echo "$RESPONSE_BODY" | jq 'keys'
echo "Data Structure:"
echo "$RESPONSE_BODY" | jq '.data | keys'
echo "Borrower Stats:"
echo "$RESPONSE_BODY" | jq '.data.borrower'

echo ""
echo "3️⃣ LOAN ENDPOINTS"
echo "================="

echo ""
echo "🔹 POST /loans"
LOAN_DATA="{
  \"amount\": 12000,
  \"interest_rate\": 7.8,
  \"term\": \"18 months\",
  \"purpose\": \"Business\",
  \"description\": \"Comprehensive validation test loan\",
  \"lenders\": [
    {\"email\": \"$LENDER_EMAIL\", \"contribution_amount\": 7000},
    {\"email\": \"other-validate@example.com\", \"contribution_amount\": 5000}
  ]
}"

CREATE_LOAN_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -d "$LOAN_DATA")

HTTP_STATUS=$(echo "$CREATE_LOAN_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CREATE_LOAN_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response Structure:"
echo "$RESPONSE_BODY" | jq 'keys'
echo "Loan Object Keys:"
echo "$RESPONSE_BODY" | jq '.loan | keys'

LOAN_ID=$(echo "$RESPONSE_BODY" | jq -r '.loan.loan_id')

echo ""
echo "🔹 GET /loans/my-loans"
MY_LOANS_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  "$API_URL/loans/my-loans")

HTTP_STATUS=$(echo "$MY_LOANS_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$MY_LOANS_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response Structure:"
echo "$RESPONSE_BODY" | jq 'keys'
echo "Data Structure:"
echo "$RESPONSE_BODY" | jq '.data | keys'
echo "First Loan Keys:"
echo "$RESPONSE_BODY" | jq '.data.loans[0] | keys'

echo ""
echo "🔹 GET /loans/{id} (using loan ID: $LOAN_ID)"
LOAN_DETAILS_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  "$API_URL/loans/$LOAN_ID")

HTTP_STATUS=$(echo "$LOAN_DETAILS_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LOAN_DETAILS_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response Structure:"
echo "$RESPONSE_BODY" | jq 'keys'
echo "Loan Data Keys:"
echo "$RESPONSE_BODY" | jq '.data | keys'
echo "Participants Structure:"
echo "$RESPONSE_BODY" | jq '.data.participants[0] | keys'

echo ""
echo "4️⃣ LENDER ENDPOINTS"
echo "==================="

# Register lender
echo ""
echo "🔹 Registering lender first..."
LENDER_REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Validate Lender\",\"email\":\"$LENDER_EMAIL\",\"password\":\"$PASSWORD\"}")

LENDER_TOKEN=$(echo "$LENDER_REGISTER_RESPONSE" | jq -r '.token')
IS_LENDER=$(echo "$LENDER_REGISTER_RESPONSE" | jq -r '.user.is_lender')
echo "Lender registered, is_lender: $IS_LENDER"

echo ""
echo "🔹 GET /lender/pending"
PENDING_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  "$API_URL/lender/pending")

HTTP_STATUS=$(echo "$PENDING_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$PENDING_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response Structure:"
echo "$RESPONSE_BODY" | jq 'keys'
echo "Data Structure:"
echo "$RESPONSE_BODY" | jq '.data | keys'

echo ""
echo "🔹 GET /user/dashboard (as lender)"
LENDER_DASHBOARD_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  "$API_URL/user/dashboard")

HTTP_STATUS=$(echo "$LENDER_DASHBOARD_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LENDER_DASHBOARD_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Lender Stats:"
echo "$RESPONSE_BODY" | jq '.data.lender'

echo ""
echo "🔹 PUT /lender/accept/{loan_id}"
ACCEPT_DATA="{
  \"bank_name\": \"Validation Bank\",
  \"account_type\": \"checking\",
  \"routing_number\": \"987654321\",
  \"account_number\": \"123456789\",
  \"special_instructions\": \"Comprehensive validation test\"
}"

ACCEPT_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" -X PUT "$API_URL/lender/accept/$LOAN_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  -d "$ACCEPT_DATA")

HTTP_STATUS=$(echo "$ACCEPT_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$ACCEPT_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $HTTP_STATUS"
echo "Response Structure:"
echo "$RESPONSE_BODY" | jq 'keys'
echo "Data Structure:"
echo "$RESPONSE_BODY" | jq '.data | keys'

echo ""
echo "🎯 VALIDATION SUMMARY"
echo "===================="
echo "Borrower: $BORROWER_EMAIL"
echo "Lender: $LENDER_EMAIL"
echo "Loan ID: $LOAN_ID"
echo "Lender Auto-Activated: $IS_LENDER"

echo ""
echo "✅ All endpoints tested with detailed response structure analysis!"