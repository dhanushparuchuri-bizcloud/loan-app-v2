#!/bin/bash
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "Testing login..."
curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "search-test-borrower-1760032516@example.com", "password": "TestPass123"}' | jq '.'
