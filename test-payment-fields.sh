#!/bin/bash
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"
LOAN_ID="c31448b8-2e21-49fc-b968-c69f14311e62"
LENDER_EMAIL="dhanushparuchuri@ufl.edu"
LENDER_PASSWORD="Madtitan@07"

echo "Getting lender token..."
LENDER_TOKEN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${LENDER_EMAIL}\", \"password\": \"${LENDER_PASSWORD}\"}" | jq -r '.data.token')

echo ""
echo "Testing loan API for payment tracking fields..."
curl -s -X GET "${API_URL}/loans/${LOAN_ID}" \
  -H "Authorization: Bearer ${LENDER_TOKEN}" | jq '.data | {
    loan_id,
    borrower_id,
    user_participation: .user_participation | {
      contribution_amount,
      total_paid,
      remaining_balance,
      status
    }
  }'
