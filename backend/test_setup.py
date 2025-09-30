#!/usr/bin/env python3
"""
Test script to verify the Python backend setup is working correctly.
"""
import sys
import os
sys.path.append('src')

def test_imports():
    """Test that all required modules can be imported."""
    try:
        import boto3
        import jwt
        import bcrypt
        import pydantic
        
        # Set required environment variables for DynamoDB client
        os.environ.setdefault('USERS_TABLE', 'test-users')
        os.environ.setdefault('LOANS_TABLE', 'test-loans')
        os.environ.setdefault('LOAN_PARTICIPANTS_TABLE', 'test-loan-participants')
        os.environ.setdefault('INVITATIONS_TABLE', 'test-invitations')
        os.environ.setdefault('ACH_DETAILS_TABLE', 'test-ach-details')
        os.environ.setdefault('JWT_SECRET', 'test-secret-key')
        
        from shared.dynamodb_client import DynamoDBHelper
        from shared.jwt_auth import JWTAuth
        from shared.password_helper import PasswordHelper
        from shared.uuid_helper import UUIDHelper
        from shared.date_helper import DateHelper
        from shared.validation_schemas import ValidationHelper
        from shared.response_helper import ResponseHelper
        print("✅ All imports successful")
        return True
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return False

def test_utilities():
    """Test that shared utilities work correctly."""
    try:
        # Test password helper
        from shared.password_helper import PasswordHelper
        password = 'TestPassword123'
        hashed = PasswordHelper.hash_password(password)
        verified = PasswordHelper.verify_password(password, hashed)
        assert verified, "Password verification failed"
        
        # Test UUID helper
        from shared.uuid_helper import UUIDHelper
        uuid_str = UUIDHelper.generate_uuid()
        is_valid = UUIDHelper.is_valid_uuid(uuid_str)
        assert is_valid, "UUID validation failed"
        
        # Test date helper
        from shared.date_helper import DateHelper
        timestamp = DateHelper.get_current_timestamp()
        assert len(timestamp) > 0, "Timestamp generation failed"
        
        # Test JWT auth (requires JWT_SECRET environment variable)
        os.environ['JWT_SECRET'] = 'test-secret-key'
        from shared.jwt_auth import JWTAuth
        token = JWTAuth.generate_token('user-123', 'test@example.com', True, False)
        payload = JWTAuth.verify_token(token)
        assert payload.user_id == 'user-123', "JWT verification failed"
        
        print("✅ All utilities working correctly")
        return True
    except Exception as e:
        print(f"❌ Utility test failed: {e}")
        return False

def test_validation():
    """Test validation schemas."""
    try:
        from shared.validation_schemas import RegisterUserRequest, ValidationHelper
        
        # Test valid registration request
        data = {
            'name': 'John Doe',
            'email': 'john@example.com',
            'password': 'Password123'
        }
        request = RegisterUserRequest(**data)
        assert request.name == 'John Doe', "Validation failed"
        
        # Test email validation
        email = ValidationHelper.validate_email_format('Test@Gmail.COM')
        assert email == 'test@gmail.com', "Email normalization failed"
        
        print("✅ Validation schemas working correctly")
        return True
    except Exception as e:
        print(f"❌ Validation test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🧪 Testing Python backend setup...")
    print()
    
    tests = [
        ("Import Tests", test_imports),
        ("Utility Tests", test_utilities),
        ("Validation Tests", test_validation)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"Running {test_name}...")
        if test_func():
            passed += 1
        print()
    
    print(f"📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Python backend setup is ready.")
        return 0
    else:
        print("❌ Some tests failed. Please check the setup.")
        return 1

if __name__ == '__main__':
    sys.exit(main())