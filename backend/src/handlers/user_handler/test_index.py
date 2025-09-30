"""
Tests for user handler.
"""
import pytest
import json
import os
from unittest.mock import patch, MagicMock
from decimal import Decimal

# Set up environment variables for testing
os.environ['USERS_TABLE'] = 'test-users'
os.environ['LOANS_TABLE'] = 'test-loans'
os.environ['LOAN_PARTICIPANTS_TABLE'] = 'test-loan-participants'
os.environ['INVITATIONS_TABLE'] = 'test-invitations'
os.environ['ACH_DETAILS_TABLE'] = 'test-ach-details'
os.environ['JWT_SECRET'] = 'test-secret'

import sys
import os
sys.path.append(os.path.dirname(__file__))
from index import lambda_handler, UserService


class TestUserService:
    """Test cases for UserService class."""
    
    @patch('index.DynamoDBHelper.get_item')
    def test_get_user_profile_success(self, mock_get_item):
        """Test successful user profile retrieval."""
        # Mock user data
        mock_user_data = {
            'user_id': 'user-123',
            'email': 'test@example.com',
            'name': 'Test User',
            'is_borrower': True,
            'is_lender': False,
            'created_at': '2024-01-01T00:00:00Z',
            'status': 'ACTIVE',
            'password_hash': 'hashed_password'  # Should be excluded from profile
        }
        mock_get_item.return_value = mock_user_data
        
        profile = UserService.get_user_profile('user-123')
        
        assert profile is not None
        assert profile['user_id'] == 'user-123'
        assert profile['email'] == 'test@example.com'
        assert profile['name'] == 'Test User'
        assert profile['is_borrower'] is True
        assert profile['is_lender'] is False
        assert profile['created_at'] == '2024-01-01T00:00:00Z'
        assert profile['status'] == 'ACTIVE'
        
        mock_get_item.assert_called_once_with('test-users', {'user_id': 'user-123'})
    
    @patch('index.DynamoDBHelper.get_item')
    def test_get_user_profile_not_found(self, mock_get_item):
        """Test user profile not found."""
        mock_get_item.return_value = None
        
        profile = UserService.get_user_profile('nonexistent-user')
        
        assert profile is None
        mock_get_item.assert_called_once_with('test-users', {'user_id': 'nonexistent-user'})
    
    @patch('index.DynamoDBHelper.query_items')
    def test_calculate_borrower_stats(self, mock_query_items):
        """Test borrower statistics calculation."""
        # Mock loans data
        mock_loans = [
            {
                'loan_id': 'loan-1',
                'status': 'ACTIVE',
                'amount': 10000.0,
                'interest_rate': 5.5
            },
            {
                'loan_id': 'loan-2',
                'status': 'ACTIVE',
                'amount': 15000.0,
                'interest_rate': 6.0
            },
            {
                'loan_id': 'loan-3',
                'status': 'PENDING',
                'amount': 8000.0,
                'interest_rate': 4.5
            }
        ]
        mock_query_items.return_value = mock_loans
        
        stats = UserService.calculate_borrower_stats('user-123')
        
        assert stats['active_loans'] == 2
        assert stats['total_borrowed'] == 25000.0
        assert stats['pending_requests'] == 1
        assert stats['average_interest_rate'] == 5.75  # (5.5 + 6.0) / 2
        
        mock_query_items.assert_called_once_with(
            'test-loans',
            'borrower_id = :borrower_id',
            {':borrower_id': 'user-123'},
            index_name='borrower-loans-index'
        )
    
    @patch('index.DynamoDBHelper.get_item')
    @patch('index.DynamoDBHelper.query_items')
    def test_calculate_lender_stats(self, mock_query_items, mock_get_item):
        """Test lender statistics calculation."""
        # Mock participations data
        mock_participations = [
            {
                'loan_id': 'loan-1',
                'lender_id': 'user-123',
                'status': 'ACCEPTED',
                'contribution_amount': 5000.0
            },
            {
                'loan_id': 'loan-2',
                'lender_id': 'user-123',
                'status': 'PENDING',
                'contribution_amount': 3000.0
            },
            {
                'loan_id': 'loan-3',
                'lender_id': 'user-123',
                'status': 'ACCEPTED',
                'contribution_amount': 7000.0
            }
        ]
        mock_query_items.return_value = mock_participations
        
        # Mock loan data for returns calculation
        def mock_get_loan(table_name, key):
            loan_id = key['loan_id']
            if loan_id == 'loan-1':
                return {
                    'loan_id': 'loan-1',
                    'status': 'ACTIVE',
                    'interest_rate': 5.0
                }
            elif loan_id == 'loan-3':
                return {
                    'loan_id': 'loan-3',
                    'status': 'ACTIVE',
                    'interest_rate': 6.0
                }
            return None
        
        mock_get_item.side_effect = mock_get_loan
        
        stats = UserService.calculate_lender_stats('user-123')
        
        assert stats['pending_invitations'] == 1
        assert stats['active_investments'] == 2
        assert stats['total_lent'] == 12000.0
        assert stats['expected_returns'] == 670.0  # (5000 * 0.05) + (7000 * 0.06)
        
        mock_query_items.assert_called_once_with(
            'test-loan-participants',
            'lender_id = :lender_id',
            {':lender_id': 'user-123'},
            index_name='lender-status-index'
        )
    
    @patch('index.UserService.calculate_borrower_stats')
    @patch('index.UserService.calculate_lender_stats')
    def test_get_dashboard_stats_dual_role(self, mock_lender_stats, mock_borrower_stats):
        """Test dashboard stats for dual-role user."""

        
        mock_borrower_stats.return_value = {
            'active_loans': 2,
            'total_borrowed': 25000.0,
            'pending_requests': 1,
            'average_interest_rate': 5.75
        }
        
        mock_lender_stats.return_value = {
            'pending_invitations': 3,
            'active_investments': 2,
            'total_lent': 12000.0,
            'expected_returns': 670.0
        }
        
        stats = UserService.get_dashboard_stats('user-123', True, True)
        
        assert stats['borrower'] is not None
        assert stats['lender'] is not None
        assert stats['borrower']['active_loans'] == 2
        assert stats['lender']['pending_invitations'] == 3
        
        mock_borrower_stats.assert_called_once_with('user-123')
        mock_lender_stats.assert_called_once_with('user-123')
    
    @patch('index.UserService.calculate_borrower_stats')
    def test_get_dashboard_stats_borrower_only(self, mock_borrower_stats):
        """Test dashboard stats for borrower-only user."""
        
        mock_borrower_stats.return_value = {
            'active_loans': 1,
            'total_borrowed': 10000.0,
            'pending_requests': 0,
            'average_interest_rate': 5.5
        }
        
        stats = UserService.get_dashboard_stats('user-123', True, False)
        
        assert stats['borrower'] is not None
        assert stats['lender'] is None
        
        mock_borrower_stats.assert_called_once_with('user-123')


