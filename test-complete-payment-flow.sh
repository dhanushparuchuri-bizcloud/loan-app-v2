#!/bin/bash

API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"
TIMESTAMP=$(date +%s)

echo "=== Complete Payment Flow Test ==="
echo ""

# Step 1: Register borrower and lender
echo "Step 1: Registering borrower..."
BORROWER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Borrower\",
    \"email\": \"borrower-${TIMESTAMP}@test.com\",
    \"password\": \"TestPass123!\",
    \"is_lender\": false
  }")

BORROWER_ID=$(echo $BORROWER_RESPONSE | jq -r '.data.user.user_id')
BORROWER_TOKEN=$(echo $BORROWER_RESPONSE | jq -r '.data.token')
echo "✓ Borrower registered: $BORROWER_ID"

echo "Step 2: Registering lender..."
LENDER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Lender\",
    \"email\": \"lender-${TIMESTAMP}@test.com\",
    \"password\": \"TestPass123!\",
    \"is_lender\": true
  }")

LENDER_ID=$(echo $LENDER_RESPONSE | jq -r '.data.user.user_id')
LENDER_EMAIL=$(echo $LENDER_RESPONSE | jq -r '.data.user.email')
LENDER_TOKEN=$(echo $LENDER_RESPONSE | jq -r '.data.token')
echo "✓ Lender registered: $LENDER_ID"
echo ""

# Step 2: Create loan with lender invitation
echo "Step 3: Creating loan with lender invitation..."
LOAN_RESPONSE=$(curl -s -X POST "${API_URL}/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -d "{
    \"loan_name\": \"Payment Test Loan\",
    \"loan_amount\": 15000,
    \"interest_rate\": 8.0,
    \"maturity_months\": 24,
    \"payment_frequency\": \"MONTHLY\",
    \"lenders\": [{
      \"email\": \"${LENDER_EMAIL}\",
      \"contribution_amount\": 15000
    }]
  }")

LOAN_ID=$(echo $LOAN_RESPONSE | jq -r '.data.loan_id')
echo "✓ Loan created: $LOAN_ID"
echo ""

# Step 3: Lender accepts loan
echo "Step 4: Lender accepting loan invitation..."
curl -s -X POST "${API_URL}/loans/${LOAN_ID}/respond" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{
    \"accept\": true,
    \"bank_name\": \"Test Bank\",
    \"account_type\": \"CHECKING\",
    \"routing_number\": \"123456789\",
    \"account_number\": \"9876543210\"
  }" > /dev/null

echo "✓ Lender accepted loan"
echo ""

# Step 4: Check initial loan state
echo "Step 5: Checking initial loan state..."
curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {
  contribution_amount,
  total_paid,
  remaining_balance
}'
echo ""

# Step 5: Upload receipt
echo "Step 6: Getting presigned URL for receipt upload..."
UPLOAD_URL_RESPONSE=$(curl -s -X POST "${API_URL}/payments/receipt-upload-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -d "{
    \"file_name\": \"receipt.jpg\",
    \"content_type\": \"image/jpeg\"
  }")

UPLOAD_URL=$(echo $UPLOAD_URL_RESPONSE | jq -r '.data.upload_url')
RECEIPT_KEY=$(echo $UPLOAD_URL_RESPONSE | jq -r '.data.key')
echo "✓ Got presigned upload URL"

echo "Step 7: Uploading receipt..."
curl -s -X PUT "${UPLOAD_URL}" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@ubertejas ventures logo.jpg" > /dev/null
echo "✓ Receipt uploaded"
echo ""

# Step 6: Submit payment
echo "Step 8: Borrower submitting payment of \$3000..."
PAYMENT_RESPONSE=$(curl -s -X POST "${API_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -d "{
    \"loan_id\": \"${LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": 3000,
    \"payment_date\": \"2025-10-09\",
    \"notes\": \"First payment installment\",
    \"receipt_key\": \"${RECEIPT_KEY}\"
  }")

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.data.payment_id')
echo "✓ Payment submitted: $PAYMENT_ID"
echo ""

# Step 7: Check payment is pending
echo "Step 9: Verifying payment status is PENDING..."
curl -s -X GET "${API_URL}/payments/${PAYMENT_ID}" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" | jq '.data | {payment_id, amount, status, lender_id}'
echo ""

# Step 8: Lender approves payment
echo "Step 10: Lender approving payment..."
curl -s -X PUT "${API_URL}/payments/${PAYMENT_ID}/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{
    \"notes\": \"Payment received and verified\"
  }" | jq '.data | {payment_id, status, approved_at}'
echo ""

# Step 9: Check updated loan state
echo "Step 11: Checking updated loan state after approval..."
curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {
  contribution_amount,
  total_paid,
  remaining_balance
}'
echo ""

# Step 10: Submit second payment
echo "Step 12: Borrower submitting second payment of \$2000 (no receipt)..."
PAYMENT2_RESPONSE=$(curl -s -X POST "${API_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -d "{
    \"loan_id\": \"${LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": 2000,
    \"payment_date\": \"2025-10-09\",
    \"notes\": \"Second payment installment\"
  }")

PAYMENT2_ID=$(echo $PAYMENT2_RESPONSE | jq -r '.data.payment_id')
echo "✓ Second payment submitted: $PAYMENT2_ID"
echo ""

# Step 11: Lender rejects second payment
echo "Step 13: Lender rejecting second payment..."
curl -s -X PUT "${API_URL}/payments/${PAYMENT2_ID}/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" \
  -d "{
    \"reason\": \"Payment amount does not match agreed schedule\"
  }" | jq '.data | {payment_id, status, rejected_at, rejection_reason}'
echo ""

# Step 12: Check loan state (should not change from rejection)
echo "Step 14: Checking loan state after rejection (should be unchanged)..."
curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data.user_participation | {
  contribution_amount,
  total_paid,
  remaining_balance
}'
echo ""

echo "=== Test Summary ==="
echo "Loan ID: $LOAN_ID"
echo "Payment #1: $PAYMENT_ID (APPROVED - \$3000)"
echo "Payment #2: $PAYMENT2_ID (REJECTED - \$2000)"
echo ""
echo "Expected final state:"
echo "  contribution_amount: 15000"
echo "  total_paid: 3000"
echo "  remaining_balance: 12000"
echo ""
echo "✅ Test complete!"
