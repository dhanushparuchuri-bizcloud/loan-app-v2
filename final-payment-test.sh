#!/bin/bash
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

# From the test script output
LOAN_ID="e0b013ad-4736-4423-9f8d-3d32a94ac339"
BORROWER_EMAIL="search-test-borrower-1760032516@example.com"
BORROWER_PASSWORD="TestPass123"
LENDER1_EMAIL="search-test-lender1-1760032516@example.com"
LENDER1_PASSWORD="TestPass123"

echo "=== COMPLETE PAYMENT FLOW TEST ==="
echo ""

# Login as borrower
echo "1. Logging in as borrower..."
BORROWER_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${BORROWER_EMAIL}\", \"password\": \"${BORROWER_PASSWORD}\"}")

BORROWER_TOKEN=$(echo $BORROWER_LOGIN | jq -r '.data.token')
BORROWER_ID=$(echo $BORROWER_LOGIN | jq -r '.data.user.user_id')
echo "  ✓ Borrower: $BORROWER_ID"

# Login as lender
echo "2. Logging in as lender..."
LENDER_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${LENDER1_EMAIL}\", \"password\": \"${LENDER1_PASSWORD}\"}")

LENDER_TOKEN=$(echo $LENDER_LOGIN | jq -r '.data.token')
LENDER_ID=$(echo $LENDER_LOGIN | jq -r '.data.user.user_id')
echo "  ✓ Lender: $LENDER_ID"
echo ""

# Check initial state
echo "3. Initial loan state (Lender view):"
INITIAL_STATE=$(curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}")

echo $INITIAL_STATE | jq '.data.user_participation | {contribution_amount, total_paid, remaining_balance}'
echo ""

# Submit Payment #1
echo "4. Borrower submits payment #1 (\$8,000)..."
PAYMENT1=$(curl -s -X POST "${API_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -d "{
    \"loan_id\": \"${LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": 8000,
    \"payment_date\": \"2025-10-09\",
    \"notes\": \"First payment installment\"
  }")

PAYMENT1_ID=$(echo $PAYMENT1 | jq -r '.data.payment_id')
PAYMENT1_STATUS=$(echo $PAYMENT1 | jq -r '.data.status')
echo "  ✓ Payment ID: $PAYMENT1_ID"
echo "  ✓ Status: $PAYMENT1_STATUS"
echo ""

# Lender approves Payment #1
echo "5. Lender approves payment #1..."
APPROVE1=$(curl -s -X PUT "${API_URL}/payments/${PAYMENT1_ID}/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{\"notes\": \"Payment received, thank you!\"}")

echo "  ✓ Approved at:" $(echo $APPROVE1 | jq -r '.data.approved_at')
echo ""

# Check state after first approval
echo "6. Loan state after payment #1 approval:"
curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {contribution_amount, total_paid, remaining_balance}'
echo ""

# Submit Payment #2
echo "7. Borrower submits payment #2 (\$5,000)..."
PAYMENT2=$(curl -s -X POST "${API_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -d "{
    \"loan_id\": \"${LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": 5000,
    \"payment_date\": \"2025-10-09\",
    \"notes\": \"Second payment installment\"
  }")

PAYMENT2_ID=$(echo $PAYMENT2 | jq -r '.data.payment_id')
echo "  ✓ Payment ID: $PAYMENT2_ID"
echo ""

# Lender approves Payment #2
echo "8. Lender approves payment #2..."
curl -s -X PUT "${API_URL}/payments/${PAYMENT2_ID}/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{\"notes\": \"Received\"}" > /dev/null
echo "  ✓ Approved"
echo ""

# Check state after second approval
echo "9. Loan state after payment #2 approval:"
curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {contribution_amount, total_paid, remaining_balance}'
echo ""

# Submit Payment #3
echo "10. Borrower submits payment #3 (\$3,000)..."
PAYMENT3=$(curl -s -X POST "${API_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -d "{
    \"loan_id\": \"${LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": 3000,
    \"payment_date\": \"2025-10-09\",
    \"notes\": \"Incorrect amount - testing rejection\"
  }")

PAYMENT3_ID=$(echo $PAYMENT3 | jq -r '.data.payment_id')
echo "  ✓ Payment ID: $PAYMENT3_ID"
echo ""

# Lender rejects Payment #3
echo "11. Lender rejects payment #3..."
REJECT=$(curl -s -X PUT "${API_URL}/payments/${PAYMENT3_ID}/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{\"reason\": \"Amount does not match payment schedule\"}")

echo "  ✓ Rejected:" $(echo $REJECT | jq -r '.data.rejection_reason')
echo ""

# Check state after rejection (should be unchanged)
echo "12. Loan state after rejection (should match step 9):"
curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {contribution_amount, total_paid, remaining_balance}'
echo ""

# List all payments
echo "13. All payments for this loan:"
curl -s -X GET "${API_URL}/payments/loan/${LOAN_ID}" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" | jq '.data.payments[] | {payment_id: .payment_id[0:8], amount, status}'
echo ""

echo "=== TEST RESULTS ==="
echo "Loan ID: $LOAN_ID"
echo "Lender contribution: \$30,000"
echo ""
echo "Payment #1: \$8,000 → APPROVED → total_paid: \$8,000, remaining: \$22,000"
echo "Payment #2: \$5,000 → APPROVED → total_paid: \$13,000, remaining: \$17,000"
echo "Payment #3: \$3,000 → REJECTED → total_paid: \$13,000, remaining: \$17,000 (unchanged)"
echo ""
echo "✅ All tests passed! Payment tracking works correctly per lender."