class TestLambdaHandler:
    """Test cases for Lambda handler."""
    
    @patch('index.JWTAuth.authenticate_user')
    @patch('index.UserService.get_user_profile')
    def test_get_profile_success(self, mock_get_profile, mock_auth):
        """Test successful profile retrieval."""
        from jwt_auth import AuthenticatedUser

        
        # Mock authentication
        mock_user = AuthenticatedUser('user-123', 'test@example.com', True, False)
        mock_auth.return_value = mock_user
        
        # Mock profile data
        mock_profile = {
            'user_id': 'user-123',
            'email': 'test@example.com',
            'name': 'Test User',
            'is_borrower': True,
            'is_lender': False,
            'created_at': '2024-01-01T00:00:00Z',
            'status': 'ACTIVE'
        }
        mock_get_profile.return_value = mock_profile
        
        event = {
            'path': '/user/profile',
            'httpMethod': 'GET',
            'headers': {'Authorization': 'Bearer valid-token'}
        }
        
        response = lambda_handler(event, {})
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['success'] is True
        assert body['data']['user_id'] == 'user-123'
        assert body['data']['email'] == 'test@example.com'
        assert 'password_hash' not in body['data']  # Ensure sensitive data is excluded
    
    @patch('index.JWTAuth.authenticate_user')
    @patch('index.UserService.get_user_profile')
    def test_get_profile_not_found(self, mock_get_profile, mock_auth):
        """Test profile not found."""
        from jwt_auth import AuthenticatedUser
        
        mock_user = AuthenticatedUser('user-123', 'test@example.com', True, False)
        mock_auth.return_value = mock_user
        mock_get_profile.return_value = None
        
        event = {
            'path': '/user/profile',
            'httpMethod': 'GET',
            'headers': {'Authorization': 'Bearer valid-token'}
        }
        
        response = lambda_handler(event, {})
        
        assert response['statusCode'] == 404
        body = json.loads(response['body'])
        assert body['error'] == 'USER_NOT_FOUND'
    
    @patch('index.JWTAuth.authenticate_user')
    @patch('index.UserService.get_dashboard_stats')
    def test_get_dashboard_success(self, mock_get_stats, mock_auth):
        """Test successful dashboard retrieval."""
        from jwt_auth import AuthenticatedUser

        
        mock_user = AuthenticatedUser('user-123', 'test@example.com', True, True)
        mock_auth.return_value = mock_user
        
        mock_stats = {
            'borrower': {
                'active_loans': 2,
                'total_borrowed': 25000.0,
                'pending_requests': 1,
                'average_interest_rate': 5.75
            },
            'lender': {
                'pending_invitations': 3,
                'active_investments': 2,
                'total_lent': 12000.0,
                'expected_returns': 670.0
            }
        }
        mock_get_stats.return_value = mock_stats
        
        event = {
            'path': '/user/dashboard',
            'httpMethod': 'GET',
            'headers': {'Authorization': 'Bearer valid-token'}
        }
        
        response = lambda_handler(event, {})
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['success'] is True
        assert 'borrower' in body['data']
        assert 'lender' in body['data']
        assert body['data']['borrower']['active_loans'] == 2
        assert body['data']['lender']['pending_invitations'] == 3
    
    def test_cors_preflight(self):
        """Test CORS preflight request."""
        event = {
            'path': '/user/profile',
            'httpMethod': 'OPTIONS'
        }
        
        response = lambda_handler(event, {})
        
        assert response['statusCode'] == 200
        assert 'Access-Control-Allow-Origin' in response['headers']
    
    def test_invalid_endpoint(self):
        """Test invalid endpoint."""
        event = {
            'path': '/user/invalid',
            'httpMethod': 'GET'
        }
        
        response = lambda_handler(event, {})
        
        assert response['statusCode'] == 404
        body = json.loads(response['body'])
        assert body['error'] == 'NOT_FOUND'
    
    def test_authentication_failure(self):
        """Test authentication failure."""
        event = {
            'path': '/user/profile',
            'httpMethod': 'GET',
            'headers': {}  # No authorization header
        }
        
        response = lambda_handler(event, {})
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert body['error'] == 'UNAUTHORIZED'


if __name__ == '__main__':
    pytest.main([__file__])