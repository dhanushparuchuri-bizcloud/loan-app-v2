#!/bin/bash

# API Testing Script for Private Lending Marketplace

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
API_URL=""
ENVIRONMENT="dev"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --api-url URL          API Gateway URL"
      echo "  -e, --environment ENV  Environment (dev, staging, production)"
      echo "  -h, --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Get API URL from CloudFormation if not provided
if [ -z "$API_URL" ]; then
  STACK_NAME="marketplace-backend-${ENVIRONMENT}"
  if [ "$ENVIRONMENT" = "dev" ]; then
    STACK_NAME="marketplace-backend-dev"
  fi
  
  API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`MarketplaceApiUrl`].OutputValue' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")
  
  if [ -z "$API_URL" ]; then
    echo -e "${RED}❌ Could not get API URL. Please provide --api-url${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}🧪 Testing API endpoints for environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}API URL: ${API_URL}${NC}"

# Test variables
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
TEST_NAME="Test User"
JWT_TOKEN=""
USER_ID=""

# Function to make API calls
make_api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  local headers=$4
  
  local full_url="${API_URL}${endpoint}"
  local response_file=$(mktemp)
  local status_code
  
  if [ -n "$headers" ]; then
    status_code=$(curl -s -w "%{http_code}" -X "$method" "$full_url" \
      -H "Content-Type: application/json" \
      -H "$headers" \
      -d "$data" \
      -o "$response_file")
  else
    status_code=$(curl -s -w "%{http_code}" -X "$method" "$full_url" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -o "$response_file")
  fi
  
  echo "$status_code:$(cat $response_file)"
  rm -f "$response_file"
}

# Test 1: User Registration
echo -e "${YELLOW}📝 Testing user registration...${NC}"
response=$(make_api_call "POST" "auth/register" "{\"name\":\"$TEST_NAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
  echo -e "${GREEN}✅ Registration successful${NC}"
  JWT_TOKEN=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")
  USER_ID=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('user_id', ''))" 2>/dev/null || echo "")
else
  echo -e "${RED}❌ Registration failed (Status: $status_code)${NC}"
  echo "Response: $response_body"
fi

# Test 2: User Login
echo -e "${YELLOW}🔐 Testing user login...${NC}"
response=$(make_api_call "POST" "auth/login" "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ]; then
  echo -e "${GREEN}✅ Login successful${NC}"
  if [ -z "$JWT_TOKEN" ]; then
    JWT_TOKEN=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")
    USER_ID=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('user_id', ''))" 2>/dev/null || echo "")
  fi
else
  echo -e "${RED}❌ Login failed (Status: $status_code)${NC}"
  echo "Response: $response_body"
fi

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}❌ No JWT token received. Cannot continue with authenticated tests.${NC}"
  exit 1
fi

echo -e "${BLUE}🎫 JWT Token received${NC}"

# Test 3: Get User Profile
echo -e "${YELLOW}👤 Testing get user profile...${NC}"
response=$(make_api_call "GET" "user/profile" "" "Authorization: Bearer $JWT_TOKEN")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ]; then
  echo -e "${GREEN}✅ Get profile successful${NC}"
else
  echo -e "${RED}❌ Get profile failed (Status: $status_code)${NC}"
  echo "Response: $response_body"
fi

# Test 4: Get Dashboard
echo -e "${YELLOW}📊 Testing get dashboard...${NC}"
response=$(make_api_call "GET" "user/dashboard" "" "Authorization: Bearer $JWT_TOKEN")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ]; then
  echo -e "${GREEN}✅ Get dashboard successful${NC}"
else
  echo -e "${RED}❌ Get dashboard failed (Status: $status_code)${NC}"
  echo "Response: $response_body"
fi

# Test 5: Create Loan with new lender email (to create invitation)
echo -e "${YELLOW}💰 Testing create loan with new lender...${NC}"
LENDER_EMAIL="lender-$(date +%s)@example.com"
loan_data="{
  \"amount\": 15000,
  \"interest_rate\": 7.5,
  \"term\": \"Monthly\",
  \"purpose\": \"Business\",
  \"description\": \"Test loan for comprehensive API testing\",
  \"lenders\": [
    {
      \"email\": \"$LENDER_EMAIL\",
      \"contribution_amount\": 8000
    },
    {
      \"email\": \"newlender@example.com\", 
      \"contribution_amount\": 7000
    }
  ]
}"

response=$(make_api_call "POST" "loans" "$loan_data" "Authorization: Bearer $JWT_TOKEN")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

LOAN_ID=""
if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
  echo -e "${GREEN}✅ Create loan successful${NC}"
  LOAN_ID=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('loan', {}).get('loan_id', ''))" 2>/dev/null || echo "")
  if [ -z "$LOAN_ID" ]; then
    LOAN_ID=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('loan_id', ''))" 2>/dev/null || echo "")
  fi
  echo "Created loan ID: $LOAN_ID"
