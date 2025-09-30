"""
Tests for validation schemas and helper functions.
"""
import pytest
from shared.validation_schemas import (
    RegisterUserRequest,
    LoginUserRequest,
    CreateLoanRequest,
    LenderInviteRequest,
    AcceptLoanRequest,
    ValidationHelper
)


class TestValidationSchemas:
    """Test cases for validation schemas."""
    
    def test_register_user_request_valid(self):
        """Test valid user registration request."""
        data = {
            'name': 'John Doe',
            'email': 'john@example.com',
            'password': 'Password123'
        }
        
        request = RegisterUserRequest(**data)
        
        assert request.name == 'John Doe'
        assert request.email == 'john@example.com'
        assert request.password == 'Password123'
    
    def test_register_user_request_invalid_password(self):
        """Test user registration with invalid password."""
        data = {
            'name': 'John Doe',
            'email': 'john@example.com',
            'password': 'weak'  # Too short, no uppercase, no number
        }
        
        with pytest.raises(ValueError):
            RegisterUserRequest(**data)
    
    def test_login_user_request_valid(self):
        """Test valid user login request."""
        data = {
            'email': 'john@example.com',
            'password': 'password123'
        }
        
        request = LoginUserRequest(**data)
        
        assert request.email == 'john@example.com'
        assert request.password == 'password123'
    
    def test_create_loan_request_valid(self):
        """Test valid loan creation request."""
        data = {
            'amount': 10000.0,
            'interest_rate': 5.5,
            'term': '12 months',
            'purpose': 'Business expansion',
            'description': 'Need funds to expand my business operations',
            'lenders': [
                {'email': 'lender1@example.com', 'contribution_amount': 5000.0},
                {'email': 'lender2@example.com', 'contribution_amount': 5000.0}
            ]
        }
        
        request = CreateLoanRequest(**data)
        
        assert request.amount == 10000.0
        assert len(request.lenders) == 2
    
    def test_create_loan_request_invalid_contributions(self):
        """Test loan creation with invalid contribution amounts."""
        data = {
            'amount': 10000.0,
            'interest_rate': 5.5,
            'term': '12 months',
            'purpose': 'Business expansion',
            'description': 'Need funds to expand my business operations',
            'lenders': [
                {'email': 'lender1@example.com', 'contribution_amount': 3000.0},
                {'email': 'lender2@example.com', 'contribution_amount': 5000.0}  # Total: 8000, not 10000
            ]
        }
        
        with pytest.raises(ValueError, match="Total contributions"):
            CreateLoanRequest(**data)
    
    def test_accept_loan_request_valid(self):
        """Test valid loan acceptance request."""
        data = {
            'bank_name': 'Test Bank',
            'account_type': 'checking',
            'routing_number': '123456789',
            'account_number': '9876543210',
            'special_instructions': 'Please process quickly'
        }
        
        request = AcceptLoanRequest(**data)
        
        assert request.bank_name == 'Test Bank'
        assert request.account_type == 'checking'
        assert request.routing_number == '123456789'
    
    def test_accept_loan_request_invalid_routing_number(self):
        """Test loan acceptance with invalid routing number."""
        data = {
            'bank_name': 'Test Bank',
            'account_type': 'checking',
            'routing_number': '12345',  # Too short
            'account_number': '9876543210'
        }
        
        with pytest.raises(ValueError):
            AcceptLoanRequest(**data)


class TestValidationHelper:
    """Test cases for ValidationHelper class."""
    
    def test_validate_path_param_success(self):
        """Test successful path parameter validation."""
        result = ValidationHelper.validate_path_param('test-value', 'test_param')
        assert result == 'test-value'
    
    def test_validate_path_param_missing(self):
        """Test path parameter validation with missing value."""
        with pytest.raises(ValueError, match="Missing required parameter: test_param"):
            ValidationHelper.validate_path_param(None, 'test_param')
    
    def test_validate_uuid_param_valid(self):
        """Test valid UUID parameter validation."""
        uuid_str = '123e4567-e89b-12d3-a456-426614174000'
        result = ValidationHelper.validate_uuid_param(uuid_str, 'loan_id')
        assert result == uuid_str
    
    def test_validate_uuid_param_invalid(self):
        """Test invalid UUID parameter validation."""
        with pytest.raises(ValueError, match="Invalid loan_id: must be a valid UUID"):
            ValidationHelper.validate_uuid_param('invalid-uuid', 'loan_id')
    
    def test_sanitize_string(self):
        """Test string sanitization."""
        dirty_string = '<script>alert("xss")</script>Test\'s "string"'
        clean_string = ValidationHelper.sanitize_string(dirty_string)
        
        assert '<' not in clean_string
        assert '>' not in clean_string
        assert '"' not in clean_string
        assert "'" not in clean_string
    
    def test_validate_email_format_valid(self):
        """Test valid email format validation."""
        email = ValidationHelper.validate_email_format('Test@Example.COM')
        assert email == 'test@example.com'
    
    def test_validate_email_format_invalid(self):
        """Test invalid email format validation."""
        with pytest.raises(ValueError, match="Invalid email format"):
            ValidationHelper.validate_email_format('invalid-email')
    
    def test_validate_loan_contributions_valid(self):
        """Test valid loan contributions validation."""
        contributions = [
            {'contribution_amount': 5000.0},
            {'contribution_amount': 3000.0},
            {'contribution_amount': 2000.0}
        ]
        
        # Should not raise exception
        ValidationHelper.validate_loan_contributions(10000.0, contributions)
    
    def test_validate_loan_contributions_invalid(self):
        """Test invalid loan contributions validation."""
        contributions = [
            {'contribution_amount': 5000.0},
            {'contribution_amount': 3000.0}  # Total: 8000, not 10000
        ]
        
        with pytest.raises(ValueError, match="Total contributions"):
            ValidationHelper.validate_loan_contributions(10000.0, contributions)