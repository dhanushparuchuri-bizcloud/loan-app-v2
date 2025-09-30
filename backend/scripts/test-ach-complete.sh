#!/bin/bash

# Complete test to verify ACH details are returned
API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Testing ACH details in loan responses...${NC}"

# Test data
TIMESTAMP=$(date +%s)
BORROWER_EMAIL="borrower-$TIMESTAMP@example.com"
LENDER_EMAIL="lender-$TIMESTAMP@example.com"
PASSWORD="Password123!"

# Helper function for API calls
make_api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  local headers=$4
  
  local full_url="${API_URL}/${endpoint}"
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

# Step 1: Register borrower
echo -e "${YELLOW}📝 Registering borrower...${NC}"
response=$(make_api_call "POST" "auth/register" "{\"name\":\"Test Borrower\",\"email\":\"$BORROWER_EMAIL\",\"password\":\"$PASSWORD\"}")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
  echo -e "${GREEN}✅ Borrower registration successful${NC}"
  BORROWER_TOKEN=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")
else
  echo -e "${RED}❌ Borrower registration failed${NC}"
  exit 1
fi

# Step 2: Create loan with lender invitation
echo -e "${YELLOW}💰 Creating loan with lender invitation...${NC}"
loan_data="{
  \"amount\": 15000,
  \"purpose\": \"Business expansion\",
  \"description\": \"Need funds for inventory\",
  \"interest_rate\": 8.5,
  \"term\": \"24 months\",
  \"lenders\": [
    {\"email\": \"$LENDER_EMAIL\", \"contribution_amount\": 8000},
    {\"email\": \"newlender@example.com\", \"contribution_amount\": 7000}
  ]
}"

response=$(make_api_call "POST" "loans" "$loan_data" "Authorization: Bearer $BORROWER_TOKEN")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
  echo -e "${GREEN}✅ Loan creation successful${NC}"
  LOAN_ID=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('loan_id', ''))" 2>/dev/null || echo "")
  echo "Loan ID: $LOAN_ID"
else
  echo -e "${RED}❌ Loan creation failed${NC}"
  echo "Response: $response_body"
  exit 1
fi

# Step 3: Register lender
echo -e "${YELLOW}👥 Registering lender...${NC}"
response=$(make_api_call "POST" "auth/register" "{\"name\":\"Test Lender\",\"email\":\"$LENDER_EMAIL\",\"password\":\"$PASSWORD\"}")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
  echo -e "${GREEN}✅ Lender registration successful${NC}"
  LENDER_TOKEN=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")
  IS_LENDER=$(echo "$response_body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('is_lender', False))" 2>/dev/null || echo "")
  echo "Lender role activated: $IS_LENDER"
else
  echo -e "${RED}❌ Lender registration failed${NC}"
  exit 1
fi

# Step 4: Accept loan invitation with ACH details
echo -e "${YELLOW}✅ Accepting loan invitation with ACH details...${NC}"
ach_data="{
  \"bank_name\": \"Chase Bank\",
  \"account_type\": \"CHECKING\",
  \"routing_number\": \"021000021\",
  \"account_number\": \"1234567890\",
  \"special_instructions\": \"Please send ACH on Fridays\"
}"

response=$(make_api_call "PUT" "lender/accept/$LOAN_ID" "$ach_data" "Authorization: Bearer $LENDER_TOKEN")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ]; then
  echo -e "${GREEN}✅ Loan acceptance successful${NC}"
else
  echo -e "${RED}❌ Loan acceptance failed (Status: $status_code)${NC}"
  echo "Response: $response_body"
fi

# Step 5: Check loan details for ACH information
echo -e "${YELLOW}🔍 Checking loan details for ACH information...${NC}"
response=$(make_api_call "GET" "loans/$LOAN_ID" "" "Authorization: Bearer $BORROWER_TOKEN")
status_code=$(echo "$response" | cut -d: -f1)
response_body=$(echo "$response" | cut -d: -f2-)

if [ "$status_code" = "200" ]; then
  echo -e "${GREEN}✅ Loan details retrieved${NC}"
  echo ""
  echo -e "${YELLOW}📊 Full loan response:${NC}"
  echo "$response_body" | python3 -m json.tool
  
  echo ""
  echo -e "${YELLOW}🏦 ACH Details for accepted participants:${NC}"
  echo "$response_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    participants = data.get('participants', [])
    for p in participants:
        if p.get('status') == 'ACCEPTED' and 'ach_details' in p:
            print(f\"Lender: {p.get('lender_name', 'Unknown')}\")
            print(f\"Contribution: \${p.get('contribution_amount', 0)}\")
            ach = p['ach_details']
            print(f\"Bank: {ach.get('bank_name')}\")
            print(f\"Account Type: {ach.get('account_type')}\")
            print(f\"Routing: {ach.get('routing_number')}\")
            print(f\"Account: {ach.get('account_number')}\")
            if ach.get('special_instructions'):
                print(f\"Instructions: {ach.get('special_instructions')}\")
            print('---')
        elif p.get('status') == 'ACCEPTED':
            print(f\"Accepted participant {p.get('lender_name')} has no ACH details\")
except Exception as e:
    print(f'Error parsing response: {e}')
"
else
  echo -e "${RED}❌ Failed to get loan details${NC}"
  echo "Response: $response_body"
fi

echo ""
echo -e "${YELLOW}🎯 Test Summary:${NC}"
echo "Borrower: $BORROWER_EMAIL"
echo "Lender: $LENDER_EMAIL"
echo "Loan ID: $LOAN_ID"