else
  echo -e "${RED}❌ Create loan failed (Status: $status_code)${NC}"
  echo "Response: $response_body"
fi

# Test 6: Register the lender (should get lender role due to pending invitation)
echo -e "${YELLOW}👥 Registering lender with pending invitation...${NC}"
LENDER_PASSWORD="LenderPassword123!"
LENDER_NAME="Test Lender"

response=$(make_api_call "POST" "auth/register" "{\"name\":\"$LENDER_NAME\",\"email\":\"$LENDER_EMAIL\",\"password\":\"$LENDER_PASSWORD\"}")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

LENDER_JWT_TOKEN=""
LENDER_USER_ID=""
if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
  echo -e "${GREEN}✅ Lender registration successful${NC}"
  LENDER_JWT_TOKEN=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")
  LENDER_USER_ID=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('user_id', ''))" 2>/dev/null || echo "")
  is_lender=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('is_lender', False))" 2>/dev/null || echo "false")
  echo "Lender role activated: $is_lender"
else
  echo -e "${RED}❌ Lender registration failed (Status: $status_code)${NC}"
  echo "Response: $response_body"
fi

# Test 7: Get My Loans
echo -e "${YELLOW}📋 Testing get my loans...${NC}"
response=$(make_api_call "GET" "loans/my-loans" "" "Authorization: Bearer $JWT_TOKEN")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ]; then
  echo -e "${GREEN}✅ Get my loans successful${NC}"
else
  echo -e "${RED}❌ Get my loans failed (Status: $status_code)${NC}"
  echo "Response: $response_body"
fi

# Test 8: Get Loan Details (if loan was created)
if [ -n "$LOAN_ID" ]; then
  echo -e "${YELLOW}🔍 Testing get loan details...${NC}"
  response=$(make_api_call "GET" "loans/$LOAN_ID" "" "Authorization: Bearer $JWT_TOKEN")
  status_code=$(echo "$response" | cut -d: -f1)
  response_body=$(echo "$response" | cut -d: -f2-)

  if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ Get loan details successful${NC}"
  else
    echo -e "${RED}❌ Get loan details failed (Status: $status_code)${NC}"
    echo "Response: $response_body"
  fi
fi

# Test 9: Get Pending Invitations (as existing lender)
if [ -n "$LENDER_JWT_TOKEN" ]; then
  echo -e "${YELLOW}📬 Testing get pending invitations (as lender)...${NC}"
  response=$(make_api_call "GET" "lender/pending" "" "Authorization: Bearer $LENDER_JWT_TOKEN")
  status_code=$(echo "$response" | cut -d: -f1)
  response_body=$(echo "$response" | cut -d: -f2-)

  if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ Get pending invitations successful${NC}"
    echo "Invitations found: $(echo "$response_body" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('invitations', [])))" 2>/dev/null || echo "0")"
  else
    echo -e "${YELLOW}⚠️  Get pending invitations returned status $status_code${NC}"
    echo "Response: $response_body"
  fi
else
  echo -e "${YELLOW}⏭️  Skipping pending invitations test (no lender token)${NC}"
fi

# Test 10: Accept Loan Invitation (if loan was created and lender exists)
if [ -n "$LOAN_ID" ] && [ -n "$LENDER_JWT_TOKEN" ]; then
  echo -e "${YELLOW}✅ Testing accept loan invitation...${NC}"
  
  # First, let's add ACH details for the acceptance
  ach_data='{
    "bank_name": "Test Bank",
    "account_type": "checking",
    "routing_number": "123456789",
    "account_number": "987654321",
    "special_instructions": "Test ACH details for API testing"
  }'
  
  response=$(make_api_call "PUT" "lender/accept/$LOAN_ID" "$ach_data" "Authorization: Bearer $LENDER_JWT_TOKEN")
  status_code=$(echo "$response" | cut -d: -f1)
  response_body=$(echo "$response" | cut -d: -f2-)

  if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ Accept loan invitation successful${NC}"
    loan_status=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('loan_status', 'unknown'))" 2>/dev/null || echo "unknown")
    contribution=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('contribution_amount', 0))" 2>/dev/null || echo "0")
    echo "Loan status after acceptance: $loan_status"
    echo "Contribution amount: $contribution"
  else
    echo -e "${RED}❌ Accept loan invitation failed (Status: $status_code)${NC}"
    echo "Response: $response_body"
  fi
else
  echo -e "${YELLOW}⏭️  Skipping loan acceptance test (no loan ID or lender token)${NC}"
fi

