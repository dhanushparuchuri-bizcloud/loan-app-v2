#!/bin/bash

# Payment Flow Test Script
# Tests the complete payment submission, approval, and rejection flow

set -e  # Exit on error

API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Payment Flow End-to-End Test${NC}"
echo -e "${BLUE}================================================${NC}\n"

# Step 1: Login as Borrower
echo -e "${YELLOW}Step 1: Login as Borrower${NC}"
read -p "Enter borrower email: " BORROWER_EMAIL
read -sp "Enter borrower password: " BORROWER_PASSWORD
echo

BORROWER_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${BORROWER_EMAIL}\",\"password\":\"${BORROWER_PASSWORD}\"}")

BORROWER_TOKEN=$(echo $BORROWER_LOGIN | jq -r '.data.token')
BORROWER_ID=$(echo $BORROWER_LOGIN | jq -r '.data.user.user_id')

if [ "$BORROWER_TOKEN" = "null" ]; then
  echo -e "${RED}❌ Borrower login failed${NC}"
  echo $BORROWER_LOGIN | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Borrower logged in successfully${NC}"
echo -e "  User ID: ${BORROWER_ID}\n"

# Step 2: Get borrower's loans
echo -e "${YELLOW}Step 2: Get Borrower's Loans${NC}"
LOANS=$(curl -s -X GET "${API_URL}/loans/my-loans" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

echo $LOANS | jq '.data.loans[] | {loan_id, loan_name, amount, status, participants: .participants | length}'

read -p "Enter loan_id to test: " LOAN_ID

# Get loan details
LOAN_DETAILS=$(curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

echo -e "\n${BLUE}Loan Details:${NC}"
echo $LOAN_DETAILS | jq '.data | {loan_id, loan_name, amount, participants: .participants | map({lender_name, contribution_amount, status})}'

# Show accepted lenders
echo -e "\n${BLUE}Accepted Lenders:${NC}"
echo $LOAN_DETAILS | jq '.data.participants[] | select(.status == "ACCEPTED") | {lender_id, lender_name, lender_email, contribution_amount}'

read -p "Enter lender_id to test payment: " LENDER_ID

# Get lender details
LENDER_DETAILS=$(echo $LOAN_DETAILS | jq ".data.participants[] | select(.lender_id == \"${LENDER_ID}\")")
LENDER_EMAIL=$(echo $LENDER_DETAILS | jq -r '.lender_email')
CONTRIBUTION=$(echo $LENDER_DETAILS | jq -r '.contribution_amount')

echo -e "\n${BLUE}Selected Lender:${NC}"
echo $LENDER_DETAILS | jq '{lender_name, lender_email, contribution_amount, status}'

# Step 3: (Optional) Upload Receipt
echo -e "\n${YELLOW}Step 3: Upload Payment Receipt (Optional)${NC}"
read -p "Do you want to upload a receipt? (y/n): " UPLOAD_RECEIPT

RECEIPT_URL=""
if [ "$UPLOAD_RECEIPT" = "y" ]; then
  read -p "Enter path to receipt file (PDF/JPG/PNG): " RECEIPT_FILE

  if [ ! -f "$RECEIPT_FILE" ]; then
    echo -e "${RED}❌ File not found${NC}"
    exit 1
  fi

  # Detect file type
  EXTENSION="${RECEIPT_FILE##*.}"
  case "$EXTENSION" in
    pdf)
      FILE_TYPE="application/pdf"
      ;;
    jpg|jpeg)
      FILE_TYPE="image/jpeg"
      ;;
    png)
      FILE_TYPE="image/png"
      ;;
    *)
      echo -e "${RED}❌ Unsupported file type. Use PDF, JPG, or PNG${NC}"
      exit 1
      ;;
  esac

  FILENAME=$(basename "$RECEIPT_FILE")

  # Get presigned upload URL
  echo -e "${BLUE}Getting upload URL...${NC}"
  UPLOAD_RESPONSE=$(curl -s -X POST "${API_URL}/payments/receipt-upload-url" \
    -H "Authorization: Bearer ${BORROWER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"loan_id\":\"${LOAN_ID}\",\"lender_id\":\"${LENDER_ID}\",\"file_name\":\"${FILENAME}\",\"file_type\":\"${FILE_TYPE}\"}")

  UPLOAD_URL=$(echo $UPLOAD_RESPONSE | jq -r '.upload_url')
  RECEIPT_URL=$(echo $UPLOAD_RESPONSE | jq -r '.file_key')

  if [ "$UPLOAD_URL" = "null" ]; then
    echo -e "${RED}❌ Failed to get upload URL${NC}"
    echo $UPLOAD_RESPONSE | jq '.'
    exit 1
  fi

  echo -e "${BLUE}Uploading file to S3...${NC}"
  curl -s -X PUT "$UPLOAD_URL" \
    -H "Content-Type: ${FILE_TYPE}" \
    --data-binary "@${RECEIPT_FILE}"

  echo -e "${GREEN}✓ Receipt uploaded successfully${NC}"
  echo -e "  File key: ${RECEIPT_URL}\n"
