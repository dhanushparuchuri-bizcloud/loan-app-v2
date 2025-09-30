"""
Unit tests for lender handler.
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
import os

# Set up environment variables before importing
os.environ.update({
    'USERS_TABLE': 'test-users',
    'LOANS_TABLE': 'test-loans',
    'LOAN_PARTICIPANTS_TABLE': 'test-participants',
    'INVITATIONS_TABLE': 'test-invitations',
    'ACH_DETAILS_TABLE': 'test-ach',
    'JWT_SECRET': 'test-secret'
})

# Import the handler
import sys
sys.path.append(os.path.dirname(__file__))
from index import lambda_handler, handle_get_pending_invitations, handle_accept_loan, validate_loan_invitation, accept_loan_atomic


class TestLenderHandler:
    """Test cases for lender handler."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.mock_user = MagicMock()
        self.mock_user.user_id = 'lender-123'
        self.mock_user.email = 'lender@example.com'
        self.mock_user.is_lender = True
        self.mock_user.is_borrower = False
        
        self.sample_loan = {
            'loan_id': 'loan-123',
            'borrower_id': 'borrower-123',
            'amount': 10000.0,
            'interest_rate': 5.5,
            'term': '12 months',
            'purpose': 'Business expansion',
            'description': 'Need funds for inventory',
            'status': 'PENDING',
            'total_funded': 0.0,
            'created_at': '2024-01-01T00:00:00Z'
        }
        
        self.sample_participant = {
            'loan_id': 'loan-123',
            'lender_id': 'lender-123',
            'contribution_amount': 5000.0,
            'status': 'PENDING',
            'invited_at': '2024-01-01T00:00:00Z'
        }
        
        self.sample_borrower = {
            'user_id': 'borrower-123',
            'name': 'John Borrower',
            'email': 'borrower@example.com'
        }
    
    @patch.dict('os.environ', {
        'LOAN_PARTICIPANTS_TABLE': 'test-participants',
        'LOANS_TABLE': 'test-loans',
        'ACH_DETAILS_TABLE': 'test-ach',
        'USERS_TABLE': 'test-users'
    })
    def test_lambda_handler_cors_preflight(self):
        """Test CORS preflight handling."""
        event = {
            'httpMethod': 'OPTIONS',
            'path': '/lender/pending'
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 200
        assert 'Access-Control-Allow-Origin' in response['headers']
    
    @patch.dict('os.environ', {
        'LOAN_PARTICIPANTS_TABLE': 'test-participants',
        'LOANS_TABLE': 'test-loans',
        'ACH_DETAILS_TABLE': 'test-ach',
        'USERS_TABLE': 'test-users'
    })
    def test_lambda_handler_invalid_endpoint(self):
        """Test invalid endpoint handling."""
        event = {
            'httpMethod': 'GET',
            'path': '/lender/invalid'
        }
        context = MagicMock()
        
        response = lambda_handler(event, context)
        
        assert response['statusCode'] == 404
        body = json.loads(response['body'])
        assert body['error'] == 'NOT_FOUND'
    
    @patch('index.JWTAuth.authenticate_user')
    @patch('index.JWTAuth.require_role')
    @patch('index.DynamoDBHelper.query_items')
    @patch('index.DynamoDBHelper.get_item')
    @patch.dict('os.environ', {
        'LOAN_PARTICIPANTS_TABLE': 'test-participants',
        'LOANS_TABLE': 'test-loans',
        'ACH_DETAILS_TABLE': 'test-ach',
        'USERS_TABLE': 'test-users'
    })
    def test_get_pending_invitations_success(self, mock_get_item, mock_query_items, mock_require_role, mock_authenticate):
        """Test successful retrieval of pending invitations."""
        # Setup mocks
        mock_authenticate.return_value = self.mock_user
        mock_require_role.return_value = None
        mock_query_items.return_value = [self.sample_participant]
        
        # Mock loan and borrower lookups
        def mock_get_item_side_effect(table_name, key):
            if 'loans' in table_name and key.get('loan_id') == 'loan-123':
                return self.sample_loan
            elif 'users' in table_name and key.get('user_id') == 'borrower-123':
                return self.sample_borrower
            return None
        
        mock_get_item.side_effect = mock_get_item_side_effect
        
        event = {
            'httpMethod': 'GET',
            'path': '/lender/pending',
            'headers': {'Authorization': 'Bearer valid-token'}
        }
        
        response = handle_get_pending_invitations(event)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['success'] is True
        assert len(body['data']['invitations']) == 1
        
        invitation = body['data']['invitations'][0]
        assert invitation['loan_id'] == 'loan-123'
        assert invitation['borrower_name'] == 'John Borrower'
        assert invitation['contribution_amount'] == 5000.0
    
    @patch('index.JWTAuth.authenticate_user')
    @patch('index.JWTAuth.require_role')
    @patch('index.DynamoDBHelper.query_items')
    @patch.dict('os.environ', {
        'LOAN_PARTICIPANTS_TABLE': 'test-participants',
        'LOANS_TABLE': 'test-loans',
        'ACH_DETAILS_TABLE': 'test-ach',
        'USERS_TABLE': 'test-users'
    })
    def test_get_pending_invitations_empty(self, mock_query_items, mock_require_role, mock_authenticate):
        """Test retrieval when no pending invitations exist."""
        # Setup mocks
        mock_authenticate.return_value = self.mock_user
        mock_require_role.return_value = None
        mock_query_items.return_value = []
        
        event = {
            'httpMethod': 'GET',
            'path': '/lender/pending',
            'headers': {'Authorization': 'Bearer valid-token'}
        }
        
        response = handle_get_pending_invitations(event)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['success'] is True
        assert len(body['data']['invitations']) == 0
        assert body['data']['total_count'] == 0
    
    @patch('index.JWTAuth.authenticate_user')
    @patch('index.JWTAuth.require_role')
    @patch('index.ValidationHelper.validate_uuid_param')
    @patch('index.ValidationHelper.validate_request_body')
    @patch('index.validate_loan_invitation')
    @patch('index.DynamoDBHelper.get_item')
    @patch('index.accept_loan_atomic')
    @patch.dict('os.environ', {
        'LOAN_PARTICIPANTS_TABLE': 'test-participants',
        'LOANS_TABLE': 'test-loans',
        'ACH_DETAILS_TABLE': 'test-ach',
        'USERS_TABLE': 'test-users'
    })
    def test_accept_loan_success(self, mock_atomic, mock_get_item, mock_validate_invitation, 
                                mock_validate_body, mock_validate_uuid, mock_require_role, mock_authenticate):
        """Test successful loan acceptance."""
        # Setup mocks
        mock_authenticate.return_value = self.mock_user
        mock_require_role.return_value = None
        mock_validate_uuid.return_value = 'loan-123'
        
        mock_ach_request = MagicMock()
        mock_ach_request.bank_name = 'Test Bank'
        mock_ach_request.account_type = 'checking'
        mock_ach_request.routing_number = '123456789'
        mock_ach_request.account_number = '987654321'
        mock_ach_request.special_instructions = None
        mock_validate_body.return_value = mock_ach_request
        
        mock_validate_invitation.return_value = self.sample_participant
        mock_get_item.return_value = self.sample_loan
        mock_atomic.return_value = {
            'success': True,
            'loan_status': 'PENDING',
            'accepted_at': '2024-01-01T12:00:00Z'
        }
        
        event = {
            'httpMethod': 'PUT',
            'path': '/lender/accept/loan-123',
            'headers': {'Authorization': 'Bearer valid-token'},
            'body': json.dumps({
                'bank_name': 'Test Bank',
                'account_type': 'checking',
                'routing_number': '123456789',
                'account_number': '987654321'
            })
        }
        
        response = handle_accept_loan(event)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['success'] is True
        assert body['data']['loan_id'] == 'loan-123'
        assert body['data']['status'] == 'ACCEPTED'
    
    @patch('index.JWTAuth.authenticate_user')
    @patch('index.JWTAuth.require_role')
    @patch('index.ValidationHelper.validate_uuid_param')
    @patch('index.validate_loan_invitation')
    @patch.dict('os.environ', {
        'LOAN_PARTICIPANTS_TABLE': 'test-participants',
        'LOANS_TABLE': 'test-loans',
        'ACH_DETAILS_TABLE': 'test-ach',
        'USERS_TABLE': 'test-users'
    })
    def test_accept_loan_invitation_not_found(self, mock_validate_invitation, mock_validate_uuid, 
                                            mock_require_role, mock_authenticate):
        """Test loan acceptance when invitation not found."""
        # Setup mocks
        mock_authenticate.return_value = self.mock_user
        mock_require_role.return_value = None
        mock_validate_uuid.return_value = 'loan-123'
        mock_validate_invitation.return_value = None
        
        event = {
            'httpMethod': 'PUT',
            'path': '/lender/accept/loan-123',
            'headers': {'Authorization': 'Bearer valid-token'},
            'body': json.dumps({
                'bank_name': 'Test Bank',
                'account_type': 'checking',
                'routing_number': '123456789',
                'account_number': '987654321'
            })
        }
        
        response = handle_accept_loan(event)
        
        assert response['statusCode'] == 404
        body = json.loads(response['body'])
        assert body['error'] == 'NOT_FOUND'
    
    @patch('index.DynamoDBHelper.get_item')
    def test_validate_loan_invitation_success(self, mock_get_item):
        """Test successful loan invitation validation."""
        mock_get_item.return_value = self.sample_participant
        
        result = validate_loan_invitation('loan-123', 'lender-123')
        
        assert result is not None
        assert result['loan_id'] == 'loan-123'
        assert result['status'] == 'PENDING'
    
    @patch('index.DynamoDBHelper.get_item')
    def test_validate_loan_invitation_not_found(self, mock_get_item):
        """Test loan invitation validation when not found."""
        mock_get_item.return_value = None
        
        result = validate_loan_invitation('loan-123', 'lender-123')
        
        assert result is None
    
    @patch('index.DynamoDBHelper.get_item')
    def test_validate_loan_invitation_already_accepted(self, mock_get_item):
        """Test loan invitation validation when already accepted."""
        accepted_participant = self.sample_participant.copy()
        accepted_participant['status'] = 'ACCEPTED'
        mock_get_item.return_value = accepted_participant
        
        result = validate_loan_invitation('loan-123', 'lender-123')
        
        assert result is None
    
    @patch('index.DynamoDBHelper.update_item')
    @patch('index.DynamoDBHelper.put_item')
    def test_accept_loan_atomic_success(self, mock_put_item, mock_update_item):
        """Test successful atomic loan acceptance."""
        mock_update_item.return_value = {}
        mock_put_item.return_value = None
        
        mock_ach_request = MagicMock()
        mock_ach_request.bank_name = 'Test Bank'
        mock_ach_request.account_type = 'checking'
        mock_ach_request.routing_number = '123456789'
        mock_ach_request.account_number = '987654321'
        mock_ach_request.special_instructions = None
        
        result = accept_loan_atomic(
            'loan-123',
            'lender-123',
            self.sample_participant,
            self.sample_loan,
            mock_ach_request
        )
        
        assert result['success'] is True
        assert result['loan_status'] == 'PENDING'  # Not fully funded yet
        assert 'accepted_at' in result
        
        # Verify database calls
        assert mock_update_item.call_count == 2  # Participant and loan updates
        assert mock_put_item.call_count == 1     # ACH details
    
    @patch('index.DynamoDBHelper.update_item')
    @patch('index.DynamoDBHelper.put_item')
    def test_accept_loan_atomic_fully_funded(self, mock_put_item, mock_update_item):
        """Test atomic loan acceptance that fully funds the loan."""
        mock_update_item.return_value = {}
        mock_put_item.return_value = None
        
        # Create a loan that will be fully funded
        fully_funded_loan = self.sample_loan.copy()
        fully_funded_loan['total_funded'] = 5000.0  # Already half funded
        
        participant_full_amount = self.sample_participant.copy()
        participant_full_amount['contribution_amount'] = 5000.0  # This will complete funding
        
        mock_ach_request = MagicMock()
        mock_ach_request.bank_name = 'Test Bank'
        mock_ach_request.account_type = 'checking'
        mock_ach_request.routing_number = '123456789'
        mock_ach_request.account_number = '987654321'
        mock_ach_request.special_instructions = None
        
        result = accept_loan_atomic(
            'loan-123',
            'lender-123',
            participant_full_amount,
            fully_funded_loan,
            mock_ach_request
        )
        
        assert result['success'] is True
        assert result['loan_status'] == 'ACTIVE'  # Should be fully funded now
        assert result['new_total_funded'] == 10000.0
    
    @patch('index.DynamoDBHelper.update_item')
    def test_accept_loan_atomic_failure(self, mock_update_item):
        """Test atomic loan acceptance failure."""
        mock_update_item.side_effect = Exception("Database error")
        
        mock_ach_request = MagicMock()
        mock_ach_request.bank_name = 'Test Bank'
        mock_ach_request.account_type = 'checking'
        mock_ach_request.routing_number = '123456789'
        mock_ach_request.account_number = '987654321'
        mock_ach_request.special_instructions = None
        
        result = accept_loan_atomic(
            'loan-123',
            'lender-123',
            self.sample_participant,
            self.sample_loan,
            mock_ach_request
        )
        
        assert result['success'] is False
        assert 'error' in result
        assert 'Database error' in result['error']


if __name__ == '__main__':
    pytest.main([__file__])