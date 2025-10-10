#!/bin/bash

# Complete Payment System API Test
# Tests all 7 endpoints with real data

API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "========================================="
echo "📋 PAYMENT SYSTEM - COMPLETE API TEST"
echo "========================================="
echo ""

# Use existing test accounts
BORROWER_EMAIL="borrower1760029449@test.com"
BORROWER_PASSWORD="TestPass123"
LOAN_ID="c31448b8-2e21-49fc-b968-c69f14311e62"

# Step 1: Login as borrower
echo "1️⃣  Login as Borrower"
BORROWER_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${BORROWER_EMAIL}\",\"password\":\"${BORROWER_PASSWORD}\"}")

BORROWER_TOKEN=$(echo "$BORROWER_LOGIN" | jq -r '.data.token')
echo "   ✓ Logged in as $BORROWER_EMAIL"

# Step 2: Get loan details and lender_id
echo ""
echo "2️⃣  Get Loan Details"
LOAN_DETAILS=$(curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

LENDER_ID=$(echo "$LOAN_DETAILS" | jq -r '.data.participants[0].lender_id')
LENDER_STATUS=$(echo "$LOAN_DETAILS" | jq -r '.data.participants[0].status')

echo "   Loan: $(echo "$LOAN_DETAILS" | jq -r '.data.loan_name')"
echo "   Lender: $(echo "$LOAN_DETAILS" | jq -r '.data.participants[0].lender_name')"
echo "   Status: $LENDER_STATUS"
echo "   Lender ID: $LENDER_ID"

if [ "$LENDER_STATUS" != "ACCEPTED" ]; then
  echo ""
  echo "⚠️  Lender hasn't accepted yet. Please:"
  echo "   1. Login to frontend as dhanushparuchuri@ufl.edu"
  echo "   2. Accept loan: 'Complete Payment Test Loan'"
  echo "   3. Run this script again"
  exit 1
fi

# Step 3: Get presigned upload URL
echo ""
echo "3️⃣  Get Presigned Upload URL"
UPLOAD_RESP=$(curl -s -X POST "${API_URL}/payments/receipt-upload-url" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"loan_id\": \"${LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"file_name\": \"ubertejas-logo.jpg\",
    \"file_type\": \"image/jpeg\"
  }")

UPLOAD_URL=$(echo "$UPLOAD_RESP" | jq -r '.data.upload_url // .upload_url')
FILE_KEY=$(echo "$UPLOAD_RESP" | jq -r '.data.file_key // .file_key')

echo "   ✓ Upload URL generated"
echo "   File key: $FILE_KEY"

# Step 4: Upload receipt to S3
echo ""
echo "4️⃣  Upload Receipt to S3"
LOGO_PATH="../public/ubertejas-ventures-logo.jpg"

if [ ! -f "$LOGO_PATH" ]; then
  echo "   ❌ Logo not found at $LOGO_PATH"
  exit 1
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@${LOGO_PATH}")

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✓ Receipt uploaded (HTTP $HTTP_CODE)"
else
  echo "   ⚠️  HTTP $HTTP_CODE"
fi

# Step 5: Submit payment with receipt
echo ""
echo "5️⃣  Submit Payment (\$2,500) with Receipt"
PAYMENT_RESP=$(curl -s -X POST "${API_URL}/payments" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"loan_id\": \"${LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": 2500,
    \"payment_date\": \"$(date +%Y-%m-%d)\",
    \"notes\": \"API test payment with receipt\",
    \"receipt_url\": \"${FILE_KEY}\"
  }")

PAYMENT_ID=$(echo "$PAYMENT_RESP" | jq -r '.data.payment.payment_id // .payment.payment_id')

if [ "$PAYMENT_ID" = "null" ] || [ -z "$PAYMENT_ID" ]; then
  echo "   ❌ Payment submission failed"
  echo "$PAYMENT_RESP" | jq '.'
  exit 1
fi

echo "   ✓ Payment ID: $PAYMENT_ID"
echo "   Amount: \$2,500"
echo "   Status: PENDING"

# Step 6: Get payment details
echo ""
echo "6️⃣  Get Payment Details"
PAYMENT_DETAILS=$(curl -s -X GET "${API_URL}/payments/${PAYMENT_ID}" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

echo "$PAYMENT_DETAILS" | jq '.data.payment // .payment | {
  payment_id,
  amount,
  status,
  notes,
  has_receipt: (.receipt_url != "" and .receipt_url != null)
}'

# Step 7: List all payments for loan
echo ""
echo "7️⃣  List All Payments for Loan"
ALL_PAYMENTS=$(curl -s -X GET "${API_URL}/payments/loan/${LOAN_ID}" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

PAYMENT_COUNT=$(echo "$ALL_PAYMENTS" | jq '.data.payments // .payments | length')
echo "   ✓ Found $PAYMENT_COUNT payment(s)"

echo "$ALL_PAYMENTS" | jq '.data.payments // .payments | map({
  payment_id,
  amount,
  status,
  payment_date
})'

# Summary
echo ""
echo "========================================="
echo "✅ BORROWER APIS TESTED (1-4)"
echo "========================================="
echo ""
echo "✓ POST /payments/receipt-upload-url"
echo "✓ Upload to S3 (presigned URL)"
echo "✓ POST /payments"
echo "✓ GET /payments/{payment_id}"
echo "✓ GET /payments/loan/{loan_id}"
echo ""
echo "========================================="
echo "👤 LENDER TESTING REQUIRED (5-7)"
echo "========================================="
echo ""
echo "Login as: dhanushparuchuri@ufl.edu"
echo "Payment ID: $PAYMENT_ID"
echo ""
echo "Run these commands:"
echo ""
echo "# Get your lender token first:"
echo "LENDER_TOKEN=\$(curl -s -X POST '${API_URL}/auth/login' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"dhanushparuchuri@ufl.edu\",\"password\":\"YOUR_PASSWORD\"}' | jq -r '.data.token')"
echo ""
echo "# 5️⃣  View Receipt:"
echo "curl -s -X GET '${API_URL}/payments/${PAYMENT_ID}/receipt-url' \\"
echo "  -H \"Authorization: Bearer \$LENDER_TOKEN\" | jq '.'"
echo ""
echo "# 6️⃣  Approve Payment:"
echo "curl -s -X PUT '${API_URL}/payments/${PAYMENT_ID}/approve' \\"
echo "  -H \"Authorization: Bearer \$LENDER_TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"approval_notes\": \"Payment verified\"}' | jq '.'"
echo ""
echo "# OR 7️⃣  Reject Payment:"
echo "curl -s -X PUT '${API_URL}/payments/${PAYMENT_ID}/reject' \\"
echo "  -H \"Authorization: Bearer \$LENDER_TOKEN\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"rejection_reason\": \"Incorrect amount\"}' | jq '.'"
echo ""
echo "========================================="
echo "📊 TEST DATA SUMMARY"
echo "========================================="
echo "Borrower: $BORROWER_EMAIL"
echo "Password: $BORROWER_PASSWORD"
echo "Loan ID: $LOAN_ID"
echo "Payment ID: $PAYMENT_ID"
echo "Lender: dhanushparuchuri@ufl.edu"
echo "========================================="
