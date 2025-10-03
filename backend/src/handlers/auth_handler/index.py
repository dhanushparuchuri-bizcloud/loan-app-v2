"""
Authentication handler for user registration and login.
Handles POST /auth/register and POST /auth/login endpoints.
Updated with loan participant permissions.
"""
import json
import logging
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

# Import shared utilities
from shared.dynamodb_client import DynamoDBHelper, TABLE_NAMES
from shared.jwt_auth import JWTAuth
from shared.password_helper import PasswordHelper
from shared.uuid_helper import UUIDHelper
from shared.validation_schemas import RegisterUserRequest, LoginUserRequest, ValidationHelper
from shared.response_helper import ResponseHelper
# Constants to avoid import conflicts with Python's built-in types module
class UserStatus:
    ACTIVE = 'ACTIVE'
    INACTIVE = 'INACTIVE'

class UserType:
    BORROWER_ONLY = 'BORROWER_ONLY'
    ACTIVE_LENDER = 'ACTIVE_LENDER'

class InvitationStatus:
    PENDING = 'PENDING'
    ACTIVATED = 'ACTIVATED'

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for authentication endpoints.
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    # Set Lambda context to not wait for empty event loop
    context.callbackWaitsForEmptyEventLoop = False
    
    try:
        logger.info(f"Auth handler invoked: {event.get('httpMethod')} {event.get('path')}")
        
        # Validate required environment variables
        required_env_vars = ['USERS_TABLE', 'INVITATIONS_TABLE', 'JWT_SECRET']
        for var in required_env_vars:
            if not os.environ.get(var):
                logger.error(f"Missing required environment variable: {var}")
                return ResponseHelper.internal_error_response(f"Configuration error: missing {var}")
        
        # Handle CORS preflight requests
        if event.get('httpMethod') == 'OPTIONS':
            return ResponseHelper.create_response(200, {'message': 'CORS preflight'})
        
        # Route to appropriate handler based on path
        path = event.get('path', '')
        method = event.get('httpMethod', '')
        
        if path.endswith('/register') and method == 'POST':
            return handle_register(event)
        
        if path.endswith('/login') and method == 'POST':
            return handle_login(event)
        
        return ResponseHelper.not_found_response('Endpoint not found')
        
    except Exception as e:
        logger.error(f"Auth handler error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def handle_register(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle user registration with automatic lender activation.
    
    Args:
        event: API Gateway event
        
    Returns:
        API Gateway response
    """
    try:
        # Parse and validate request body
        body = json.loads(event.get('body', '{}'))
        request_data = ValidationHelper.validate_request_body(RegisterUserRequest, body)
        
        logger.info(f"Registration attempt for email: {request_data.email}")
        
        # Check if user already exists
        existing_users = DynamoDBHelper.query_items(
            TABLE_NAMES['USERS'],
            'email = :email',
            {':email': request_data.email},
            'EmailIndex'
        )
        
        if existing_users:
            logger.info(f"Registration failed - user exists: {request_data.email}")
            return ResponseHelper.error_response(409, 'USER_EXISTS', 'User with this email already exists')
        
        # Check for pending invitations to determine lender status
        pending_invitations = check_pending_invitations(request_data.email)
        has_invitations = len(pending_invitations) > 0
        
        logger.info(f"Found {len(pending_invitations)} pending invitations for {request_data.email}")
        
        # Hash password
        password_hash = PasswordHelper.hash_password(request_data.password)
        
        # Create user record
        user_id = UUIDHelper.generate_uuid()
        now = datetime.now(timezone.utc).isoformat()
        
        new_user = {
            'user_id': user_id,
            'email': request_data.email,
            'name': ValidationHelper.sanitize_string(request_data.name),
            'password_hash': password_hash,
            'is_borrower': True,  # All users start as borrowers
            'is_lender': has_invitations,  # Auto-activate lender if invitations exist
            'user_type': UserType.ACTIVE_LENDER if has_invitations else UserType.BORROWER_ONLY,
            'created_at': now,
            'status': UserStatus.ACTIVE
        }
        
        # Save user to database
        DynamoDBHelper.put_item(TABLE_NAMES['USERS'], new_user)
        
        # If user has invitations, mark them as activated and update participant records
        if has_invitations:
            activate_invitations(pending_invitations, now)
            update_participant_records(request_data.email, user_id, now)
            logger.info(f"Activated {len(pending_invitations)} invitations for {request_data.email}")
        
        # Generate JWT token
        token = JWTAuth.generate_token(
            user_id=user_id,
            email=request_data.email,
            is_borrower=new_user['is_borrower'],
            is_lender=new_user['is_lender']
        )
        
        # Prepare response (exclude password hash)
        user_response = {
            'user_id': new_user['user_id'],
            'email': new_user['email'],
            'name': new_user['name'],
            'is_borrower': new_user['is_borrower'],
            'is_lender': new_user['is_lender'],
            'user_type': new_user['user_type'],
            'created_at': new_user['created_at'],
            'status': new_user['status']
        }
        
        auth_response = {
            'success': True,
            'token': token,
            'user': user_response
        }
        
        logger.info(f"Registration successful for {request_data.email}, lender status: {new_user['is_lender']}")
        return ResponseHelper.create_response(201, auth_response)
        
    except ValueError as e:
        logger.error(f"Registration validation error: {str(e)}")
        return ResponseHelper.validation_error_response(str(e))
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def handle_login(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle user login with invitation checking.
    
    Args:
        event: API Gateway event
        
    Returns:
        API Gateway response
    """
    try:
        # Parse and validate request body
        body = json.loads(event.get('body', '{}'))
        request_data = ValidationHelper.validate_request_body(LoginUserRequest, body)
        
        logger.info(f"Login attempt for email: {request_data.email}")
        
        # Find user by email
        users = DynamoDBHelper.query_items(
            TABLE_NAMES['USERS'],
            'email = :email',
            {':email': request_data.email},
            'EmailIndex'
        )
        
        if not users:
            logger.info(f"Login failed - user not found: {request_data.email}")
            return ResponseHelper.error_response(401, 'INVALID_CREDENTIALS', 'Invalid credentials')
        
        user = users[0]
        
        # Verify password
        is_valid_password = PasswordHelper.verify_password(request_data.password, user['password_hash'])
        if not is_valid_password:
            logger.info(f"Login failed - invalid password: {request_data.email}")
            return ResponseHelper.error_response(401, 'INVALID_CREDENTIALS', 'Invalid credentials')
        
        # Check for new pending invitations and update lender status if needed
        pending_invitations = check_pending_invitations(request_data.email)
        updated_user = user
        
        if pending_invitations and not user['is_lender']:
            logger.info(f"Found new invitations for existing user: {request_data.email}")
            
            # Update user to lender status
            now = datetime.now(timezone.utc).isoformat()
            updated_user = DynamoDBHelper.update_item(
                TABLE_NAMES['USERS'],
                {'user_id': user['user_id']},
                'SET is_lender = :is_lender, user_type = :user_type',
                {
                    ':is_lender': True,
                    ':user_type': UserType.ACTIVE_LENDER
                }
            )
            
            # Activate the invitations and update participant records
            activate_invitations(pending_invitations, now)
            update_participant_records(request_data.email, user['user_id'], now)
            logger.info(f"Updated user to lender and activated {len(pending_invitations)} invitations")
        
        # Generate JWT token
        token = JWTAuth.generate_token(
            user_id=updated_user['user_id'],
            email=updated_user['email'],
            is_borrower=updated_user['is_borrower'],
            is_lender=updated_user['is_lender']
        )
        
        # Prepare response (exclude password hash)
        user_response = {
            'user_id': updated_user['user_id'],
            'email': updated_user['email'],
            'name': updated_user['name'],
            'is_borrower': updated_user['is_borrower'],
            'is_lender': updated_user['is_lender'],
            'user_type': updated_user['user_type'],
            'created_at': updated_user['created_at'],
            'status': updated_user['status']
        }
        
        auth_response = {
            'success': True,
            'token': token,
            'user': user_response
        }
        
        logger.info(f"Login successful for {request_data.email}")
        return ResponseHelper.success_response(auth_response)
        
    except ValueError as e:
        logger.error(f"Login validation error: {str(e)}")
        return ResponseHelper.validation_error_response(str(e))
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def check_pending_invitations(email: str) -> List[Dict[str, Any]]:
    """
    Check for pending invitations for an email address.
    
    Args:
        email: Email address to check
        
    Returns:
        List of pending invitation records
    """
    try:
        # Query by email only, then filter by status in application
        all_invitations = DynamoDBHelper.query_items(
            TABLE_NAMES['INVITATIONS'],
            'invitee_email = :email',
            {':email': email},
            'EmailIndex'
        )
        
        # Filter for pending invitations
        pending_invitations = [
            inv for inv in all_invitations 
            if inv.get('status') == InvitationStatus.PENDING
        ]
        
        return pending_invitations
    except Exception as e:
        logger.error(f"Error checking invitations: {str(e)}")
        # Don't fail the registration/login if invitation check fails
        return []


def activate_invitations(invitations: List[Dict[str, Any]], activated_at: str) -> None:
    """
    Mark invitations as activated.
    
    Args:
        invitations: List of invitation records to activate
        activated_at: Timestamp when invitations were activated
    """
    try:
        # Update each invitation to ACTIVATED status
        for invitation in invitations:
            DynamoDBHelper.update_item(
                TABLE_NAMES['INVITATIONS'],
                {'invitation_id': invitation['invitation_id']},
                'SET #status = :status, activated_at = :activated_at',
                {
                    ':status': InvitationStatus.ACTIVATED,
                    ':activated_at': activated_at
                },
                {
                    '#status': 'status'  # Use expression attribute name for reserved word
                }
            )
    except Exception as e:
        logger.error(f"Error activating invitations: {str(e)}")
        # Don't fail the registration/login if invitation activation fails
        # This will be handled by eventual consistency


def update_participant_records(email: str, user_id: str, updated_at: str) -> None:
    """
    Update participant records from pending:email to actual user_id.
    
    Args:
        email: Email address of the user
        user_id: Actual user ID to update to
        updated_at: Timestamp when records were updated
    """
    try:
        # Find all participant records with pending lender_id for this email
        pending_lender_id = f"pending:{email}"
        
        # Scan for participant records with this pending lender_id
        # Note: This is not the most efficient approach, but it's simple and works for MVP
        all_participants = DynamoDBHelper.scan_items(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            filter_expression='lender_id = :pending_lender_id',
            expression_attribute_values={':pending_lender_id': pending_lender_id}
        )
        
        logger.info(f"Found {len(all_participants)} participant records to update for {email}")
        
        # Update each participant record
        for participant in all_participants:
            loan_id = participant['loan_id']
            
            # Delete the old record with pending lender_id
            DynamoDBHelper.delete_item(
                TABLE_NAMES['LOAN_PARTICIPANTS'],
                {'loan_id': loan_id, 'lender_id': pending_lender_id}
            )
            
            # Create new record with actual user_id
            updated_participant = {
                'loan_id': loan_id,
                'lender_id': user_id,
                'contribution_amount': participant['contribution_amount'],
                'status': participant['status'],
                'invited_at': participant['invited_at'],
                'updated_at': updated_at
            }
            
            DynamoDBHelper.put_item(TABLE_NAMES['LOAN_PARTICIPANTS'], updated_participant)
            logger.info(f"Updated participant record for loan {loan_id}: {pending_lender_id} -> {user_id}")
            
    except Exception as e:
        logger.error(f"Error updating participant records: {str(e)}")
        # Don't fail the registration if participant update fails
        # This will be handled by eventual consistency