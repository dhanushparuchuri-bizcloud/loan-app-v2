#!/bin/bash

# Backend API Testing Script with jq for JSON parsing
# Tests loan_name field and incremental lender funding

API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "=========================================="
echo "Backend API Test Suite"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

# Generate unique identifiers
TIMESTAMP=$(date +%s)
TEST_EMAIL="testuser${TIMESTAMP}@example.com"
LENDER_EMAIL="lender${TIMESTAMP}@example.com"
LENDER2_EMAIL="lender2${TIMESTAMP}@example.com"

echo "Test Email: $TEST_EMAIL"
echo ""

# ==================================================
# TEST 1: Register Borrower
# ==================================================
echo -e "${YELLOW}TEST 1: Register Borrower${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test User\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"Test1234\"
  }")

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    print_result 0 "Borrower registered"
    echo "Token: ${TOKEN:0:30}..."
else
    print_result 1 "Registration failed"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi
echo ""

# ==================================================
# TEST 2: Create Loan with loan_name and 0 lenders
# ==================================================
echo -e "${YELLOW}TEST 2: Create Loan (loan_name + 0 lenders)${NC}"

START_DATE=$(date -v+30d +%Y-%m-%d 2>/dev/null || date -d "+30 days" +%Y-%m-%d)

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"loan_name\": \"My Incremental Funding Loan\",
    \"amount\": 50000,
    \"interest_rate\": 7.5,
    \"purpose\": \"Business\",
    \"description\": \"Testing incremental lender addition\",
    \"maturity_terms\": {
      \"start_date\": \"$START_DATE\",
      \"payment_frequency\": \"Monthly\",
      \"term_length\": 24
    },
    \"lenders\": []
  }")

LOAN_ID=$(echo "$CREATE_RESPONSE" | jq -r '.loan.loan_id')
LOAN_NAME=$(echo "$CREATE_RESPONSE" | jq -r '.loan.loan_name')

if [ "$LOAN_ID" != "null" ] && [ "$LOAN_NAME" = "My Incremental Funding Loan" ]; then
    print_result 0 "Loan created with loan_name and 0 lenders"
    echo "Loan ID: $LOAN_ID"
    echo "Loan Name: $LOAN_NAME"
else
    print_result 1 "Loan creation failed"
    echo "Response: $CREATE_RESPONSE"
fi
echo ""

# ==================================================
# TEST 3: Get Loan Details
# ==================================================
echo -e "${YELLOW}TEST 3: GET /loans/{id} (verify loan_name)${NC}"

GET_RESPONSE=$(curl -s -X GET "$API_URL/loans/$LOAN_ID" \
  -H "Authorization: Bearer $TOKEN")

RETRIEVED_NAME=$(echo "$GET_RESPONSE" | jq -r '.data.loan_name')

if [ "$RETRIEVED_NAME" = "My Incremental Funding Loan" ]; then
    print_result 0 "Loan name retrieved correctly"
else
    print_result 1 "Loan name not found"
    echo "Retrieved: $RETRIEVED_NAME"
fi
echo ""

# ==================================================
# TEST 4: Add First Lender (Partial - $20k of $50k)
# ==================================================
echo -e "${YELLOW}TEST 4: POST /loans/{id}/lenders (add \$20k)${NC}"

