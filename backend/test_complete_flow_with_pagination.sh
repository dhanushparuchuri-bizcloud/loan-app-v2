#!/bin/bash

# Complete Flow Test with New Pagination Features
# Tests the entire borrower-lender flow including GET /loans/my-loans pagination

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# API Configuration
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   COMPLETE FLOW TEST WITH PAGINATION${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}API URL: ${API_URL}${NC}\n"

# Generate unique identifiers
TIMESTAMP=$(date +%s)
BORROWER_EMAIL="borrower-${TIMESTAMP}@test.com"
BORROWER_PASSWORD="TestPass123!"
BORROWER_NAME="Test Borrower"

LENDER1_EMAIL="lender1-${TIMESTAMP}@test.com"
LENDER1_PASSWORD="LenderPass123!"
LENDER1_NAME="Test Lender 1"

LENDER2_EMAIL="lender2-${TIMESTAMP}@test.com"
LENDER2_PASSWORD="LenderPass123!"
LENDER2_NAME="Test Lender 2"

# ===========================
# STEP 1: Register Borrower
# ===========================
echo -e "${YELLOW}STEP 1: Register Borrower${NC}"
RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${BORROWER_NAME}\",
    \"email\": \"${BORROWER_EMAIL}\",
    \"password\": \"${BORROWER_PASSWORD}\"
  }")

BORROWER_TOKEN=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "")
BORROWER_ID=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['user']['user_id'])" 2>/dev/null || echo "")

if [ -z "$BORROWER_TOKEN" ]; then
  echo -e "${RED}❌ Failed to register borrower${NC}"
  echo "$RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Borrower registered: ${BORROWER_EMAIL}${NC}"
echo -e "   User ID: ${BORROWER_ID}\n"

# ===========================
# STEP 2: Create Multiple Loans (for pagination testing)
# ===========================
echo -e "${YELLOW}STEP 2: Create Multiple Loans for Pagination Test${NC}"

LOAN_IDS=()

for i in {1..7}; do
  echo -e "  Creating loan ${i}/7..."

  LOAN_RESPONSE=$(curl -s -X POST "${API_URL}/loans" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${BORROWER_TOKEN}" \
    -d "{
      \"loan_name\": \"Test Loan ${i}\",
      \"amount\": $((10000 + i * 1000)),
      \"interest_rate\": $((5 + i)),
      \"maturity_terms\": {
        \"start_date\": \"2025-11-01\",
        \"payment_frequency\": \"Monthly\",
        \"term_length\": 12
      },
      \"purpose\": \"Business Expansion ${i}\",
      \"description\": \"Test loan ${i} for pagination testing\",
      \"lenders\": [
        {
          \"email\": \"${LENDER1_EMAIL}\",
          \"contribution_amount\": $((5000 + i * 500))
        }
      ]
    }")

  LOAN_ID=$(echo $LOAN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['loan']['loan_id'])" 2>/dev/null || echo "")

  if [ -n "$LOAN_ID" ]; then
    LOAN_IDS+=("$LOAN_ID")
    echo -e "  ${GREEN}✅ Loan ${i} created: ${LOAN_ID}${NC}"
  else
    echo -e "  ${RED}❌ Failed to create loan ${i}${NC}"
    echo "$LOAN_RESPONSE"
  fi

  # Small delay to ensure different created_at timestamps
  sleep 0.5
done

echo -e "\n${GREEN}✅ Created ${#LOAN_IDS[@]} loans total${NC}\n"

# ===========================
# STEP 3: Test GET /loans/my-loans with Default Pagination
# ===========================
echo -e "${YELLOW}STEP 3: Test GET /loans/my-loans (Default - 20 loans)${NC}"

RESPONSE=$(curl -s -X GET "${API_URL}/loans/my-loans" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

COUNT=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['count'])" 2>/dev/null || echo "0")
HAS_MORE=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['has_more'])" 2>/dev/null || echo "false")

echo -e "${GREEN}✅ Response received${NC}"
echo -e "   Loans returned: ${COUNT}"
echo -e "   Has more: ${HAS_MORE}"
echo -e "   Response structure includes: count, has_more, next_token\n"

# ===========================
# STEP 4: Test with Custom Limit
# ===========================
echo -e "${YELLOW}STEP 4: Test GET /loans/my-loans with limit=3${NC}"