# Test 11: Verify loan status after acceptance
if [ -n "$LOAN_ID" ]; then
  echo -e "${YELLOW}🔄 Testing loan status after acceptance...${NC}"
  response=$(make_api_call "GET" "loans/$LOAN_ID" "" "Authorization: Bearer $JWT_TOKEN")
  status_code=$(echo "$response" | cut -d: -f1)
  response_body=$(echo "$response" | cut -d: -f2-)

  if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ Get updated loan details successful${NC}"
    loan_status=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('status', 'unknown'))" 2>/dev/null || echo "unknown")
    total_funded=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('total_funded', 0))" 2>/dev/null || echo "0")
    echo "Updated loan status: $loan_status"
    echo "Total funded: $total_funded"
    
    # Check for ACH details in accepted participants
    echo -e "${YELLOW}🏦 Checking ACH details for accepted participants...${NC}"
    echo "$response_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    participants = data.get('data', {}).get('participants', [])
    ach_found = False
    for p in participants:
        if p.get('status') == 'ACCEPTED':
            if 'ach_details' in p:
                ach_found = True
                print(f'✅ ACH details found for {p.get(\"lender_name\", \"Unknown\")}:')
                ach = p['ach_details']
                print(f'  Bank: {ach.get(\"bank_name\")}')
                print(f'  Account: {ach.get(\"account_type\")} {ach.get(\"account_number\")}')
                print(f'  Routing: {ach.get(\"routing_number\")}')
                if ach.get('special_instructions'):
                    print(f'  Instructions: {ach.get(\"special_instructions\")}')
            else:
                print(f'❌ No ACH details for accepted participant {p.get(\"lender_name\", \"Unknown\")}')
    if not ach_found:
        print('ℹ️  No accepted participants with ACH details found')
except Exception as e:
    print(f'Error checking ACH details: {e}')
"
  else
    echo -e "${RED}❌ Get updated loan details failed (Status: $status_code)${NC}"
    echo "Response: $response_body"
  fi
fi

# Test 12: Test borrower dashboard after loan activity
echo -e "${YELLOW}📊 Testing borrower dashboard after loan activity...${NC}"
response=$(make_api_call "GET" "user/dashboard" "" "Authorization: Bearer $JWT_TOKEN")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ]; then
  echo -e "${GREEN}✅ Get updated dashboard successful${NC}"
  total_loans=$(echo "$response_body" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('loans', [])))" 2>/dev/null || echo "0")
  echo "Total loans in dashboard: $total_loans"
else
  echo -e "${RED}❌ Get updated dashboard failed (Status: $status_code)${NC}"
  echo "Response: $response_body"
fi

# Test 13: Test lender dashboard
if [ -n "$LENDER_JWT_TOKEN" ]; then
  echo -e "${YELLOW}📊 Testing lender dashboard...${NC}"
  response=$(make_api_call "GET" "user/dashboard" "" "Authorization: Bearer $LENDER_JWT_TOKEN")
  status_code=$(echo "$response" | cut -d: -f1)
  response_body=$(echo "$response" | cut -d: -f2-)

  if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ Get lender dashboard successful${NC}"
    total_loans=$(echo "$response_body" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('loans', [])))" 2>/dev/null || echo "0")
    echo "Total loans in lender dashboard: $total_loans"
  else
    echo -e "${RED}❌ Get lender dashboard failed (Status: $status_code)${NC}"
    echo "Response: $response_body"
  fi
else
  echo -e "${YELLOW}⏭️  Skipping lender dashboard test (no lender token)${NC}"
fi

# Test 14: CORS Preflight
echo -e "${YELLOW}🌐 Testing CORS preflight...${NC}"
cors_response=$(curl -s -w "%{http_code}" -X OPTIONS "${API_URL}auth/login" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -o /dev/null)

if [ "$cors_response" = "200" ] || [ "$cors_response" = "204" ]; then
  echo -e "${GREEN}✅ CORS preflight successful${NC}"
else
  echo -e "${RED}❌ CORS preflight failed (Status: $cors_response)${NC}"
fi

echo -e "${GREEN}🎉 API testing completed!${NC}"

# Summary
echo -e "${BLUE}📋 Test Summary:${NC}"
echo "Environment: $ENVIRONMENT"
echo "API URL: $API_URL"
echo "Test Borrower: $TEST_EMAIL"
if [ -n "$LENDER_EMAIL" ]; then
  echo "Test Lender: $LENDER_EMAIL"
fi
if [ -n "$LOAN_ID" ]; then
  echo "Test Loan ID: $LOAN_ID"
fi

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Review any failed tests above"
echo "2. Check CloudWatch logs for detailed error information"
echo "3. Test the frontend integration"
echo "4. Set up monitoring and alerts"