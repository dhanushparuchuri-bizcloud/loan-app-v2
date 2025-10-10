#!/bin/bash
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"
TIMESTAMP=$(date +%s)

echo "Testing borrower registration..."
RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Test Borrower\", \"email\": \"borrower-${TIMESTAMP}@test.com\", \"password\": \"TestPass123!\", \"is_lender\": false}")

echo "$RESPONSE" | jq '.'