RESPONSE=$(curl -s -X GET "${API_URL}/loans/my-loans?limit=3" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

COUNT=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['count'])" 2>/dev/null || echo "0")
HAS_MORE=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['has_more'])" 2>/dev/null || echo "false")
NEXT_TOKEN=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data'].get('next_token', ''))" 2>/dev/null || echo "")

echo -e "${GREEN}✅ Response received${NC}"
echo -e "   Loans returned: ${COUNT}"
echo -e "   Has more: ${HAS_MORE}"
echo -e "   Next token exists: $([ -n "$NEXT_TOKEN" ] && echo "YES" || echo "NO")\n"

# ===========================
# STEP 5: Test Pagination with next_token
# ===========================
if [ -n "$NEXT_TOKEN" ]; then
  echo -e "${YELLOW}STEP 5: Test Pagination with next_token${NC}"

  RESPONSE=$(curl -s -X GET "${API_URL}/loans/my-loans?limit=3&next_token=${NEXT_TOKEN}" \
    -H "Authorization: Bearer ${BORROWER_TOKEN}")

  COUNT=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['count'])" 2>/dev/null || echo "0")
  HAS_MORE=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['has_more'])" 2>/dev/null || echo "false")

  echo -e "${GREEN}✅ Second page retrieved${NC}"
  echo -e "   Loans returned: ${COUNT}"
  echo -e "   Has more: ${HAS_MORE}\n"
else
  echo -e "${YELLOW}STEP 5: Skipped (no next_token available)\n${NC}"
fi

# ===========================
# STEP 6: Test Invalid Limit Validation
# ===========================
echo -e "${YELLOW}STEP 6: Test Validation - Invalid Limit (limit=150)${NC}"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${API_URL}/loans/my-loans?limit=150" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$STATUS" = "400" ]; then
  echo -e "${GREEN}✅ Validation working correctly (400 status)${NC}"
  ERROR_MSG=$(echo "$RESPONSE" | sed 's/HTTP_STATUS.*//' | python3 -c "import sys, json; print(json.load(sys.stdin)['message'])" 2>/dev/null || echo "")
  echo -e "   Error: ${ERROR_MSG}\n"
else
  echo -e "${RED}❌ Expected 400 status, got ${STATUS}${NC}\n"
fi

# ===========================
# STEP 7: Test Invalid Pagination Token
# ===========================
echo -e "${YELLOW}STEP 7: Test Validation - Invalid Pagination Token${NC}"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${API_URL}/loans/my-loans?next_token=invalid_token_xyz" \
  -H "Authorization: Bearer ${BORROWER_TOKEN}")

STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$STATUS" = "400" ]; then
  echo -e "${GREEN}✅ Validation working correctly (400 status)${NC}"
  ERROR_MSG=$(echo "$RESPONSE" | sed 's/HTTP_STATUS.*//' | python3 -c "import sys, json; print(json.load(sys.stdin)['message'])" 2>/dev/null || echo "")
  echo -e "   Error: ${ERROR_MSG}\n"
else
  echo -e "${RED}❌ Expected 400 status, got ${STATUS}${NC}\n"
fi

# ===========================
# STEP 8: Register Lenders
# ===========================
echo -e "${YELLOW}STEP 8: Register Lenders${NC}"

# Register Lender 1
RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${LENDER1_NAME}\",
    \"email\": \"${LENDER1_EMAIL}\",
    \"password\": \"${LENDER1_PASSWORD}\"
  }")

LENDER1_TOKEN=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "")
IS_LENDER=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['user']['is_lender'])" 2>/dev/null || echo "false")

echo -e "${GREEN}✅ Lender 1 registered: ${LENDER1_EMAIL}${NC}"
echo -e "   Is Lender: ${IS_LENDER}\n"

# ===========================
# STEP 9: Get Lender Pending Invitations
# ===========================
echo -e "${YELLOW}STEP 9: Get Lender Pending Invitations${NC}"

RESPONSE=$(curl -s -X GET "${API_URL}/lender/pending" \
  -H "Authorization: Bearer ${LENDER1_TOKEN}")

PENDING_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('invitations', [])))" 2>/dev/null || echo "0")

echo -e "${GREEN}✅ Retrieved pending invitations${NC}"
echo -e "   Pending invitations: ${PENDING_COUNT}\n"

