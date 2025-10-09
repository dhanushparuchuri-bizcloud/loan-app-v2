# Lender Search Feature Implementation

## Overview
Implemented a lender search endpoint that allows borrowers to search for previous lenders who have participated in loans. This helps borrowers find and invite lenders who have a history of investing.

## Backend Changes

### 1. API Endpoint
- **Endpoint**: `GET /lenders/search`
- **Query Parameter**: `q` (optional) - Search query to filter by lender name or email
- **Authentication**: Requires borrower role
- **Response**: List of lenders with their investment statistics

### 2. Handler Implementation
**File**: `backend/src/handlers/lender_handler/index.py`

Added `handle_search_lenders()` function that:
- Scans all loan participants with ACCEPTED status
- Groups investments by lender
- Calculates statistics for each lender:
  - Total number of investments
  - Total amount invested
  - Average investment amount
  - Average APR across all investments
- Includes details of the most recent investment
- Filters results by search query (name or email)
- Sorts results by total invested amount (descending)

### 3. SAM Template Update
**File**: `backend/template.yaml`

Added new API Gateway event:
```yaml
SearchLendersApi:
  Type: Api
  Properties:
    RestApiId: !Ref MarketplaceApi
    Path: /lenders/search
    Method: get
```

### 4. Bug Fix
Fixed method name from `scan_table()` to `scan_items()` to match the DynamoDB helper implementation.

## Frontend Changes

### 1. API Client
**File**: `lib/api-client.ts`

Added TypeScript interfaces:
```typescript
export interface Lender {
  lender_id: string
  name: string
  email: string
  stats: {
    investment_count: number
    total_invested: number
    average_investment: number
    average_apr: number
  }
  last_investment: {
    loan_name: string
    amount: number
    apr: number
    status: string
  }
}

export interface SearchLendersResponse {
  success: boolean
  data?: {
    lenders: Lender[]
    total_count: number
  }
}
```

Added API method:
```typescript
async searchLenders(query: string = ''): Promise<SearchLendersResponse> {
  const params = query ? `?q=${encodeURIComponent(query)}` : ''
  return this.request(`/lenders/search${params}`)
}
```

## Testing

### Test Script
**File**: `backend/scripts/test-lender-search.sh`

Comprehensive end-to-end test that:
1. Registers a borrower and two lenders
2. Creates a loan with both lenders
3. Lenders accept the loan
4. Tests search endpoint without query (returns all lenders)
5. Tests search endpoint with specific queries

### Test Results
- Successfully deployed to AWS
- Endpoint returns 200 OK
- Returns list of lenders with complete statistics
- Search filtering works correctly
- Found 24 existing lenders in the database

## API Response Example

```json
{
  "success": true,
  "data": {
    "lenders": [
      {
        "lender_id": "cadae66f-1ed0-4741-bb94-cd52526d4701",
        "name": "ddd",
        "email": "d@g.c",
        "stats": {
          "investment_count": 2,
          "total_invested": 109999.0,
          "average_investment": 54999.5,
          "average_apr": 18.05
        },
        "last_investment": {
          "loan_name": "Personal Loan",
          "amount": 50000.0,
          "apr": 7.2,
          "status": "ACTIVE"
        }
      }
    ],
    "total_count": 24
  }
}
```

## Usage

### From Frontend
```typescript
// Search all lenders
const allLenders = await apiClient.searchLenders()

// Search for specific lender
const results = await apiClient.searchLenders('john')
```

### From CLI
```bash
# Get all lenders
curl -X GET "https://API_URL/lenders/search" \
  -H "Authorization: Bearer $TOKEN"

# Search for specific lender
curl -X GET "https://API_URL/lenders/search?q=john" \
  -H "Authorization: Bearer $TOKEN"
```

## Security
- Endpoint requires authentication (JWT token)
- Only borrowers can access this endpoint
- Lenders with "pending:email" format are excluded from results
- Only lenders who have ACCEPTED loans are included

## Performance Considerations
- Uses DynamoDB scan operation (may need optimization for large datasets)
- Consider adding pagination for large result sets
- Consider caching frequently accessed lender lists
- Future enhancement: Add GSI for more efficient queries

## Next Steps
1. Integrate search UI in the loan creation flow
2. Add pagination support for large result sets
3. Add more filter options (investment range, APR range, etc.)
4. Add sorting options (by name, investment count, etc.)
5. Consider adding lender profiles with more details
