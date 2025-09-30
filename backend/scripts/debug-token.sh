#!/bin/bash

# Debug JWT token issue
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

echo "🔍 Debugging JWT Token Issue..."

# Test data
TIMESTAMP=$(date +%s)
TEST_EMAIL="debug-$TIMESTAMP@example.com"
PASSWORD="Password123!"

echo "📝 1. Register user and get token..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Debug User\",\"email\":\"$TEST_EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Registration Response:"
echo "$REGISTER_RESPONSE" | jq .

# Extract token
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')
echo ""
echo "🎫 Extracted Token:"
echo "Token: $TOKEN"
echo "Token Length: ${#TOKEN}"
echo ""

# Check if token is valid JWT format
if [[ $TOKEN =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
    echo "✅ Token appears to be valid JWT format"
else
    echo "❌ Token does not appear to be valid JWT format"
fi

echo ""
echo "🔐 2. Test token with profile endpoint..."
PROFILE_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_URL/user/profile")

HTTP_STATUS=$(echo "$PROFILE_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$PROFILE_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body:"
echo "$RESPONSE_BODY" | jq .

echo ""
echo "🔍 3. Test with verbose curl to see headers..."
echo "Making request with verbose output..."
curl -v -H "Authorization: Bearer $TOKEN" "$API_URL/user/profile" 2>&1 | head -20

echo ""
echo "🎯 Debug Summary:"
echo "Email: $TEST_EMAIL"
echo "Token: $TOKEN"
echo "HTTP Status: $HTTP_STATUS"