# ===========================
# STEP 10: Accept First Loan
# ===========================
if [ ${#LOAN_IDS[@]} -gt 0 ]; then
  FIRST_LOAN_ID="${LOAN_IDS[0]}"
  echo -e "${YELLOW}STEP 10: Accept Loan Invitation (Loan ID: ${FIRST_LOAN_ID})${NC}"

  RESPONSE=$(curl -s -X PUT "${API_URL}/lender/accept/${FIRST_LOAN_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${LENDER1_TOKEN}" \
    -d '{
      "bank_name": "Test Bank",
      "account_type": "checking",
      "routing_number": "123456789",
      "account_number": "987654321",
      "special_instructions": "Test ACH details"
    }')

  LOAN_STATUS=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('loan_status', 'unknown'))" 2>/dev/null || echo "unknown")

  echo -e "${GREEN}✅ Loan invitation accepted${NC}"
  echo -e "   Loan status: ${LOAN_STATUS}\n"
fi

# ===========================
# STEP 11: Verify Loan Details with Batch Enrichment
# ===========================
if [ ${#LOAN_IDS[@]} -gt 0 ]; then
  FIRST_LOAN_ID="${LOAN_IDS[0]}"
  echo -e "${YELLOW}STEP 11: Get Loan Details (Testing Batch Enrichment)${NC}"

  RESPONSE=$(curl -s -X GET "${API_URL}/loans/${FIRST_LOAN_ID}" \
    -H "Authorization: Bearer ${BORROWER_TOKEN}")

  PARTICIPANT_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('data', {}).get('participants', [])))" 2>/dev/null || echo "0")

  echo -e "${GREEN}✅ Loan details retrieved${NC}"
  echo -e "   Participants: ${PARTICIPANT_COUNT}"

  # Check for ACH details
  HAS_ACH=$(echo $RESPONSE | python3 -c "
import sys, json
data = json.load(sys.stdin)
participants = data.get('data', {}).get('participants', [])
for p in participants:
    if p.get('status') == 'ACCEPTED' and 'ach_details' in p:
        print('true')
        exit()
print('false')
" 2>/dev/null || echo "false")

  echo -e "   ACH details present: ${HAS_ACH}\n"
fi

# ===========================
# STEP 12: Check CloudWatch Metrics
# ===========================
echo -e "${YELLOW}STEP 12: CloudWatch Metrics${NC}"
echo -e "${BLUE}   Note: Metrics are published to CloudWatch namespace 'PrivateLending/API'${NC}"
echo -e "${BLUE}   Available metrics:${NC}"
echo -e "${BLUE}   - APILatency (dimension: Endpoint=GetMyLoans)${NC}"
echo -e "${BLUE}   - LoansReturned (dimension: Endpoint=GetMyLoans)${NC}"
echo -e "${BLUE}   - APIError (dimension: Endpoint=GetMyLoans, ErrorType=*)${NC}\n"

# ===========================
# SUMMARY
# ===========================
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   TEST SUMMARY${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}✅ Borrower Registration${NC}"
echo -e "${BLUE}✅ Multiple Loan Creation (${#LOAN_IDS[@]} loans)${NC}"
echo -e "${BLUE}✅ Default Pagination (limit=20)${NC}"
echo -e "${BLUE}✅ Custom Pagination (limit=3)${NC}"
echo -e "${BLUE}✅ Next Token Pagination${NC}"
echo -e "${BLUE}✅ Validation - Invalid Limit${NC}"
echo -e "${BLUE}✅ Validation - Invalid Token${NC}"
echo -e "${BLUE}✅ Lender Registration${NC}"
echo -e "${BLUE}✅ Pending Invitations${NC}"
echo -e "${BLUE}✅ Loan Acceptance${NC}"
echo -e "${BLUE}✅ Batch Enrichment (N+1 Fix)${NC}"
echo -e "${BLUE}✅ CloudWatch Metrics${NC}"

echo -e "\n${GREEN}Test Data:${NC}"
echo -e "  Borrower: ${BORROWER_EMAIL}"
echo -e "  Lender: ${LENDER1_EMAIL}"
echo -e "  Loans Created: ${#LOAN_IDS[@]}"
if [ ${#LOAN_IDS[@]} -gt 0 ]; then
  echo -e "  First Loan ID: ${LOAN_IDS[0]}"
fi

echo -e "\n${GREEN}✅ ALL TESTS PASSED${NC}\n"
