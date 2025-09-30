"""
Tests for JWT authentication utilities.
"""
import pytest
import os
from unittest.mock import patch
from shared.jwt_auth import JWTAuth, JWTPayload, AuthenticatedUser


class TestJWTAuth:
    """Test cases for JWTAuth class."""
    
    def setup_method(self):
        """Set up test environment."""
        os.environ['JWT_SECRET'] = 'test-secret-key'
    
    def test_generate_token_success(self):
        """Test successful token generation."""
        token = JWTAuth.generate_token(
            user_id='user-123',
            email='test@example.com',
            is_borrower=True,
            is_lender=False
        )
        
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_verify_token_success(self):
        """Test successful token verification."""
        # Generate token
        token = JWTAuth.generate_token(
            user_id='user-123',
            email='test@example.com',
            is_borrower=True,
            is_lender=False
        )
        
        # Verify token
        payload = JWTAuth.verify_token(token)
        
        assert payload.user_id == 'user-123'
        assert payload.email == 'test@example.com'
        assert payload.is_borrower is True
        assert payload.is_lender is False
    
    def test_verify_invalid_token(self):
        """Test verification of invalid token."""
        with pytest.raises(Exception, match="Invalid token"):
            JWTAuth.verify_token('invalid-token')
    
    def test_extract_token_from_header_success(self):
        """Test successful token extraction from header."""
        auth_header = 'Bearer test-token-123'
        token = JWTAuth.extract_token_from_header(auth_header)
        
        assert token == 'test-token-123'
    
    def test_extract_token_missing_header(self):
        """Test token extraction with missing header."""
        with pytest.raises(Exception, match="Authorization header missing"):
            JWTAuth.extract_token_from_header(None)
    
    def test_extract_token_invalid_format(self):
        """Test token extraction with invalid header format."""
        with pytest.raises(Exception, match="Invalid authorization header format"):
            JWTAuth.extract_token_from_header('InvalidFormat token')
    
    def test_authenticate_user_success(self):
        """Test successful user authentication."""
        # Generate token
        token = JWTAuth.generate_token(
            user_id='user-123',
            email='test@example.com',
            is_borrower=True,
            is_lender=True
        )
        
        # Mock event
        event = {
            'headers': {
                'Authorization': f'Bearer {token}'
            }
        }
        
        user = JWTAuth.authenticate_user(event)
        
        assert user.user_id == 'user-123'
        assert user.email == 'test@example.com'
        assert user.is_borrower is True
        assert user.is_lender is True
    
    def test_require_role_success(self):
        """Test successful role requirement check."""
        user = AuthenticatedUser(
            user_id='user-123',
            email='test@example.com',
            is_borrower=True,
            is_lender=False
        )
        
        # Should not raise exception
        JWTAuth.require_role(user, 'borrower')
    
    def test_require_role_insufficient_permissions(self):
        """Test role requirement with insufficient permissions."""
        user = AuthenticatedUser(
            user_id='user-123',
            email='test@example.com',
            is_borrower=True,
            is_lender=False
        )
        
        with pytest.raises(Exception, match="Insufficient permissions: lender role required"):
            JWTAuth.require_role(user, 'lender')
    
    def test_create_response(self):
        """Test response creation."""
        response = JWTAuth.create_response(200, {'message': 'success'})
        
        assert response['statusCode'] == 200
        assert 'Content-Type' in response['headers']
        assert 'Access-Control-Allow-Origin' in response['headers']
        assert '"message": "success"' in response['body']