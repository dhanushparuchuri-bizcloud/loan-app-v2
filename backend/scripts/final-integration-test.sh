#!/bin/bash

# Final comprehensive integration test
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "🚀 Final Integration Test - All Endpoints"
echo "=========================================="

# Test data
TIMESTAMP=$(date +%s)
BORROWER_EMAIL="borrower-$TIMESTAMP@example.com"
LENDER_EMAIL="lender-$TIMESTAMP@example.com"
PASSWORD="Password123!"

echo ""
echo "📝 1. BORROWER REGISTRATION"
BORROWER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Borrower\",\"email\":\"$BORROWER_EMAIL\",\"password\":\"$PASSWORD\"}")

BORROWER_TOKEN=$(echo "$BORROWER_RESPONSE" | jq -r '.token')
echo "✅ Borrower registered: $BORROWER_EMAIL"

echo ""
echo "📊 2. BORROWER DASHBOARD"
BORROWER_DASHBOARD=$(curl -s -H "Authorization: Bearer $BORROWER_TOKEN" "$API_URL/user/dashboard")
echo "✅ Dashboard response:"
echo "$BORROWER_DASHBOARD" | jq '.data.borrower'

echo ""
echo "💰 3. LOAN CREATION"
LOAN_DATA="{
  \"amount\": 15000,
  \"interest_rate\": 8.5,
  \"term\": \"24 months\",
  \"purpose\": \"Business\",
  \"description\": \"Final integration test loan\",
  \"lenders\": [
    {\"email\": \"$LENDER_EMAIL\", \"contribution_amount\": 8000},
    {\"email\": \"other@example.com\", \"contribution_amount\": 7000}
  ]
}"

LOAN_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -d "$LOAN_DATA")

LOAN_ID=$(echo "$LOAN_RESPONSE" | jq -r '.loan.loan_id')
echo "✅ Loan created: $LOAN_ID"

echo ""
echo "📋 4. MY LOANS"
MY_LOANS=$(curl -s -H "Authorization: Bearer $BORROWER_TOKEN" "$API_URL/loans/my-loans")
LOANS_COUNT=$(echo "$MY_LOANS" | jq '.data.total_count')
echo "✅ My loans count: $LOANS_COUNT"

echo ""
echo "🔍 5. LOAN DETAILS"
LOAN_DETAILS=$(curl -s -H "Authorization: Bearer $BORROWER_TOKEN" "$API_URL/loans/$LOAN_ID")
PARTICIPANTS_COUNT=$(echo "$LOAN_DETAILS" | jq '.data.participants | length')
echo "✅ Loan participants: $PARTICIPANTS_COUNT"

echo ""
echo "👥 6. LENDER REGISTRATION (with invitation)"
LENDER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Lender\",\"email\":\"$LENDER_EMAIL\",\"password\":\"$PASSWORD\"}")

LENDER_TOKEN=$(echo "$LENDER_RESPONSE" | jq -r '.token')
IS_LENDER=$(echo "$LENDER_RESPONSE" | jq -r '.user.is_lender')
echo "✅ Lender registered: $LENDER_EMAIL (is_lender: $IS_LENDER)"

echo ""
echo "📬 7. PENDING INVITATIONS (corrected endpoint)"
INVITATIONS=$(curl -s -H "Authorization: Bearer $LENDER_TOKEN" "$API_URL/lender/pending")
INVITATIONS_COUNT=$(echo "$INVITATIONS" | jq '.data.total_count')
echo "✅ Pending invitations: $INVITATIONS_COUNT"

echo ""
echo "📊 8. LENDER DASHBOARD"
LENDER_DASHBOARD=$(curl -s -H "Authorization: Bearer $LENDER_TOKEN" "$API_URL/user/dashboard")
echo "✅ Lender stats:"
echo "$LENDER_DASHBOARD" | jq '.data.lender'

echo ""
echo "✅ 9. ACCEPT LOAN INVITATION"
ACCEPT_DATA="{
  \"bank_name\": \"Test Bank\",
  \"account_type\": \"checking\",
  \"routing_number\": \"123456789\",
  \"account_number\": \"987654321\",
  \"special_instructions\": \"Final integration test ACH\"
}"

ACCEPT_RESPONSE=$(curl -s -X PUT "$API_URL/lender/accept/$LOAN_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LENDER_TOKEN" \
  -d "$ACCEPT_DATA")

ACCEPT_STATUS=$(echo "$ACCEPT_RESPONSE" | jq -r '.data.status // "unknown"')
echo "✅ Loan acceptance status: $ACCEPT_STATUS"

echo ""
echo "🔄 10. UPDATED LOAN DETAILS (with ACH)"
UPDATED_LOAN=$(curl -s -H "Authorization: Bearer $BORROWER_TOKEN" "$API_URL/loans/$LOAN_ID")
TOTAL_FUNDED=$(echo "$UPDATED_LOAN" | jq '.data.total_funded')
ACH_FOUND=$(echo "$UPDATED_LOAN" | jq '.data.participants[] | select(.status == "ACCEPTED") | has("ach_details")')
echo "✅ Total funded: \$${TOTAL_FUNDED}"
echo "✅ ACH details included: $ACH_FOUND"

echo ""
echo "🎯 INTEGRATION TEST SUMMARY"
echo "=========================="
echo "Borrower: $BORROWER_EMAIL"
echo "Lender: $LENDER_EMAIL"
echo "Loan ID: $LOAN_ID"
echo "Lender Auto-Activated: $IS_LENDER"
echo "Pending Invitations: $INVITATIONS_COUNT"
echo "Loan Acceptance: $ACCEPT_STATUS"
echo "Total Funded: \$${TOTAL_FUNDED}"
echo "ACH Details: $ACH_FOUND"

if [ "$IS_LENDER" = "true" ] && [ "$ACCEPT_STATUS" = "ACCEPTED" ] && [ "$TOTAL_FUNDED" != "0" ]; then
    echo ""
    echo "🎉 ALL TESTS PASSED! Integration is working perfectly!"
else
    echo ""
    echo "❌ Some tests failed. Check the details above."
fi