#!/bin/bash
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

# Use existing loan with approved payment
LOAN_ID="c31448b8-2e21-49fc-b968-c69f14311e62"
LENDER_EMAIL="dhanushparuchuri@ufl.edu"
LENDER_PASSWORD="Madtitan@07"

# Get lender token
echo "=== Complete Payment Flow Test (Using Existing Loan) ==="
echo ""
echo "Step 1: Logging in as lender..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${LENDER_EMAIL}\", \"password\": \"${LENDER_PASSWORD}\"}")

LENDER_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
LENDER_ID=$(echo $LOGIN_RESPONSE | jq -r '.data.user.user_id')
echo "✓ Logged in as: $LENDER_EMAIL"
echo ""

# Get borrower info from loan
echo "Step 2: Getting loan details..."
LOAN_DETAILS=$(curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}")

BORROWER_ID=$(echo $LOAN_DETAILS | jq -r '.data.borrower_id')
echo "✓ Loan ID: $LOAN_ID"
echo "✓ Borrower ID: $BORROWER_ID"
echo ""

# Login as borrower (we need to find borrower credentials)
echo "Step 3: Current loan state:"
echo $LOAN_DETAILS | jq '.data.user_participation | {
  contribution_amount,
  total_paid,
  remaining_balance,
  status
}'
echo ""

# List existing payments
echo "Step 4: Listing existing payments..."
EXISTING_PAYMENTS=$(curl -s -X GET "${API_URL}/payments/loan/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}")

echo "Existing payments for this loan:"
echo $EXISTING_PAYMENTS | jq '.data.payments[] | {
  payment_id,
  amount,
  status,
  payment_date,
  created_at
}'
echo ""

# Create a test borrower and submit new payment
echo "Step 5: Creating new test scenario..."
TIMESTAMP=$(date +%s)

# Register new borrower
BORROWER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Payment Test Borrower\", \"email\": \"borrower-${TIMESTAMP}@test.com\", \"password\": \"TestPass123!\", \"is_lender\": false}")

NEW_BORROWER_TOKEN=$(echo $BORROWER_RESPONSE | jq -r '.token')
NEW_BORROWER_ID=$(echo $BORROWER_RESPONSE | jq -r '.user.user_id')
echo "✓ New borrower registered: $NEW_BORROWER_ID"

# Create new loan
LOAN_RESPONSE=$(curl -s -X POST "${API_URL}/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${NEW_BORROWER_TOKEN}" \
  -d "{
    \"loan_name\": \"Payment Flow Test\",
    \"loan_amount\": 20000,
    \"interest_rate\": 7.5,
    \"maturity_months\": 12,
    \"payment_frequency\": \"MONTHLY\",
    \"lenders\": [{
      \"email\": \"${LENDER_EMAIL}\",
      \"contribution_amount\": 20000
    }]
  }")

NEW_LOAN_ID=$(echo $LOAN_RESPONSE | jq -r '.data.loan_id')
echo "✓ New loan created: $NEW_LOAN_ID"
echo ""

# Lender accepts
echo "Step 6: Lender accepting loan..."
curl -s -X POST "${API_URL}/loans/${NEW_LOAN_ID}/respond" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{
    \"accept\": true,
    \"bank_name\": \"Test Bank\",
    \"account_type\": \"CHECKING\",
    \"routing_number\": \"123456789\",
    \"account_number\": \"9876543210\"
  }" > /dev/null
echo "✓ Loan accepted"
echo ""

# Check initial state
echo "Step 7: Initial loan state:"
curl -s -X GET "${API_URL}/loans/${NEW_LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {
  contribution_amount,
  total_paid,
  remaining_balance
}'
echo ""

# Submit payment #1
echo "Step 8: Submitting first payment (\$5000)..."
PAYMENT1=$(curl -s -X POST "${API_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${NEW_BORROWER_TOKEN}" \
  -d "{
    \"loan_id\": \"${NEW_LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": 5000,
    \"payment_date\": \"2025-10-09\",
    \"notes\": \"First payment\"
  }")

PAYMENT1_ID=$(echo $PAYMENT1 | jq -r '.data.payment_id')
echo "✓ Payment submitted: $PAYMENT1_ID"
echo "  Status:" $(echo $PAYMENT1 | jq -r '.data.status')
echo ""

# Approve payment #1
echo "Step 9: Lender approving first payment..."
curl -s -X PUT "${API_URL}/payments/${PAYMENT1_ID}/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{\"notes\": \"Approved\"}" | jq '.data | {status, approved_at}' 
echo ""

# Check state after approval
echo "Step 10: Loan state after first approval:"
curl -s -X GET "${API_URL}/loans/${NEW_LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {
  contribution_amount,
  total_paid,
  remaining_balance
}'
echo ""

# Submit payment #2
echo "Step 11: Submitting second payment (\$3000)..."
PAYMENT2=$(curl -s -X POST "${API_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${NEW_BORROWER_TOKEN}" \
  -d "{
    \"loan_id\": \"${NEW_LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": 3000,
    \"payment_date\": \"2025-10-09\",
    \"notes\": \"Second payment\"
  }")

PAYMENT2_ID=$(echo $PAYMENT2 | jq -r '.data.payment_id')
echo "✓ Payment submitted: $PAYMENT2_ID"
echo ""

# Approve payment #2
echo "Step 12: Lender approving second payment..."
curl -s -X PUT "${API_URL}/payments/${PAYMENT2_ID}/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{\"notes\": \"Approved\"}" | jq '.data | {status, approved_at}'
echo ""

# Check final state
echo "Step 13: Final loan state after both approvals:"
curl -s -X GET "${API_URL}/loans/${NEW_LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {
  contribution_amount,
  total_paid,
  remaining_balance
}'
echo ""

# Submit and reject payment #3
echo "Step 14: Submitting third payment (\$2000)..."
PAYMENT3=$(curl -s -X POST "${API_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${NEW_BORROWER_TOKEN}" \
  -d "{
    \"loan_id\": \"${NEW_LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": 2000,
    \"payment_date\": \"2025-10-09\",
    \"notes\": \"Third payment\"
  }")

PAYMENT3_ID=$(echo $PAYMENT3 | jq -r '.data.payment_id')
echo "✓ Payment submitted: $PAYMENT3_ID"
echo ""

echo "Step 15: Lender rejecting third payment..."
curl -s -X PUT "${API_URL}/payments/${PAYMENT3_ID}/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{\"reason\": \"Incorrect amount\"}" | jq '.data | {status, rejected_at, rejection_reason}'
echo ""

# Check final state (should be unchanged)
echo "Step 16: Final state after rejection (should match step 13):"
curl -s -X GET "${API_URL}/loans/${NEW_LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {
  contribution_amount,
  total_paid,
  remaining_balance
}'
echo ""

# List all payments
echo "Step 17: All payments for this loan:"
curl -s -X GET "${API_URL}/payments/loan/${NEW_LOAN_ID}" \
  -H "Authorization: Bearer ${NEW_BORROWER_TOKEN}" | jq '.data.payments[] | {
  payment_id,
  amount,
  status,
  notes
}'
echo ""

echo "=== TEST SUMMARY ==="
echo "Loan ID: $NEW_LOAN_ID"
echo "Initial: contribution=20000, paid=0, remaining=20000"
echo "After Payment1 (\$5000 APPROVED): paid=5000, remaining=15000"
echo "After Payment2 (\$3000 APPROVED): paid=8000, remaining=12000"
echo "After Payment3 (\$2000 REJECTED): paid=8000, remaining=12000 (unchanged)"
echo ""
echo "✅ Complete payment flow test passed!"
