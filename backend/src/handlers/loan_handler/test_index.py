"""
Tests for loan handler functionality.
"""
import json
import pytest
import os
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

# Set up environment variables before importing
os.environ.setdefault('LOANS_TABLE', 'test-loans')
os.environ.setdefault('LOAN_PARTICIPANTS_TABLE', 'test-participants')
os.environ.setdefault('INVITATIONS_TABLE', 'test-invitations')
os.environ.setdefault('USERS_TABLE', 'test-users')
os.environ.setdefault('ACH_DETAILS_TABLE', 'test-ach-details')
os.environ.setdefault('JWT_SECRET', 'test-secret')
os.environ.setdefault('AWS_REGION', 'us-east-1')

# Import the handler
import sys
sys.path.append(os.path.join(os.path.dirname(__file__)))
from index import lambda_handler, create_lender_invitations, validate_loan_access, get_loan_participants, calculate_funding_progress

# Test constants
TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000"
TEST_LOAN_ID = "550e8400-e29b-41d4-a716-446655440001"
TEST_EMAIL = "test@example.com"
TEST_JWT_TOKEN = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test"


class TestLoanHandler:
    """Test cases for loan handler."""
    
    @pytest.fixture
    def mock_env_vars(self):
        """Mock environment variables."""
        with patch.dict(os.environ, {
            'LOANS_TABLE': 'test-loans',
            'LOAN_PARTICIPANTS_TABLE': 'test-participants',
            'INVITATIONS_TABLE': 'test-invitations',
            'USERS_TABLE': 'test-users',
            'JWT_SECRET': 'test-secret'
        }):
            yield
    
    @pytest.fixture
    def mock_authenticated_user(self):
        """Mock authenticated user."""
        with patch('index.JWTAuth.authenticate_user') as mock_auth:
            mock_user = MagicMock()
            mock_user.user_id = TEST_USER_ID
            mock_user.email = TEST_EMAIL
            mock_user.is_borrower = True
            mock_user.is_lender = False
            mock_auth.return_value = mock_user
            yield mock_user
    
    @pytest.fixture
    def mock_dynamodb(self):
        """Mock DynamoDB operations."""
        with patch('index.DynamoDBHelper') as mock_db:
            yield mock_db
    
    @pytest.fixture
    def sample_create_loan_event(self):
        """Sample event for creating a loan."""
        return {
            'httpMethod': 'POST',
            'path': '/loans',
            'headers': {
                'Authorization': TEST_JWT_TOKEN,
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'amount': 10000.0,
                'interest_rate': 5.5,
                'term': '12 months',
                'purpose': 'Business expansion',
                'description': 'Need funds to expand my business operations',
                'lenders': [
                    {
                        'email': 'lender1@example.com',
                        'contribution_amount': 5000.0
                    },
                    {
                        'email': 'lender2@example.com',
                        'contribution_amount': 5000.0
                    }
                ]
            })
        }
    
    @pytest.fixture
    def sample_get_loan_event(self):
        """Sample event for getting loan details."""
        return {
            'httpMethod': 'GET',
            'path': f'/loans/{TEST_LOAN_ID}',
            'headers': {
                'Authorization': TEST_JWT_TOKEN
            }
        }
    
    @pytest.fixture
    def sample_my_loans_event(self):
        """Sample event for getting user's loans."""
        return {
            'httpMethod': 'GET',
            'path': '/loans/my-loans',
            'headers': {
                'Authorization': TEST_JWT_TOKEN
            }
        }
    
    def test_cors_preflight(self, mock_env_vars):
        """Test CORS preflight request handling."""
        event = {
            'httpMethod': 'OPTIONS',
            'path': '/loans'
        }
        
        response = lambda_handler(event, MagicMock())
        
        assert response['statusCode'] == 200
        assert 'Access-Control-Allow-Origin' in response['headers']
    
    def test_create_loan_success(self, mock_env_vars, mock_authenticated_user, mock_dynamodb, sample_create_loan_event):
        """Test successful loan creation."""
        # Mock JWT auth
        with patch('index.JWTAuth.require_role'):
            # Mock UUID generation
            with patch('index.UUIDHelper.generate_uuid', return_value=TEST_LOAN_ID):
                # Mock datetime
                test_time = "2024-01-01T00:00:00+00:00"
                with patch('index.datetime') as mock_datetime:
                    mock_datetime.now.return_value.isoformat.return_value = test_time
                    mock_datetime.now.return_value = datetime.fromisoformat(test_time.replace('+00:00', '+00:00'))
                    
                    # Mock invitation creation
                    with patch('index.create_lender_invitations') as mock_invitations:
                        mock_invitations.return_value = {
                            'invitations_created': 1,
                            'participants_created': 2
                        }
                        
                        response = lambda_handler(sample_create_loan_event, MagicMock())
                        
                        assert response['statusCode'] == 201
                        body = json.loads(response['body'])
                        assert body['success'] is True
                        assert body['loan']['loan_id'] == TEST_LOAN_ID
                        assert body['loan']['amount'] == 10000.0
                        assert body['loan']['status'] == 'PENDING'
                        
                        # Verify loan was saved to database
                        mock_dynamodb.put_item.assert_called()
    
    def test_create_loan_validation_error(self, mock_env_vars, mock_authenticated_user, sample_create_loan_event):
        """Test loan creation with validation error."""
        # Mock JWT auth
        with patch('index.JWTAuth.require_role'):
            # Modify event to have invalid data
            invalid_event = sample_create_loan_event.copy()
            body_data = json.loads(invalid_event['body'])
            body_data['amount'] = -1000  # Invalid negative amount
            invalid_event['body'] = json.dumps(body_data)
            
            response = lambda_handler(invalid_event, MagicMock())
            
            assert response['statusCode'] == 400
            body = json.loads(response['body'])
            assert body['success'] is False
            assert body['error'] == 'VALIDATION_ERROR'
    
    def test_create_loan_unauthorized(self, mock_env_vars, sample_create_loan_event):
        """Test loan creation without authentication."""
        # Mock authentication failure
        with patch('index.JWTAuth.authenticate_user', side_effect=Exception("Authentication failed")):
            response = lambda_handler(sample_create_loan_event, MagicMock())
            
            assert response['statusCode'] == 401
            body = json.loads(response['body'])
            assert body['success'] is False
    
    def test_get_loan_details_success(self, mock_env_vars, mock_authenticated_user, mock_dynamodb, sample_get_loan_event):
        """Test successful loan details retrieval."""
        # Mock loan data
        mock_loan = {
            'loan_id': TEST_LOAN_ID,
            'borrower_id': TEST_USER_ID,
            'amount': 10000.0,
            'interest_rate': 5.5,
            'term': '12 months',
            'purpose': 'Business expansion',
            'description': 'Need funds to expand my business',
            'status': 'PENDING',
            'total_funded': 0.0,
            'created_at': '2024-01-01T00:00:00+00:00'
        }
        
        # Mock borrower data
        mock_borrower = {
            'user_id': TEST_USER_ID,
            'name': 'Test User',
            'email': TEST_EMAIL
        }
        
        mock_dynamodb.get_item.side_effect = [mock_loan, mock_borrower]
        
        # Mock access validation
        with patch('index.validate_loan_access', return_value=True):
            # Mock participants and funding progress
            with patch('index.get_loan_participants', return_value=[]):
                with patch('index.calculate_funding_progress', return_value={'funding_percentage': 0}):
                    response = lambda_handler(sample_get_loan_event, MagicMock())
                    
                    assert response['statusCode'] == 200
                    body = json.loads(response['body'])
                    assert body['success'] is True
                    assert body['data']['loan_id'] == TEST_LOAN_ID
                    assert body['data']['borrower_name'] == 'Test User'
    
    def test_get_loan_details_not_found(self, mock_env_vars, mock_authenticated_user, mock_dynamodb, sample_get_loan_event):
        """Test loan details retrieval for non-existent loan."""
        mock_dynamodb.get_item.return_value = None
        
        response = lambda_handler(sample_get_loan_event, MagicMock())
        
        assert response['statusCode'] == 404
        body = json.loads(response['body'])
        assert body['success'] is False
        assert body['error'] == 'NOT_FOUND'
    
    def test_get_loan_details_access_denied(self, mock_env_vars, mock_authenticated_user, mock_dynamodb, sample_get_loan_event):
        """Test loan details retrieval with access denied."""
        # Mock loan data
        mock_loan = {
            'loan_id': TEST_LOAN_ID,
            'borrower_id': 'other-user-id',
            'amount': 10000.0
        }
        
        mock_dynamodb.get_item.return_value = mock_loan
        
        # Mock access validation failure
        with patch('index.validate_loan_access', return_value=False):
            response = lambda_handler(sample_get_loan_event, MagicMock())
            
            assert response['statusCode'] == 403
            body = json.loads(response['body'])
            assert body['success'] is False
            assert body['error'] == 'FORBIDDEN'
    
    def test_get_my_loans_success(self, mock_env_vars, mock_authenticated_user, mock_dynamodb, sample_my_loans_event):
        """Test successful retrieval of user's loans."""
        # Mock JWT auth
        with patch('index.JWTAuth.require_role'):
            # Mock loans data
            mock_loans = [
                {
                    'loan_id': 'loan-1',
                    'amount': 10000.0,
                    'interest_rate': 5.5,
                    'term': '12 months',
                    'purpose': 'Business',
                    'description': 'Business loan',
                    'status': 'PENDING',
                    'total_funded': 0.0,
                    'created_at': '2024-01-01T00:00:00+00:00'
                },
                {
                    'loan_id': 'loan-2',
                    'amount': 5000.0,
                    'interest_rate': 4.5,
                    'term': '6 months',
                    'purpose': 'Personal',
                    'description': 'Personal loan',
                    'status': 'ACTIVE',
                    'total_funded': 5000.0,
                    'created_at': '2024-01-02T00:00:00+00:00'
                }
            ]
            
            mock_dynamodb.query_items.return_value = mock_loans
            
            # Mock participants and funding progress
            with patch('index.get_loan_participants', return_value=[]):
                with patch('index.calculate_funding_progress', return_value={'funding_percentage': 0}):
                    response = lambda_handler(sample_my_loans_event, MagicMock())
                    
                    assert response['statusCode'] == 200
                    body = json.loads(response['body'])
                    assert body['success'] is True
                    assert body['data']['total_count'] == 2
                    assert len(body['data']['loans']) == 2
    
    def test_invalid_endpoint(self, mock_env_vars):
        """Test invalid endpoint handling."""
        event = {
            'httpMethod': 'GET',
            'path': '/invalid-endpoint'
        }
        
        response = lambda_handler(event, MagicMock())
        
        assert response['statusCode'] == 404
        body = json.loads(response['body'])
        assert body['error'] == 'NOT_FOUND'


