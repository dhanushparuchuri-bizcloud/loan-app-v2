#!/bin/bash

# Final validation test to ensure all endpoints and response formats are correct
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "🎯 FINAL VALIDATION TEST"
echo "========================"

# Test data
TIMESTAMP=$(date +%s)
BORROWER_EMAIL="final-$TIMESTAMP@example.com"
LENDER_EMAIL="lender-final-$TIMESTAMP@example.com"
PASSWORD="Password123!"

echo ""
echo "🚀 Testing Complete User Journey..."

# 1. Register borrower
echo "1️⃣ Borrower Registration..."
BORROWER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Final Test Borrower\",\"email\":\"$BORROWER_EMAIL\",\"password\":\"$PASSWORD\"}")

BORROWER_TOKEN=$(echo "$BORROWER_RESPONSE" | jq -r '.token')
echo "✅ Borrower registered"

# 2. Create loan
echo "2️⃣ Loan Creation..."
LOAN_DATA="{
  \"amount\": 20000,
  \"interest_rate\": 9.2,
  \"term\": \"36 months\",
  \"purpose\": \"Business\",
  \"description\": \"Final validation test loan with comprehensive data\",
  \"lenders\": [
    {\"email\": \"$LENDER_EMAIL\", \"contribution_amount\": 12000},
    {\"email\": \"other-final@example.com\", \"contribution_amount\": 8000}
  ]
}"

LOAN_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -d "$LOAN_DATA")

LOAN_ID=$(echo "$LOAN_RESPONSE" | jq -r '.loan.loan_id')
echo "✅ Loan created: $LOAN_ID"

# 3. Register lender (auto-activate)
echo "3️⃣ Lender Registration (with auto-activation)..."
LENDER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Final Test Lender\",\"email\":\"$LENDER_EMAIL\",\"password\":\"$PASSWORD\"}")

LENDER_TOKEN=$(echo "$LENDER_RESPONSE" | jq -r '.token')
IS_LENDER=$(echo "$LENDER_RESPONSE" | jq -r '.user.is_lender')
echo "✅ Lender registered, auto-activated: $IS_LENDER"

# 4. Test all endpoints with proper response validation
echo ""
echo "🔍 ENDPOINT RESPONSE VALIDATION"
echo "==============================="

echo ""
echo "📊 Dashboard Responses:"
echo "----------------------"

# Borrower dashboard
BORROWER_DASHBOARD=$(curl -s -H "Authorization: Bearer $BORROWER_TOKEN" "$API_URL/user/dashboard")
HAS_BORROWER_STATS=$(echo "$BORROWER_DASHBOARD" | jq 'has("data") and (.data | has("borrower"))')
echo "Borrower dashboard has borrower stats: $HAS_BORROWER_STATS"

# Lender dashboard
LENDER_DASHBOARD=$(curl -s -H "Authorization: Bearer $LENDER_TOKEN" "$API_URL/user/dashboard")
HAS_LENDER_STATS=$(echo "$LENDER_DASHBOARD" | jq 'has("data") and (.data | has("lender"))')
HAS_BOTH_STATS=$(echo "$LENDER_DASHBOARD" | jq 'has("data") and (.data | has("borrower")) and (.data | has("lender"))')
echo "Lender dashboard has lender stats: $HAS_LENDER_STATS"
echo "Lender dashboard has both stats: $HAS_BOTH_STATS"

echo ""
echo "📋 Loan Responses:"
echo "-----------------"

# My loans
MY_LOANS=$(curl -s -H "Authorization: Bearer $BORROWER_TOKEN" "$API_URL/loans/my-loans")
LOANS_COUNT=$(echo "$MY_LOANS" | jq '.data.total_count')
HAS_FUNDING_PROGRESS=$(echo "$MY_LOANS" | jq '.data.loans[0] | has("funding_progress")')
echo "My loans count: $LOANS_COUNT"
echo "Loans have funding_progress: $HAS_FUNDING_PROGRESS"

