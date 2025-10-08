#!/bin/bash

# Backend API Testing Script
# Tests loan_name field and incremental lender funding

API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "=========================================="
echo "Backend API Test Suite"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

# Generate unique email for testing
TIMESTAMP=$(date +%s)
TEST_EMAIL="testuser${TIMESTAMP}@example.com"
TEST_PASSWORD="Test1234"
TEST_NAME="Test User $TIMESTAMP"

LENDER_EMAIL="lender${TIMESTAMP}@example.com"
LENDER2_EMAIL="lender2${TIMESTAMP}@example.com"

echo "Test User Email: $TEST_EMAIL"
echo ""

# ==================================================
# TEST 1: Register Borrower
# ==================================================
echo -e "${YELLOW}TEST 1: Register Borrower${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$TEST_NAME\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Response: $REGISTER_RESPONSE"

# Extract token
TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    print_result 0 "Borrower registration successful"
    echo "Token: ${TOKEN:0:20}..."
else
    print_result 1 "Borrower registration failed"
    echo "Exiting tests..."
    exit 1
fi
echo ""

# ==================================================
# TEST 2: Create Loan with loan_name and 0 lenders
# ==================================================
echo -e "${YELLOW}TEST 2: Create Loan with loan_name and 0 lenders${NC}"

START_DATE=$(date -v+30d +%Y-%m-%d 2>/dev/null || date -d "+30 days" +%Y-%m-%d)

CREATE_LOAN_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"loan_name\": \"My First Incremental Loan\",
    \"amount\": 50000,
    \"interest_rate\": 7.5,
    \"purpose\": \"Business\",
    \"description\": \"Testing incremental lender addition with a named loan\",
    \"maturity_terms\": {
      \"start_date\": \"$START_DATE\",
      \"payment_frequency\": \"Monthly\",
      \"term_length\": 24
    },
    \"lenders\": []
  }")

echo "Response: $CREATE_LOAN_RESPONSE"

# Extract loan_id
LOAN_ID=$(echo $CREATE_LOAN_RESPONSE | grep -o '"loan_id":"[^"]*"' | cut -d'"' -f4)
LOAN_NAME=$(echo $CREATE_LOAN_RESPONSE | grep -o '"loan_name":"[^"]*"' | cut -d'"' -f4)

if [ -n "$LOAN_ID" ] && [ "$LOAN_NAME" = "My First Incremental Loan" ]; then
    print_result 0 "Loan created with loan_name and 0 lenders"
    echo "Loan ID: $LOAN_ID"
    echo "Loan Name: $LOAN_NAME"
else
    print_result 1 "Loan creation with 0 lenders failed"
    echo "Response: $CREATE_LOAN_RESPONSE"
fi
echo ""

# ==================================================
# TEST 3: Get Loan Details (should show loan_name)
# ==================================================
echo -e "${YELLOW}TEST 3: Get Loan Details (verify loan_name exists)${NC}"

GET_LOAN_RESPONSE=$(curl -s -X GET "$API_URL/loans/$LOAN_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Response (truncated): ${GET_LOAN_RESPONSE:0:500}..."

RETRIEVED_LOAN_NAME=$(echo $GET_LOAN_RESPONSE | grep -o '"loan_name":"[^"]*"' | cut -d'"' -f4)

if [ "$RETRIEVED_LOAN_NAME" = "My First Incremental Loan" ]; then
    print_result 0 "Loan name retrieved correctly"
else
    print_result 1 "Loan name not found in response"
fi
echo ""

# ==================================================
# TEST 4: Add First Lender (Partial Funding - $20k of $50k)
# ==================================================
echo -e "${YELLOW}TEST 4: Add First Lender (Partial Funding)${NC}"

ADD_LENDER1_RESPONSE=$(curl -s -X POST "$API_URL/loans/$LOAN_ID/lenders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"lenders\": [
      {
        \"email\": \"$LENDER_EMAIL\",
        \"contribution_amount\": 20000
      }
    ]
  }")

echo "Response: $ADD_LENDER1_RESPONSE"

LENDERS_ADDED=$(echo $ADD_LENDER1_RESPONSE | grep -o '"lenders_added":[0-9]*' | cut -d':' -f2)
TOTAL_INVITED=$(echo $ADD_LENDER1_RESPONSE | grep -o '"total_invited":[0-9.]*' | cut -d':' -f2)
REMAINING=$(echo $ADD_LENDER1_RESPONSE | grep -o '"remaining":[0-9.]*' | cut -d':' -f2)

if [ "$LENDERS_ADDED" = "1" ] && [ "$TOTAL_INVITED" = "20000" ]; then
    print_result 0 "First lender added successfully"
    echo "Total Invited: \$$TOTAL_INVITED"
    echo "Remaining: \$$REMAINING"
else
    print_result 1 "Adding first lender failed"
fi
echo ""

# ==================================================
# TEST 5: Add Second Lender (Complete Funding - $30k more)
# ==================================================
echo -e "${YELLOW}TEST 5: Add Second Lender (Complete Funding)${NC}"

ADD_LENDER2_RESPONSE=$(curl -s -X POST "$API_URL/loans/$LOAN_ID/lenders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"lenders\": [
      {
        \"email\": \"$LENDER2_EMAIL\",
        \"contribution_amount\": 30000
      }
    ]
  }")

echo "Response: $ADD_LENDER2_RESPONSE"

LENDERS_ADDED2=$(echo $ADD_LENDER2_RESPONSE | grep -o '"lenders_added":[0-9]*' | cut -d':' -f2)
TOTAL_INVITED2=$(echo $ADD_LENDER2_RESPONSE | grep -o '"total_invited":[0-9.]*' | cut -d':' -f2)
IS_FULLY_INVITED=$(echo $ADD_LENDER2_RESPONSE | grep -o '"is_fully_invited":[a-z]*' | cut -d':' -f2)

