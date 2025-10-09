#!/bin/bash

# Test the lender search endpoint
# Creates test data and tests the search functionality

API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"
TIMESTAMP=$(date +%s)
BORROWER_EMAIL="search-test-borrower-${TIMESTAMP}@example.com"
LENDER1_EMAIL="search-test-lender1-${TIMESTAMP}@example.com"
LENDER2_EMAIL="search-test-lender2-${TIMESTAMP}@example.com"
PASSWORD="TestPassword123!"

echo "=== Testing Lender Search Endpoint ==="
echo ""

# Step 1: Register borrower
echo "1. Registering borrower..."
BORROWER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Search Test Borrower\",\"email\":\"$BORROWER_EMAIL\",\"password\":\"$PASSWORD\"}")

BORROWER_TOKEN=$(echo "$BORROWER_RESPONSE" | jq -r '.token')
echo "Borrower registered: $(echo "$BORROWER_RESPONSE" | jq -r '.user.name')"

# Step 2: Create a loan with lenders (using their emails before they register)
echo ""
echo "2. Creating loan with lenders..."
LOAN_RESPONSE=$(curl -s -X POST "$API_URL/loans" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"loan_name\": \"Search Test Loan\",
    \"amount\": 50000,
    \"interest_rate\": 5.5,
    \"maturity_terms\": {
      \"start_date\": \"2025-11-01\",
      \"payment_frequency\": \"Monthly\",
      \"term_length\": 24
    },
    \"purpose\": \"Business Expansion\",
    \"description\": \"Test loan for search functionality\",
    \"lenders\": [
      {\"email\": \"$LENDER1_EMAIL\", \"contribution_amount\": 30000},
      {\"email\": \"$LENDER2_EMAIL\", \"contribution_amount\": 20000}
    ]
  }")

LOAN_ID=$(echo "$LOAN_RESPONSE" | jq -r '.loan.loan_id')
echo "Loan created: $LOAN_ID"

# Step 3: Register lenders (they will auto-activate as lenders due to pending invitations)
echo ""
echo "3. Registering lenders (with pending invitations)..."
LENDER1_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"John Smith\",\"email\":\"$LENDER1_EMAIL\",\"password\":\"$PASSWORD\"}")

LENDER1_TOKEN=$(echo "$LENDER1_RESPONSE" | jq -r '.token')
LENDER1_IS_LENDER=$(echo "$LENDER1_RESPONSE" | jq -r '.user.is_lender')
echo "Lender 1 registered: John Smith (is_lender: $LENDER1_IS_LENDER)"

LENDER2_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Jane Doe\",\"email\":\"$LENDER2_EMAIL\",\"password\":\"$PASSWORD\"}")

LENDER2_TOKEN=$(echo "$LENDER2_RESPONSE" | jq -r '.token')
LENDER2_IS_LENDER=$(echo "$LENDER2_RESPONSE" | jq -r '.user.is_lender')
echo "Lender 2 registered: Jane Doe (is_lender: $LENDER2_IS_LENDER)"

# Step 4: Lenders accept the loan
echo ""
echo "4. Lenders accepting loan..."
ACCEPT1_RESPONSE=$(curl -s -X PUT "$API_URL/lender/accept/$LOAN_ID" \
  -H "Authorization: Bearer $LENDER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bank_name": "Test Bank 1",
    "account_type": "checking",
    "routing_number": "123456789",
    "account_number": "987654321"
  }')

echo "Lender 1 response:"
echo "$ACCEPT1_RESPONSE" | jq .
ACCEPT1_STATUS=$(echo "$ACCEPT1_RESPONSE" | jq -r '.data.status // .status // "unknown"')
echo "Status: $ACCEPT1_STATUS"

ACCEPT2_RESPONSE=$(curl -s -X PUT "$API_URL/lender/accept/$LOAN_ID" \
  -H "Authorization: Bearer $LENDER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bank_name": "Test Bank 2",
    "account_type": "savings",
    "routing_number": "987654321",
    "account_number": "123456789"
  }')

echo ""
echo "Lender 2 response:"
echo "$ACCEPT2_RESPONSE" | jq .
ACCEPT2_STATUS=$(echo "$ACCEPT2_RESPONSE" | jq -r '.data.status // .status // "unknown"')
echo "Status: $ACCEPT2_STATUS"

# Step 5: Test search endpoint
echo ""
echo "5. Testing search endpoint (all lenders)..."
SEARCH_ALL=$(curl -s -X GET "$API_URL/lenders/search" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -H "Content-Type: application/json")

echo "$SEARCH_ALL" | jq .
LENDER_COUNT=$(echo "$SEARCH_ALL" | jq -r '.data.total_count')
echo "Found $LENDER_COUNT lenders"

# Step 6: Test search with query
echo ""
echo "6. Testing search with query (q=john)..."
SEARCH_JOHN=$(curl -s -X GET "$API_URL/lenders/search?q=john" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -H "Content-Type: application/json")

echo "$SEARCH_JOHN" | jq .
JOHN_COUNT=$(echo "$SEARCH_JOHN" | jq -r '.data.total_count')
echo "Found $JOHN_COUNT lenders matching 'john'"

# Step 7: Test search with different query
echo ""
echo "7. Testing search with query (q=jane)..."
SEARCH_JANE=$(curl -s -X GET "$API_URL/lenders/search?q=jane" \
  -H "Authorization: Bearer $BORROWER_TOKEN" \
  -H "Content-Type: application/json")

echo "$SEARCH_JANE" | jq .
JANE_COUNT=$(echo "$SEARCH_JANE" | jq -r '.data.total_count')
echo "Found $JANE_COUNT lenders matching 'jane'"

echo ""
echo "=== Test Complete ==="
echo "Summary:"
echo "- Created 1 borrower and 2 lenders"
echo "- Created 1 loan with both lenders"
echo "- Both lenders accepted the loan"
echo "- Search all found: $LENDER_COUNT lenders"
echo "- Search 'john' found: $JOHN_COUNT lenders"
echo "- Search 'jane' found: $JANE_COUNT lenders"
