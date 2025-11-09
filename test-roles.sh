#!/bin/bash

API_URL="https://api.ubertejas.vc"

echo "========================================="
echo "Testing Role API for 3 Email Addresses"
echo "========================================="
echo ""

# Array of emails to test
emails=(
  "dhanush.paruchuri@bizcloudexperts.com"
  "dhanushparuchuri@gmail.com"
  "dhanush.paruchuri07@gmail.com"
)

for email in "${emails[@]}"; do
  echo "----------------------------------------"
  echo "Testing: $email"
  echo "----------------------------------------"
  
  # Test the /rpc/my_available_roles endpoint
  echo "1. Calling /rpc/my_available_roles with role 'borrower':"
  curl -s -X POST "${API_URL}/rpc/my_available_roles" \
    -H "X-User-Email: $email" \
    -H "X-Active-Role: borrower" \
    -H "Content-Type: application/json" \
    -d '{}' | jq '.' || echo "No data or error"
  
  echo ""
  echo "2. Calling /rpc/my_available_roles with role 'admin':"
  curl -s -X POST "${API_URL}/rpc/my_available_roles" \
    -H "X-User-Email: $email" \
    -H "X-Active-Role: admin" \
    -H "Content-Type: application/json" \
    -d '{}' | jq '.' || echo "No data or error"
  
  echo ""
  echo "3. Checking if user exists in /users table:"
  curl -s -X GET "${API_URL}/users?email=eq.$email" \
    -H "X-User-Email: $email" \
    -H "X-Active-Role: admin" \
    -H "Content-Type: application/json" | jq '.' || echo "No data or error"
  
  echo ""
  echo ""
done

echo "========================================="
echo "Test Complete"
echo "========================================="