if [ "$LENDERS_ADDED2" = "1" ] && [ "$TOTAL_INVITED2" = "50000" ]; then
    print_result 0 "Second lender added successfully"
    echo "Total Invited: \$$TOTAL_INVITED2"
    echo "Fully Invited: $IS_FULLY_INVITED"
else
    print_result 1 "Adding second lender failed"
fi
echo ""

# ==================================================
# TEST 6: Try to Add Lender Beyond Loan Amount (Should Fail)
# ==================================================
echo -e "${YELLOW}TEST 6: Try to Add Lender Beyond Loan Amount (Should Fail)${NC}"

ADD_OVERLIMIT_RESPONSE=$(curl -s -X POST "$API_URL/loans/$LOAN_ID/lenders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"lenders\": [
      {
        \"email\": \"overlimit@example.com\",
        \"contribution_amount\": 5000
      }
    ]
  }")

echo "Response: $ADD_OVERLIMIT_RESPONSE"

if echo "$ADD_OVERLIMIT_RESPONSE" | grep -q "would exceed loan amount"; then
    print_result 0 "Over-funding correctly rejected"
else
    print_result 1 "Over-funding was not rejected"
fi
echo ""

# ==================================================
# TEST 7: Create Loan with loan_name AND Initial Lenders
# ==================================================
echo -e "${YELLOW}TEST 7: Create Loan with loan_name AND Initial Lenders${NC}"

CREATE_LOAN2_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"loan_name\": \"Traditional Loan with Upfront Lenders\",
    \"amount\": 30000,
    \"interest_rate\": 6.0,
    \"purpose\": \"Personal\",
    \"description\": \"Testing backward compatibility with initial lenders\",
    \"maturity_terms\": {
      \"start_date\": \"$START_DATE\",
      \"payment_frequency\": \"Monthly\",
      \"term_length\": 12
    },
    \"lenders\": [
      {
        \"email\": \"upfront1@example.com\",
        \"contribution_amount\": 10000
      },
      {
        \"email\": \"upfront2@example.com\",
        \"contribution_amount\": 20000
      }
    ]
  }")

echo "Response: $CREATE_LOAN2_RESPONSE"

LOAN_ID2=$(echo $CREATE_LOAN2_RESPONSE | grep -o '"loan_id":"[^"]*"' | cut -d'"' -f4)
INVITATIONS_CREATED=$(echo $CREATE_LOAN2_RESPONSE | grep -o '"invitations_created":[0-9]*' | cut -d':' -f2)

if [ -n "$LOAN_ID2" ] && [ "$INVITATIONS_CREATED" = "2" ]; then
    print_result 0 "Loan created with loan_name and initial lenders"
    echo "Loan ID: $LOAN_ID2"
    echo "Invitations Created: $INVITATIONS_CREATED"
else
    print_result 1 "Creating loan with initial lenders failed"
fi
echo ""

# ==================================================
# TEST 8: Create Loan with Partial Initial Funding
# ==================================================
echo -e "${YELLOW}TEST 8: Create Loan with Partial Initial Funding${NC}"

CREATE_LOAN3_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"loan_name\": \"Partially Funded Upfront Loan\",
    \"amount\": 40000,
    \"interest_rate\": 8.0,
    \"purpose\": \"Business\",
    \"description\": \"Testing partial upfront funding\",
    \"maturity_terms\": {
      \"start_date\": \"$START_DATE\",
      \"payment_frequency\": \"Monthly\",
      \"term_length\": 18
    },
    \"lenders\": [
      {
        \"email\": \"partial1@example.com\",
        \"contribution_amount\": 15000
      }
    ]
  }")

echo "Response: $CREATE_LOAN3_RESPONSE"

LOAN_ID3=$(echo $CREATE_LOAN3_RESPONSE | grep -o '"loan_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$LOAN_ID3" ]; then
    print_result 0 "Loan created with partial upfront funding"
    echo "Loan ID: $LOAN_ID3"

    # Now add more lenders to complete it
    echo "  → Adding remaining \$25,000..."

    ADD_REMAINING_RESPONSE=$(curl -s -X POST "$API_URL/loans/$LOAN_ID3/lenders" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{
        \"lenders\": [
          {
            \"email\": \"partial2@example.com\",
            \"contribution_amount\": 25000
          }
        ]
      }")

    if echo "$ADD_REMAINING_RESPONSE" | grep -q "\"is_fully_invited\":true"; then
        echo -e "  ${GREEN}✓${NC} Loan fully funded after incremental addition"
    else
        echo -e "  ${RED}✗${NC} Failed to complete funding"
    fi
else
    print_result 1 "Creating loan with partial upfront funding failed"
fi
echo ""

# ==================================================
# TEST 9: Get My Loans (should show loan_name in list)
# ==================================================
echo -e "${YELLOW}TEST 9: Get My Loans (verify loan_name in list)${NC}"

GET_MY_LOANS_RESPONSE=$(curl -s -X GET "$API_URL/loans/my-loans" \
  -H "Authorization: Bearer $TOKEN")

echo "Response (truncated): ${GET_MY_LOANS_RESPONSE:0:800}..."

if echo "$GET_MY_LOANS_RESPONSE" | grep -q "My First Incremental Loan"; then
    print_result 0 "Loan names appearing in my-loans list"
else
    print_result 1 "Loan names not found in my-loans list"
fi
echo ""

# ==================================================
# SUMMARY
# ==================================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "=========================================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Review output above.${NC}"
    exit 1
fi
