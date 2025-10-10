#!/bin/bash

# Quick Payment API Test Script
# Tests individual endpoints with sample data

API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Quick Payment API Test${NC}\n"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}jq is required but not installed. Install with: brew install jq${NC}"
    exit 1
fi

# Get credentials
read -p "Borrower Email: " BORROWER_EMAIL
read -sp "Borrower Password: " BORROWER_PASSWORD
echo
read -p "Lender Email: " LENDER_EMAIL
read -sp "Lender Password: " LENDER_PASSWORD
echo

# Login as borrower
echo -e "\n${YELLOW}1. Login as Borrower${NC}"
BORROWER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${BORROWER_EMAIL}\",\"password\":\"${BORROWER_PASSWORD}\"}")

BORROWER_TOKEN=$(echo $BORROWER_RESPONSE | jq -r '.data.token')
echo "Token: ${BORROWER_TOKEN:0:20}..."

# Get loans
echo -e "\n${YELLOW}2. Get Borrower Loans${NC}"
LOANS=$(curl -s -X GET "${API_URL}/loans/my-loans" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

echo $LOANS | jq -r '.data.loans[] | "\(.loan_id) - \(.loan_name) - $\(.amount)"'

read -p "Enter loan_id: " LOAN_ID

# Get loan details
LOAN=$(curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

echo $LOAN | jq -r '.data.participants[] | select(.status == "ACCEPTED") | "\(.lender_id) - \(.lender_name) - $\(.contribution_amount)"'

read -p "Enter lender_id: " LENDER_ID

# Submit payment
echo -e "\n${YELLOW}3. Submit Payment${NC}"
read -p "Amount: " AMOUNT

PAYMENT=$(curl -s -X POST "${API_URL}/payments" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"loan_id\": \"${LOAN_ID}\",
    \"lender_id\": \"${LENDER_ID}\",
    \"amount\": ${AMOUNT},
    \"payment_date\": \"$(date +%Y-%m-%d)\",
    \"notes\": \"Test payment from script\"
  }")

PAYMENT_ID=$(echo $PAYMENT | jq -r '.payment.payment_id')
echo -e "${GREEN}Payment ID: ${PAYMENT_ID}${NC}"
echo $PAYMENT | jq '.payment'

# Login as lender
echo -e "\n${YELLOW}4. Login as Lender${NC}"
LENDER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${LENDER_EMAIL}\",\"password\":\"${LENDER_PASSWORD}\"}")

LENDER_TOKEN=$(echo $LENDER_RESPONSE | jq -r '.data.token')
echo "Token: ${LENDER_TOKEN:0:20}..."

# Get payment details
echo -e "\n${YELLOW}5. Get Payment Details (as Lender)${NC}"
PAYMENT_DETAILS=$(curl -s -X GET "${API_URL}/payments/${PAYMENT_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}")

echo $PAYMENT_DETAILS | jq '.payment'

# Approve or reject
echo -e "\n${YELLOW}6. Approve or Reject?${NC}"
read -p "(a)pprove or (r)eject: " DECISION

if [ "$DECISION" = "a" ]; then
  RESULT=$(curl -s -X PUT "${API_URL}/payments/${PAYMENT_ID}/approve" \
    -H "Authorization: Bearer ${LENDER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"approval_notes\": \"Approved via test script\"}")
  echo -e "${GREEN}Approved${NC}"
elif [ "$DECISION" = "r" ]; then
  RESULT=$(curl -s -X PUT "${API_URL}/payments/${PAYMENT_ID}/reject" \
    -H "Authorization: Bearer ${LENDER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"rejection_reason\": \"Rejected via test script\"}")
  echo -e "${RED}Rejected${NC}"
fi

echo $RESULT | jq '.'

# List all payments
echo -e "\n${YELLOW}7. List All Payments for Loan${NC}"
ALL_PAYMENTS=$(curl -s -X GET "${API_URL}/payments/loan/${LOAN_ID}" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

echo $ALL_PAYMENTS | jq '.payments'

echo -e "\n${GREEN}Test Complete!${NC}"