class TestHelperFunctions:
    """Test cases for helper functions."""
    
    def test_create_lender_invitations_existing_users(self):
        """Test creating invitations for existing users."""
        with patch('index.DynamoDBHelper') as mock_db:
            # Mock existing user
            mock_db.query_items.return_value = [{'user_id': 'user-123', 'email': 'test@example.com'}]
            
            lenders = [
                MagicMock(email='test@example.com', contribution_amount=5000.0)
            ]
            
            result = create_lender_invitations('loan-123', 'borrower-123', lenders, '2024-01-01T00:00:00+00:00')
            
            assert result['invitations_created'] == 0
            assert result['participants_created'] == 1
            mock_db.put_item.assert_called()
    
    def test_create_lender_invitations_new_users(self):
        """Test creating invitations for new users."""
        with patch('index.DynamoDBHelper') as mock_db:
            # Mock no existing users
            mock_db.query_items.return_value = []
            
            with patch('index.UUIDHelper.generate_uuid', return_value='invitation-123'):
                lenders = [
                    MagicMock(email='new@example.com', contribution_amount=5000.0)
                ]
                
                result = create_lender_invitations('loan-123', 'borrower-123', lenders, '2024-01-01T00:00:00+00:00')
                
                assert result['invitations_created'] == 1
                assert result['participants_created'] == 1
                # Should be called twice: once for invitation, once for participant
                assert mock_db.put_item.call_count == 2
    
    def test_validate_loan_access_borrower(self):
        """Test loan access validation for borrower."""
        result = validate_loan_access('loan-123', 'user-123', 'user-123')
        assert result is True
    
    def test_validate_loan_access_invited_lender(self):
        """Test loan access validation for invited lender."""
        with patch('index.DynamoDBHelper') as mock_db:
            mock_db.query_items.return_value = [
                {'loan_id': 'loan-123', 'lender_id': 'user-456'}
            ]
            
            result = validate_loan_access('loan-123', 'user-456', 'user-123')
            assert result is True
    
    def test_validate_loan_access_denied(self):
        """Test loan access validation denial."""
        with patch('index.DynamoDBHelper') as mock_db:
            mock_db.query_items.return_value = []
            
            result = validate_loan_access('loan-123', 'user-789', 'user-123')
            assert result is False
    
    def test_get_loan_participants_with_users(self):
        """Test getting loan participants with user information."""
        with patch('index.DynamoDBHelper') as mock_db:
            # Mock participants
            mock_db.query_items.return_value = [
                {
                    'loan_id': 'loan-123',
                    'lender_id': 'user-456',
                    'contribution_amount': 5000.0,
                    'status': 'PENDING',
                    'invited_at': '2024-01-01T00:00:00+00:00'
                }
            ]
            
            # Mock user data
            mock_db.get_item.return_value = {
                'user_id': 'user-456',
                'name': 'Test Lender',
                'email': 'lender@example.com'
            }
            
            result = get_loan_participants('loan-123')
            
            assert len(result) == 1
            assert result[0]['lender_name'] == 'Test Lender'
            assert result[0]['lender_email'] == 'lender@example.com'
    
    def test_get_loan_participants_pending_invitations(self):
        """Test getting loan participants with pending invitations."""
        with patch('index.DynamoDBHelper') as mock_db:
            # Mock participants with pending invitation
            mock_db.query_items.return_value = [
                {
                    'loan_id': 'loan-123',
                    'lender_id': 'pending:newuser@example.com',
                    'contribution_amount': 5000.0,
                    'status': 'PENDING',
                    'invited_at': '2024-01-01T00:00:00+00:00'
                }
            ]
            
            result = get_loan_participants('loan-123')
            
            assert len(result) == 1
            assert result[0]['lender_name'] == 'Pending: newuser@example.com'
            assert result[0]['lender_email'] == 'newuser@example.com'
    
    def test_calculate_funding_progress(self):
        """Test funding progress calculation."""
        participants = [
            {'status': 'ACCEPTED', 'contribution_amount': 3000.0},
            {'status': 'PENDING', 'contribution_amount': 2000.0},
            {'status': 'PENDING', 'contribution_amount': 5000.0}
        ]
        
        result = calculate_funding_progress(10000.0, 3000.0, participants)
        
        assert result['total_amount'] == 10000.0
        assert result['total_funded'] == 3000.0
        assert result['remaining_amount'] == 7000.0
        assert result['funding_percentage'] == 30.0
        assert result['total_participants'] == 3
        assert result['accepted_participants'] == 1
        assert result['pending_participants'] == 2
        assert result['pending_amount'] == 7000.0
        assert result['is_fully_funded'] is False
    
    def test_calculate_funding_progress_fully_funded(self):
        """Test funding progress calculation when fully funded."""
        participants = [
            {'status': 'ACCEPTED', 'contribution_amount': 10000.0}
        ]
        
        result = calculate_funding_progress(10000.0, 10000.0, participants)
        
        assert result['funding_percentage'] == 100.0
        assert result['is_fully_funded'] is True


if __name__ == '__main__':
    pytest.main([__file__])