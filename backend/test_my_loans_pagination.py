#!/usr/bin/env python3
"""
Test script for GET /loans/my-loans API with pagination support.
Tests the new batch enrichment and pagination features.
"""
import requests
import json
import sys

# API Configuration
API_BASE_URL = "https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"

def test_my_loans_pagination(auth_token):
    """Test GET /loans/my-loans with pagination parameters."""

    print("\n" + "="*80)
    print("TEST 1: Get my loans with default pagination (limit=20)")
    print("="*80)

    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }

    # Test 1: Default pagination
    response = requests.get(
        f"{API_BASE_URL}/loans/my-loans",
        headers=headers
    )

    print(f"\nStatus Code: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ Success!")
        print(f"   - Loans returned: {data['data']['count']}")
        print(f"   - Has more: {data['data']['has_more']}")
        print(f"   - Next token: {'YES' if data['data'].get('next_token') else 'NO'}")

        if data['data']['loans']:
            print(f"\n   First loan:")
            first_loan = data['data']['loans'][0]
            print(f"   - Loan ID: {first_loan['loan_id']}")
            print(f"   - Loan Name: {first_loan['loan_name']}")
            print(f"   - Amount: ${first_loan['amount']:,.2f}")
            print(f"   - Participants: {first_loan['participant_count']}")
    else:
        print(f"\n❌ Failed!")
        print(f"   Response: {response.text}")
        return False

    # Test 2: Custom limit
    print("\n" + "="*80)
    print("TEST 2: Get my loans with custom limit (limit=5)")
    print("="*80)

    response = requests.get(
        f"{API_BASE_URL}/loans/my-loans?limit=5",
        headers=headers
    )

    print(f"\nStatus Code: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ Success!")
        print(f"   - Loans returned: {data['data']['count']}")
        print(f"   - Has more: {data['data']['has_more']}")

        # Test 3: Pagination with next_token
        if data['data'].get('next_token'):
            print("\n" + "="*80)
            print("TEST 3: Get next page using next_token")
            print("="*80)

            next_token = data['data']['next_token']
            response = requests.get(
                f"{API_BASE_URL}/loans/my-loans?limit=5&next_token={next_token}",
                headers=headers
            )

            print(f"\nStatus Code: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                print(f"\n✅ Success!")
                print(f"   - Loans returned: {data['data']['count']}")
                print(f"   - Has more: {data['data']['has_more']}")
            else:
                print(f"\n❌ Failed!")
                print(f"   Response: {response.text}")
        else:
            print("\n   ℹ️  No more pages available (less than 5 loans total)")
    else:
        print(f"\n❌ Failed!")
        print(f"   Response: {response.text}")
        return False

    # Test 4: Invalid limit
    print("\n" + "="*80)
    print("TEST 4: Test validation - invalid limit (limit=150)")
    print("="*80)

    response = requests.get(
        f"{API_BASE_URL}/loans/my-loans?limit=150",
        headers=headers
    )

    print(f"\nStatus Code: {response.status_code}")

    if response.status_code == 400:
        print(f"\n✅ Validation working correctly!")
        print(f"   Response: {response.json()['message']}")
    else:
        print(f"\n⚠️  Expected 400 status code for invalid limit")
        print(f"   Response: {response.text}")

    # Test 5: Invalid pagination token
    print("\n" + "="*80)
    print("TEST 5: Test validation - invalid pagination token")
    print("="*80)

    response = requests.get(
        f"{API_BASE_URL}/loans/my-loans?next_token=invalid_token_xyz",
        headers=headers
    )

    print(f"\nStatus Code: {response.status_code}")

    if response.status_code == 400:
        print(f"\n✅ Validation working correctly!")
        print(f"   Response: {response.json()['message']}")
    else:
        print(f"\n⚠️  Expected 400 status code for invalid token")
        print(f"   Response: {response.text}")

    print("\n" + "="*80)
    print("ALL TESTS COMPLETED")
    print("="*80)
    return True


def main():
    """Main test execution."""
    print("\n" + "="*80)
    print("GET /loans/my-loans PAGINATION TEST")
    print("="*80)

    # Check if token provided
    if len(sys.argv) < 2:
        print("\n❌ Error: JWT token required")
        print("\nUsage:")
        print(f"  python3 {sys.argv[0]} <JWT_TOKEN>")
        print("\nExample:")
        print(f"  python3 {sys.argv[0]} eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
        sys.exit(1)

    auth_token = sys.argv[1]

    try:
        success = test_my_loans_pagination(auth_token)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