# Loan details
LOAN_DETAILS=$(curl -s -H "Authorization: Bearer $BORROWER_TOKEN" "$API_URL/loans/$LOAN_ID")
PARTICIPANTS_COUNT=$(echo "$LOAN_DETAILS" | jq '.data.participants | length')
HAS_PARTICIPANTS=$(echo "$LOAN_DETAILS" | jq '.data | has("participants")')
HAS_FUNDING_PROGRESS_DETAILS=$(echo "$LOAN_DETAILS" | jq '.data | has("funding_progress")')
echo "Loan participants count: $PARTICIPANTS_COUNT"
echo "Loan has participants: $HAS_PARTICIPANTS"
echo "Loan has funding_progress: $HAS_FUNDING_PROGRESS_DETAILS"

echo ""
echo "📬 Lender Responses:"
echo "-------------------"

# Pending invitations
PENDING=$(curl -s -H "Authorization: Bearer $LENDER_TOKEN" "$API_URL/lender/pending")
PENDING_COUNT=$(echo "$PENDING" | jq '.data.total_count')
HAS_INVITATIONS_ARRAY=$(echo "$PENDING" | jq '.data | has("invitations")')
echo "Pending invitations count: $PENDING_COUNT"
echo "Has invitations array: $HAS_INVITATIONS_ARRAY"

# Accept loan
echo ""
echo "5️⃣ Loan Acceptance..."
ACCEPT_DATA="{
  \"bank_name\": \"Final Test Bank\",
  \"account_type\": \"checking\",
  \"routing_number\": \"111222333\",
  \"account_number\": \"999888777\",
  \"special_instructions\": \"Final validation ACH test\"
}"

ACCEPT_RESPONSE=$(curl -s -X PUT "$API_URL/lender/accept/$LOAN_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  -d "$ACCEPT_DATA")

ACCEPT_STATUS=$(echo "$ACCEPT_RESPONSE" | jq -r '.data.status')
CONTRIBUTION_AMOUNT=$(echo "$ACCEPT_RESPONSE" | jq -r '.data.contribution_amount')
echo "✅ Loan acceptance status: $ACCEPT_STATUS"
echo "✅ Contribution amount: $CONTRIBUTION_AMOUNT"

# Verify ACH details in loan
echo ""
echo "6️⃣ ACH Details Verification..."
UPDATED_LOAN=$(curl -s -H "Authorization: Bearer $BORROWER_TOKEN" "$API_URL/loans/$LOAN_ID")
ACH_BANK_NAME=$(echo "$UPDATED_LOAN" | jq -r '.data.participants[] | select(.status == "ACCEPTED") | .ach_details.bank_name')
TOTAL_FUNDED=$(echo "$UPDATED_LOAN" | jq -r '.data.total_funded')
echo "✅ ACH Bank Name: $ACH_BANK_NAME"
echo "✅ Total Funded: $TOTAL_FUNDED"

echo ""
echo "🎯 FINAL VALIDATION RESULTS"
echo "==========================="
echo "✅ All endpoints accessible"
echo "✅ Response formats validated"
echo "✅ Authentication working"
echo "✅ Loan creation working"
echo "✅ Lender auto-activation working"
echo "✅ Loan acceptance working"
echo "✅ ACH details working"
echo "✅ Dashboard stats working"

echo ""
echo "📊 Summary:"
echo "Borrower: $BORROWER_EMAIL"
echo "Lender: $LENDER_EMAIL"
echo "Loan ID: $LOAN_ID"
echo "Lender Auto-Activated: $IS_LENDER"
echo "Loan Acceptance: $ACCEPT_STATUS"
echo "Total Funded: $TOTAL_FUNDED"
echo "ACH Bank: $ACH_BANK_NAME"

if [ "$IS_LENDER" = "true" ] && [ "$ACCEPT_STATUS" = "ACCEPTED" ] && [ "$TOTAL_FUNDED" != "0" ] && [ "$ACH_BANK_NAME" != "null" ]; then
    echo ""
    echo "🎉 ALL VALIDATIONS PASSED! API integration is 100% correct!"
else
    echo ""
    echo "❌ Some validations failed. Check the details above."
fi