fi

# Step 4: Submit Payment
echo -e "${YELLOW}Step 4: Submit Payment${NC}"
read -p "Enter payment amount: " AMOUNT
read -p "Enter payment date (YYYY-MM-DD, default today): " PAYMENT_DATE
PAYMENT_DATE=${PAYMENT_DATE:-$(date +%Y-%m-%d)}
read -p "Enter notes (optional): " NOTES

PAYMENT_DATA="{\"loan_id\":\"${LOAN_ID}\",\"lender_id\":\"${LENDER_ID}\",\"amount\":${AMOUNT},\"payment_date\":\"${PAYMENT_DATE}\",\"notes\":\"${NOTES}\""

if [ -n "$RECEIPT_URL" ]; then
  PAYMENT_DATA="${PAYMENT_DATA},\"receipt_url\":\"${RECEIPT_URL}\""
fi

PAYMENT_DATA="${PAYMENT_DATA}}"

echo -e "${BLUE}Submitting payment...${NC}"
PAYMENT_RESPONSE=$(curl -s -X POST "${API_URL}/payments" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${PAYMENT_DATA}")

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.payment.payment_id')

if [ "$PAYMENT_ID" = "null" ]; then
  echo -e "${RED}❌ Payment submission failed${NC}"
  echo $PAYMENT_RESPONSE | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Payment submitted successfully${NC}"
echo -e "  Payment ID: ${PAYMENT_ID}"
echo $PAYMENT_RESPONSE | jq '.payment | {payment_id, amount, status, payment_date, notes}'

# Step 5: Login as Lender
echo -e "\n${YELLOW}Step 5: Login as Lender${NC}"
echo -e "Lender Email: ${LENDER_EMAIL}"
read -sp "Enter lender password: " LENDER_PASSWORD
echo

LENDER_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${LENDER_EMAIL}\",\"password\":\"${LENDER_PASSWORD}\"}")

LENDER_TOKEN=$(echo $LENDER_LOGIN | jq -r '.data.token')
LENDER_USER_ID=$(echo $LENDER_LOGIN | jq -r '.data.user.user_id')

if [ "$LENDER_TOKEN" = "null" ]; then
  echo -e "${RED}❌ Lender login failed${NC}"
  echo $LENDER_LOGIN | jq '.'
  exit 1
fi

echo -e "${GREEN}✓ Lender logged in successfully${NC}"
echo -e "  User ID: ${LENDER_USER_ID}\n"

# Step 6: View Payment Details
echo -e "${YELLOW}Step 6: View Payment Details (as Lender)${NC}"
PAYMENT_DETAILS=$(curl -s -X GET "${API_URL}/payments/${PAYMENT_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}")

echo $PAYMENT_DETAILS | jq '.payment'