ADD1_RESPONSE=$(curl -s -X POST "$API_URL/loans/$LOAN_ID/lenders" \
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

ADDED=$(echo "$ADD1_RESPONSE" | jq -r '.data.lenders_added')
TOTAL=$(echo "$ADD1_RESPONSE" | jq -r '.data.total_invited')
REMAINING=$(echo "$ADD1_RESPONSE" | jq -r '.data.remaining')

# Convert float to int for comparison
TOTAL_INT=$(echo "$TOTAL" | awk '{print int($1)}')

if [ "$ADDED" = "1" ] && [ "$TOTAL_INT" = "20000" ]; then
    print_result 0 "First lender added (\$20k invited, \$${REMAINING} remaining)"
else
    print_result 1 "Adding first lender failed"
    echo "Response: $ADD1_RESPONSE"
fi
echo ""

# ==================================================
# TEST 5: Add Second Lender (Complete - $30k more)
# ==================================================
echo -e "${YELLOW}TEST 5: POST /loans/{id}/lenders (add \$30k)${NC}"

ADD2_RESPONSE=$(curl -s -X POST "$API_URL/loans/$LOAN_ID/lenders" \
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

ADDED2=$(echo "$ADD2_RESPONSE" | jq -r '.data.lenders_added')
TOTAL2=$(echo "$ADD2_RESPONSE" | jq -r '.data.total_invited')
FULLY=$(echo "$ADD2_RESPONSE" | jq -r '.data.is_fully_invited')

# Convert float to int for comparison
TOTAL2_INT=$(echo "$TOTAL2" | awk '{print int($1)}')

if [ "$ADDED2" = "1" ] && [ "$TOTAL2_INT" = "50000" ] && [ "$FULLY" = "true" ]; then
    print_result 0 "Second lender added (fully invited: $FULLY)"
else
    print_result 1 "Adding second lender failed"
    echo "Response: $ADD2_RESPONSE"
fi
echo ""

# ==================================================
# TEST 6: Try Over-Funding (Should Fail)
# ==================================================
echo -e "${YELLOW}TEST 6: Try to exceed loan amount (should fail)${NC}"

OVER_RESPONSE=$(curl -s -X POST "$API_URL/loans/$LOAN_ID/lenders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"lenders\": [
      {
        \"email\": \"extra@example.com\",
        \"contribution_amount\": 5000
      }
    ]
  }")

if echo "$OVER_RESPONSE" | jq -r '.message' | grep -q "exceed"; then
    print_result 0 "Over-funding correctly rejected"
else
    print_result 1 "Over-funding was not rejected"
    echo "Response: $OVER_RESPONSE"
fi
echo ""

# ==================================================
# TEST 7: Create Loan with Initial Lenders
# ==================================================
echo -e "${YELLOW}TEST 7: Create loan with loan_name + initial lenders${NC}"

CREATE2_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"loan_name\": \"Traditional Fully Funded Loan\",
    \"amount\": 30000,
    \"interest_rate\": 6.0,
    \"purpose\": \"Personal\",
    \"description\": \"Testing backward compatibility\",
    \"maturity_terms\": {
      \"start_date\": \"$START_DATE\",
      \"payment_frequency\": \"Monthly\",
      \"term_length\": 12
    },
    \"lenders\": [
      {
        \"email\": \"upfront1@example.com\",
        \"contribution_amount\": 30000
      }
    ]
  }")

LOAN2_ID=$(echo "$CREATE2_RESPONSE" | jq -r '.loan.loan_id')
INVITES=$(echo "$CREATE2_RESPONSE" | jq -r '.loan.invitations_created')

if [ "$LOAN2_ID" != "null" ] && [ "$INVITES" = "1" ]; then
    print_result 0 "Loan created with initial lenders"
    echo "Loan ID: $LOAN2_ID"
else
    print_result 1 "Creating loan with initial lenders failed"
fi
echo ""

# ==================================================
# TEST 8: Partial Upfront + Incremental
# ==================================================
echo -e "${YELLOW}TEST 8: Partial upfront (\$15k) + incremental (\$25k)${NC}"

CREATE3_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"loan_name\": \"Mixed Funding Strategy\",
    \"amount\": 40000,
    \"interest_rate\": 8.0,
    \"purpose\": \"Business\",
    \"description\": \"Partial upfront then incremental\",
    \"maturity_terms\": {
      \"start_date\": \"$START_DATE\",
      \"payment_frequency\": \"Monthly\",
      \"term_length\": 18
    },
    \"lenders\": [
      {
        \"email\": \"partial@example.com\",
        \"contribution_amount\": 15000
      }
    ]
  }")

LOAN3_ID=$(echo "$CREATE3_RESPONSE" | jq -r '.loan.loan_id')

if [ "$LOAN3_ID" != "null" ]; then
    # Add remaining
    ADD_REST=$(curl -s -X POST "$API_URL/loans/$LOAN3_ID/lenders" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{
        \"lenders\": [{\"email\": \"rest@example.com\", \"contribution_amount\": 25000}]
      }")

    FULL=$(echo "$ADD_REST" | jq -r '.data.is_fully_invited')

    if [ "$FULL" = "true" ]; then
        print_result 0 "Mixed strategy: \$15k upfront + \$25k incremental"
    else
        print_result 1 "Mixed strategy failed to complete"
    fi
else
    print_result 1 "Mixed strategy: initial creation failed"
fi
echo ""

# ==================================================
# TEST 9: Get My Loans
# ==================================================
echo -e "${YELLOW}TEST 9: GET /loans/my-loans (all loan names)${NC}"

MY_LOANS=$(curl -s -X GET "$API_URL/loans/my-loans" \
  -H "Authorization: Bearer $TOKEN")

LOAN_COUNT=$(echo "$MY_LOANS" | jq '.data.loans | length')

if [ "$LOAN_COUNT" -ge 3 ]; then
    print_result 0 "Retrieved $LOAN_COUNT loans with loan_name fields"
    echo "Loan names:"
    echo "$MY_LOANS" | jq -r '.data.loans[].loan_name' | while read name; do
        echo "  - $name"
    done
else
    print_result 1 "Failed to retrieve loans"
fi
echo ""

# ==================================================
# SUMMARY
# ==================================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "=========================================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
