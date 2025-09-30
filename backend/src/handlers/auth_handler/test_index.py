"""
Tests for the authentication handler.
"""
import json
import os
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

# Set up test environment variables
os.environ['USERS_TABLE'] = 'test-users'
os.environ['LOANS_TABLE'] = 'test-loans'
os.environ['LOAN_PARTICIPANTS_TABLE'] = 'test-loan-participants'
os.environ['INVITATIONS_TABLE'] = 'test-invitations'
os.environ['ACH_DETAILS_TABLE'] = 'test-ach-details'
os.environ['JWT_SECRET'] = 'test-secret'
os.environ['AWS_REGION'] = 'us-east-1'

# Import the handler after setting environment variables
import sys
sys.path.append(os.path.join(os.path.dirname(__file__)))
from index import lambda_handler, handle_register, handle_login, check_pending_invitations, activate_invitations


class TestAuthHandler:
    """Test cases for authentication handler."""
    
    def test_cors_preflight_request(self):
        """Test CORS preflight request handling."""
        event = {
            'httpMethod': 'OPTIONS',
            'path': '/auth/register'
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 200
        assert 'Access-Control-Allow-Origin' in response['headers']
    
    def test_invalid_endpoint(self):
        """Test invalid endpoint returns 404."""
        event = {
            'httpMethod': 'GET',
            'path': '/auth/invalid'
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 404
        body = json.loads(response['body'])
        assert body['error'] == 'NOT_FOUND'
    
    @patch('index.DynamoDBHelper')
    @patch('index.PasswordHelper')
    @patch('index.JWTAuth')
    @patch('index.UUIDHelper')
    def test_register_new_user_success(self, mock_uuid, mock_jwt, mock_password, mock_db):
        """Test successful user registration without invitations."""
        # Mock dependencies
        mock_uuid.generate_uuid.return_value = 'test-user-id'
        mock_password.hash_password.return_value = 'hashed-password'
        mock_jwt.generate_token.return_value = 'test-token'
        mock_db.query_items.side_effect = [[], []]  # No existing user, no invitations
        mock_db.put_item.return_value = None
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps({
                'name': 'Test User',
                'email': 'test@example.com',
                'password': 'TestPass123'
            })
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 201
        body = json.loads(response['body'])
        assert body['success'] is True
        assert body['token'] == 'test-token'
        assert body['user']['email'] == 'test@example.com'
        assert body['user']['is_borrower'] is True
        assert body['user']['is_lender'] is False
    
    @patch('index.DynamoDBHelper')
    @patch('index.PasswordHelper')
    @patch('index.JWTAuth')
    @patch('index.UUIDHelper')
    def test_register_with_pending_invitations(self, mock_uuid, mock_jwt, mock_password, mock_db):
        """Test user registration with pending invitations activates lender status."""
        # Mock dependencies
        mock_uuid.generate_uuid.return_value = 'test-user-id'
        mock_password.hash_password.return_value = 'hashed-password'
        mock_jwt.generate_token.return_value = 'test-token'
        
        # Mock existing user check (no user) and pending invitations (has invitations)
        mock_db.query_items.side_effect = [
            [],  # No existing user
            [{'invitation_id': 'inv-1', 'invitee_email': 'test@example.com'}]  # Has invitations
        ]
        mock_db.put_item.return_value = None
        mock_db.update_item.return_value = None
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps({
                'name': 'Test User',
                'email': 'test@example.com',
                'password': 'TestPass123'
            })
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 201
        body = json.loads(response['body'])
        assert body['success'] is True
        assert body['user']['is_lender'] is True  # Should be activated due to invitations
        assert body['user']['user_type'] == 'ACTIVE_LENDER'
    
    @patch('index.DynamoDBHelper')
    def test_register_existing_user_conflict(self, mock_db):
        """Test registration with existing user returns conflict error."""
        # Mock existing user found
        mock_db.query_items.return_value = [{'user_id': 'existing-user'}]
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps({
                'name': 'Test User',
                'email': 'test@example.com',
                'password': 'TestPass123'
            })
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 409
        body = json.loads(response['body'])
        assert body['error'] == 'USER_EXISTS'
    
    def test_register_invalid_request_body(self):
        """Test registration with invalid request body returns validation error."""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps({
                'name': '',  # Invalid: empty name
                'email': 'invalid-email',  # Invalid: bad email format
                'password': '123'  # Invalid: too short
            })
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert body['error'] == 'VALIDATION_ERROR'
    
    @patch('index.DynamoDBHelper')
    @patch('index.PasswordHelper')
    @patch('index.JWTAuth')
    def test_login_success(self, mock_jwt, mock_password, mock_db):
        """Test successful user login."""
        # Mock dependencies
        mock_password.verify_password.return_value = True
        mock_jwt.generate_token.return_value = 'test-token'
        
        # Mock user found and no new invitations
        mock_db.query_items.side_effect = [
            [{  # User found
                'user_id': 'test-user-id',
                'email': 'test@example.com',
                'name': 'Test User',
                'password_hash': 'hashed-password',
                'is_borrower': True,
                'is_lender': False,
                'user_type': 'BORROWER_ONLY',
                'created_at': '2023-01-01T00:00:00',
                'status': 'ACTIVE'
            }],
            []  # No new invitations
        ]
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'email': 'test@example.com',
                'password': 'TestPass123'
            })
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['data']['success'] is True
        assert body['data']['token'] == 'test-token'
        assert body['data']['user']['email'] == 'test@example.com'
    
    @patch('index.DynamoDBHelper')
    def test_login_user_not_found(self, mock_db):
        """Test login with non-existent user returns authentication error."""
        # Mock no user found
        mock_db.query_items.return_value = []
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'email': 'nonexistent@example.com',
                'password': 'TestPass123'
            })
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert body['error'] == 'INVALID_CREDENTIALS'
    
    @patch('index.DynamoDBHelper')
    @patch('index.PasswordHelper')
    def test_login_invalid_password(self, mock_password, mock_db):
        """Test login with invalid password returns authentication error."""
        # Mock user found but password verification fails
        mock_password.verify_password.return_value = False
        mock_db.query_items.return_value = [{
            'user_id': 'test-user-id',
            'email': 'test@example.com',
            'password_hash': 'hashed-password'
        }]
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'email': 'test@example.com',
                'password': 'WrongPassword'
            })
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert body['error'] == 'INVALID_CREDENTIALS'
    
    @patch('index.DynamoDBHelper')
    @patch('index.PasswordHelper')
    @patch('index.JWTAuth')
    def test_login_with_new_invitations_updates_lender_status(self, mock_jwt, mock_password, mock_db):
        """Test login with new invitations updates user to lender status."""
        # Mock dependencies
        mock_password.verify_password.return_value = True
        mock_jwt.generate_token.return_value = 'test-token'
        
        # Mock user found (not lender) and has new invitations
        mock_db.query_items.side_effect = [
            [{  # User found (borrower only)
                'user_id': 'test-user-id',
                'email': 'test@example.com',
                'name': 'Test User',
                'password_hash': 'hashed-password',
                'is_borrower': True,
                'is_lender': False,
                'user_type': 'BORROWER_ONLY',
                'created_at': '2023-01-01T00:00:00',
                'status': 'ACTIVE'
            }],
            [{'invitation_id': 'inv-1'}]  # Has new invitations
        ]
        
        # Mock update user to lender
        mock_db.update_item.return_value = {
            'user_id': 'test-user-id',
            'email': 'test@example.com',
            'name': 'Test User',
            'is_borrower': True,
            'is_lender': True,
            'user_type': 'ACTIVE_LENDER',
            'created_at': '2023-01-01T00:00:00',
            'status': 'ACTIVE'
        }
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'email': 'test@example.com',
                'password': 'TestPass123'
            })
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['data']['user']['is_lender'] is True
        assert body['data']['user']['user_type'] == 'ACTIVE_LENDER'
    
    def test_login_invalid_request_body(self):
        """Test login with invalid request body returns validation error."""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'email': 'invalid-email',  # Invalid email format
                'password': ''  # Empty password
            })
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert body['error'] == 'VALIDATION_ERROR'
    
    @patch('index.DynamoDBHelper')
    def test_check_pending_invitations_success(self, mock_db):
        """Test checking pending invitations returns correct results."""
        mock_db.query_items.return_value = [
            {'invitation_id': 'inv-1', 'invitee_email': 'test@example.com'},
            {'invitation_id': 'inv-2', 'invitee_email': 'test@example.com'}
        ]
        
        invitations = check_pending_invitations('test@example.com')
        
        assert len(invitations) == 2
        assert invitations[0]['invitation_id'] == 'inv-1'
    
    @patch('index.DynamoDBHelper')
    def test_check_pending_invitations_error_handling(self, mock_db):
        """Test checking pending invitations handles errors gracefully."""
        mock_db.query_items.side_effect = Exception('Database error')
        
        invitations = check_pending_invitations('test@example.com')
        
        assert invitations == []  # Should return empty list on error
    
    @patch('index.DynamoDBHelper')
    def test_activate_invitations_success(self, mock_db):
        """Test activating invitations updates records correctly."""
        invitations = [
            {'invitation_id': 'inv-1'},
            {'invitation_id': 'inv-2'}
        ]
        
        activate_invitations(invitations, '2023-01-01T00:00:00')
        
        # Should call update_item for each invitation
        assert mock_db.update_item.call_count == 2
    
    @patch('index.DynamoDBHelper')
    def test_activate_invitations_error_handling(self, mock_db):
        """Test activating invitations handles errors gracefully."""
        mock_db.update_item.side_effect = Exception('Database error')
        invitations = [{'invitation_id': 'inv-1'}]
        
        # Should not raise exception
        activate_invitations(invitations, '2023-01-01T00:00:00')


if __name__ == '__main__':
    pytest.main([__file__])