# Step 7: View Receipt (if uploaded)
if [ -n "$RECEIPT_URL" ]; then
  echo -e "\n${YELLOW}Step 7: View Receipt${NC}"
  read -p "Do you want to view the receipt? (y/n): " VIEW_RECEIPT

  if [ "$VIEW_RECEIPT" = "y" ]; then
    RECEIPT_VIEW_RESPONSE=$(curl -s -X GET "${API_URL}/payments/${PAYMENT_ID}/receipt-url" \
      -H "Authorization: Bearer ${LENDER_TOKEN}")

    RECEIPT_VIEW_URL=$(echo $RECEIPT_VIEW_RESPONSE | jq -r '.url')

    if [ "$RECEIPT_VIEW_URL" != "null" ]; then
      echo -e "${GREEN}✓ Receipt URL generated${NC}"
      echo -e "  Opening receipt in browser..."
      open "$RECEIPT_VIEW_URL" 2>/dev/null || xdg-open "$RECEIPT_VIEW_URL" 2>/dev/null || echo "  URL: ${RECEIPT_VIEW_URL}"
    else
      echo -e "${RED}❌ Failed to get receipt URL${NC}"
      echo $RECEIPT_VIEW_RESPONSE | jq '.'
    fi
  fi
fi

# Step 8: Lender Decision
echo -e "\n${YELLOW}Step 8: Lender Decision${NC}"
echo -e "1) Approve payment"
echo -e "2) Reject payment"
read -p "Choose action (1/2): " ACTION

if [ "$ACTION" = "1" ]; then
  read -p "Enter approval notes (optional): " APPROVAL_NOTES

  APPROVAL_DATA="{}"
  if [ -n "$APPROVAL_NOTES" ]; then
    APPROVAL_DATA="{\"approval_notes\":\"${APPROVAL_NOTES}\"}"
  fi

  echo -e "${BLUE}Approving payment...${NC}"
  APPROVE_RESPONSE=$(curl -s -X PUT "${API_URL}/payments/${PAYMENT_ID}/approve" \
    -H "Authorization: Bearer ${LENDER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${APPROVAL_DATA}")

  if echo $APPROVE_RESPONSE | jq -e '.success' > /dev/null; then
    echo -e "${GREEN}✓ Payment approved successfully${NC}"
    echo $APPROVE_RESPONSE | jq '.'
  else
    echo -e "${RED}❌ Payment approval failed${NC}"
    echo $APPROVE_RESPONSE | jq '.'
    exit 1
  fi

elif [ "$ACTION" = "2" ]; then
  read -p "Enter rejection reason (required): " REJECTION_REASON

  if [ -z "$REJECTION_REASON" ]; then
    echo -e "${RED}❌ Rejection reason is required${NC}"
    exit 1
  fi

  echo -e "${BLUE}Rejecting payment...${NC}"
  REJECT_RESPONSE=$(curl -s -X PUT "${API_URL}/payments/${PAYMENT_ID}/reject" \
    -H "Authorization: Bearer ${LENDER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"rejection_reason\":\"${REJECTION_REASON}\"}")

  if echo $REJECT_RESPONSE | jq -e '.success' > /dev/null; then
    echo -e "${GREEN}✓ Payment rejected successfully${NC}"
    echo $REJECT_RESPONSE | jq '.'
  else
    echo -e "${RED}❌ Payment rejection failed${NC}"
    echo $REJECT_RESPONSE | jq '.'
    exit 1
  fi
else
  echo -e "${RED}❌ Invalid action${NC}"
  exit 1
fi

# Step 9: View Updated Payment
echo -e "\n${YELLOW}Step 9: View Updated Payment${NC}"
FINAL_PAYMENT=$(curl -s -X GET "${API_URL}/payments/${PAYMENT_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}")

echo $FINAL_PAYMENT | jq '.payment'

# Step 10: List All Payments for Loan
echo -e "\n${YELLOW}Step 10: List All Payments for Loan${NC}"
ALL_PAYMENTS=$(curl -s -X GET "${API_URL}/payments/loan/${LOAN_ID}" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

echo $ALL_PAYMENTS | jq '.payments[] | {payment_id, amount, status, payment_date, notes, approval_notes, rejection_reason}'

echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}  Test Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
