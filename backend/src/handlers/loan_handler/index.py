"""
Loan handler for loan management operations.
Handles POST /loans, GET /loans/{id}, and GET /loans/my-loans endpoints.
"""
import json
import logging
import os
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from decimal import Decimal

# Import shared utilities
from shared.dynamodb_client import DynamoDBHelper, TABLE_NAMES
from shared.jwt_auth import JWTAuth, AuthenticatedUser
from shared.uuid_helper import UUIDHelper
from shared.validation_schemas import CreateLoanRequest, ValidationHelper
from shared.response_helper import ResponseHelper

# Constants to avoid import conflicts
class LoanStatus:
    PENDING = 'PENDING'
    ACTIVE = 'ACTIVE'
    COMPLETED = 'COMPLETED'

class ParticipantStatus:
    PENDING = 'PENDING'
    ACCEPTED = 'ACCEPTED'
    DECLINED = 'DECLINED'

class InvitationStatus:
    PENDING = 'PENDING'
    ACTIVATED = 'ACTIVATED'

class UserType:
    BORROWER_ONLY = 'BORROWER_ONLY'
    ACTIVE_LENDER = 'ACTIVE_LENDER'

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for loan endpoints.
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    # Set Lambda context to not wait for empty event loop
    context.callbackWaitsForEmptyEventLoop = False
    
    try:
        logger.info(f"Loan handler invoked: {event.get('httpMethod')} {event.get('path')}")
        
        # Validate required environment variables
        required_env_vars = ['LOANS_TABLE', 'LOAN_PARTICIPANTS_TABLE', 'INVITATIONS_TABLE', 'USERS_TABLE']
        for var in required_env_vars:
            if not os.environ.get(var):
                logger.error(f"Missing required environment variable: {var}")
                return ResponseHelper.internal_error_response(f"Configuration error: missing {var}")
        
        # Handle CORS preflight requests
        if event.get('httpMethod') == 'OPTIONS':
            return ResponseHelper.create_response(200, {'message': 'CORS preflight'})
        
        # Route to appropriate handler based on path and method
        path = event.get('path', '')
        method = event.get('httpMethod', '')
        
        # POST /loans - Create new loan
        if path.endswith('/loans') and method == 'POST':
            return handle_create_loan(event)
        
        # GET /loans/my-loans - Get borrower's loans (check this first to avoid UUID validation)
        if path.endswith('/loans/my-loans') and method == 'GET':
            return handle_get_my_loans(event)
        
        # GET /loans/{id} - Get loan details
        if re.match(r'.*/loans/[^/]+$', path) and method == 'GET':
            return handle_get_loan_details(event)
        
        return ResponseHelper.not_found_response('Endpoint not found')
        
    except Exception as e:
        logger.error(f"Loan handler error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def handle_create_loan(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle loan creation with lender invitations.
    
    Args:
        event: API Gateway event
        
    Returns:
        API Gateway response
    """
    try:
        # Authenticate user and require borrower role
        user = JWTAuth.authenticate_user(event)
        JWTAuth.require_role(user, 'borrower')
        
        # Parse and validate request body
        body = json.loads(event.get('body', '{}'))
        request_data = ValidationHelper.validate_request_body(CreateLoanRequest, body)
        
        logger.info(f"Creating loan for borrower: {user.user_id}, amount: {request_data.amount}")
        
        # Generate loan ID and timestamp
        loan_id = UUIDHelper.generate_uuid()
        now = datetime.now(timezone.utc).isoformat()
        
        # Create loan record
        loan = {
            'loan_id': loan_id,
            'borrower_id': user.user_id,
            'amount': Decimal(str(request_data.amount)),
            'interest_rate': Decimal(str(request_data.interest_rate)),
            'term': ValidationHelper.sanitize_string(request_data.term),
            'purpose': ValidationHelper.sanitize_string(request_data.purpose),
            'description': ValidationHelper.sanitize_string(request_data.description),
            'status': LoanStatus.PENDING,
            'total_funded': Decimal('0'),
            'created_at': now
        }
        
        # Save loan to database
        DynamoDBHelper.put_item(TABLE_NAMES['LOANS'], loan)
        logger.info(f"Created loan record: {loan_id}")
        
        # Process lender invitations
        invitation_results = create_lender_invitations(loan_id, user.user_id, request_data.lenders, now)
        
        # Prepare response with loan details and invitation results
        response_data = {
            'loan_id': loan_id,
            'borrower_id': user.user_id,
            'amount': request_data.amount,
            'interest_rate': request_data.interest_rate,
            'term': request_data.term,
            'purpose': request_data.purpose,
            'description': request_data.description,
            'status': LoanStatus.PENDING,
            'total_funded': 0.0,
            'created_at': now,
            'invitations_created': invitation_results['invitations_created'],
            'participants_created': invitation_results['participants_created']
        }
        
        logger.info(f"Loan creation successful: {loan_id}")
        return ResponseHelper.create_response(201, {
            'success': True,
            'loan': response_data
        })
        
    except ValueError as e:
        logger.error(f"Loan creation validation error: {str(e)}")
        return ResponseHelper.validation_error_response(str(e))
    except Exception as e:
        logger.error(f"Loan creation error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def handle_get_loan_details(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle getting loan details with access control and privacy filtering.
    
    Args:
        event: API Gateway event
        
    Returns:
        API Gateway response
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)
        
        # Extract loan ID from path
        path = event.get('path', '')
        loan_id = path.split('/')[-1]
        
        # Validate loan ID format
        ValidationHelper.validate_uuid_param(loan_id, 'loan_id')
        
        logger.info(f"Getting loan details for loan: {loan_id}, user: {user.user_id}")
        
        # Get loan record
        loan = DynamoDBHelper.get_item(TABLE_NAMES['LOANS'], {'loan_id': loan_id})
        if not loan:
            return ResponseHelper.not_found_response('Loan not found')
        
        # Check access permissions (borrower or invited lender)
        has_access = validate_loan_access(loan_id, user.user_id, loan['borrower_id'])
        if not has_access:
            return ResponseHelper.forbidden_response('Access denied to this loan')
        
        # Get borrower information
        borrower = DynamoDBHelper.get_item(TABLE_NAMES['USERS'], {'user_id': loan['borrower_id']})
        borrower_name = borrower['name'] if borrower else 'Unknown'
        
        # Determine user role for privacy filtering
        is_borrower = user.user_id == loan['borrower_id']
        
        # Get filtered participant data based on user role
        participant_data = get_filtered_participant_data(loan_id, user.user_id, is_borrower)
        
        # Calculate funding progress (basic info only)
        funding_progress = calculate_basic_funding_progress(loan['amount'], loan['total_funded'])
        
        # Prepare detailed response
        loan_details = {
            'loan_id': loan['loan_id'],
            'borrower_id': loan['borrower_id'],
            'borrower_name': borrower_name,
            'amount': float(loan['amount']),
            'interest_rate': float(loan['interest_rate']),
            'term': loan['term'],
            'purpose': loan['purpose'],
            'description': loan['description'],
            'status': loan['status'],
            'total_funded': float(loan['total_funded']),
            'created_at': loan['created_at'],
            'user_participation': participant_data['user_participation'],
            'participants': participant_data['participants'],
            'funding_progress': funding_progress
        }
        
        logger.info(f"Retrieved loan details for: {loan_id} (role: {'borrower' if is_borrower else 'lender'})")
        return ResponseHelper.success_response(loan_details)
        
    except ValueError as e:
        logger.error(f"Loan details validation error: {str(e)}")
        return ResponseHelper.validation_error_response(str(e))
    except Exception as e:
        logger.error(f"Loan details error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def handle_get_my_loans(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle getting borrower's loan portfolio.
    
    Args:
        event: API Gateway event
        
    Returns:
        API Gateway response
    """
    try:
        # Authenticate user and require borrower role
        user = JWTAuth.authenticate_user(event)
        JWTAuth.require_role(user, 'borrower')
        
        logger.info(f"Getting loans for borrower: {user.user_id}")
        
        # Query borrower's loans using GSI
        loans = DynamoDBHelper.query_items(
            TABLE_NAMES['LOANS'],
            'borrower_id = :borrower_id',
            {':borrower_id': user.user_id},
            'BorrowerIndex'
        )
        
        # Sort loans by creation date (newest first)
        loans.sort(key=lambda x: x['created_at'], reverse=True)
        
        # Enrich loans with participant and funding information
        enriched_loans = []
        for loan in loans:
            participants = get_loan_participants(loan['loan_id'])
            funding_progress = calculate_funding_progress(loan['amount'], loan['total_funded'], participants)
            
            enriched_loan = {
                'loan_id': loan['loan_id'],
                'amount': float(loan['amount']),
                'interest_rate': float(loan['interest_rate']),
                'term': loan['term'],
                'purpose': loan['purpose'],
                'description': loan['description'],
                'status': loan['status'],
                'total_funded': float(loan['total_funded']),
                'created_at': loan['created_at'],
                'participant_count': len(participants),
                'accepted_participants': len([p for p in participants if p['status'] == ParticipantStatus.ACCEPTED]),
                'funding_progress': funding_progress
            }
            enriched_loans.append(enriched_loan)
        
        response_data = {
            'loans': enriched_loans,
            'total_count': len(enriched_loans)
        }
        
        logger.info(f"Retrieved {len(enriched_loans)} loans for borrower: {user.user_id}")
        return ResponseHelper.success_response(response_data)
        
    except Exception as e:
        logger.error(f"My loans error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def create_lender_invitations(loan_id: str, borrower_id: str, lenders: List[Dict], created_at: str) -> Dict[str, Any]:
    """
    Create invitation and participant records for lenders.
    
    Args:
        loan_id: Loan ID
        borrower_id: Borrower user ID
        lenders: List of lender invitation data
        created_at: Timestamp
        
    Returns:
        Dictionary with creation results
    """
    invitations_created = 0
    participants_created = 0
    
    try:
        for lender_data in lenders:
            email = lender_data.email
            contribution_amount = lender_data.contribution_amount
            
            # Check if user exists for this email
            existing_users = DynamoDBHelper.query_items(
                TABLE_NAMES['USERS'],
                'email = :email',
                {':email': email},
                'EmailIndex'
            )
            
            if existing_users:
                # User exists - create participant record directly
                user = existing_users[0]
                participant = {
                    'loan_id': loan_id,
                    'lender_id': user['user_id'],
                    'contribution_amount': Decimal(str(contribution_amount)),
                    'status': ParticipantStatus.PENDING,
                    'invited_at': created_at
                }
                DynamoDBHelper.put_item(TABLE_NAMES['LOAN_PARTICIPANTS'], participant)
                participants_created += 1
                logger.info(f"Created participant record for existing user: {email}")
                
            else:
                # User doesn't exist - create invitation record
                invitation_id = UUIDHelper.generate_uuid()
                invitation = {
                    'invitation_id': invitation_id,
                    'inviter_id': borrower_id,
                    'invitee_email': email,
                    'status': InvitationStatus.PENDING,
                    'created_at': created_at
                }
                DynamoDBHelper.put_item(TABLE_NAMES['INVITATIONS'], invitation)
                invitations_created += 1
                logger.info(f"Created invitation record for new email: {email}")
                
                # Also create participant record with placeholder lender_id
                participant = {
                    'loan_id': loan_id,
                    'lender_id': f"pending:{email}",  # Placeholder until user registers
                    'contribution_amount': Decimal(str(contribution_amount)),
                    'status': ParticipantStatus.PENDING,
                    'invited_at': created_at
                }
                DynamoDBHelper.put_item(TABLE_NAMES['LOAN_PARTICIPANTS'], participant)
                participants_created += 1
        
        return {
            'invitations_created': invitations_created,
            'participants_created': participants_created
        }
        
    except Exception as e:
        logger.error(f"Error creating invitations: {str(e)}")
        # Don't fail the entire loan creation if invitations fail
        return {
            'invitations_created': invitations_created,
            'participants_created': participants_created,
            'error': str(e)
        }


def validate_loan_access(loan_id: str, user_id: str, borrower_id: str) -> bool:
    """
    Validate if user has access to view loan details.
    
    Args:
        loan_id: Loan ID
        user_id: User ID requesting access
        borrower_id: Loan borrower ID
        
    Returns:
        True if user has access, False otherwise
    """
    try:
        # Borrower always has access
        if user_id == borrower_id:
            return True
        
        # Check if user is an invited lender
        participants = DynamoDBHelper.query_items(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            'loan_id = :loan_id',
            {':loan_id': loan_id}
        )
        
        for participant in participants:
            if participant['lender_id'] == user_id:
                return True
        
        return False
        
    except Exception as e:
        logger.error(f"Error validating loan access: {str(e)}")
        return False


def get_filtered_participant_data(loan_id: str, requesting_user_id: str, is_borrower: bool) -> Dict[str, Any]:
    """
    Get participant data filtered based on user role for privacy protection.
    
    Args:
        loan_id: Loan ID
        requesting_user_id: ID of user requesting data
        is_borrower: True if requesting user is the borrower
        
    Returns:
        Filtered participant data with privacy controls
    """
    try:
        participants = DynamoDBHelper.query_items(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            'loan_id = :loan_id',
            {':loan_id': loan_id}
        )
        
        user_participation = None
        all_participants = []
        
        for participant in participants:
            lender_id = participant['lender_id']
            
            # Handle pending invitations (placeholder lender_id)
            if lender_id.startswith('pending:'):
                email = lender_id.replace('pending:', '')
                enriched_participant = {
                    'lender_id': lender_id,
                    'lender_name': f"Pending: {email}",
                    'lender_email': email,
                    'contribution_amount': float(participant['contribution_amount']),
                    'status': participant['status'],
                    'invited_at': participant['invited_at'],
                    'responded_at': participant.get('responded_at')
                }
            else:
                # Get lender information
                lender = DynamoDBHelper.get_item(TABLE_NAMES['USERS'], {'user_id': lender_id})
                enriched_participant = {
                    'lender_id': lender_id,
                    'lender_name': lender['name'] if lender else 'Unknown',
                    'lender_email': lender['email'] if lender else 'Unknown',
                    'contribution_amount': float(participant['contribution_amount']),
                    'status': participant['status'],
                    'invited_at': participant['invited_at'],
                    'responded_at': participant.get('responded_at')
                }
                
                # Include ACH details for accepted participants (needed for repayment by borrowers)
                if participant['status'] == ParticipantStatus.ACCEPTED and is_borrower:
                    ach_details = DynamoDBHelper.get_item(
                        TABLE_NAMES['ACH_DETAILS'], 
                        {'user_id': lender_id, 'loan_id': loan_id}
                    )
                    if ach_details:
                        enriched_participant['ach_details'] = {
                            'bank_name': ach_details['bank_name'],
                            'account_type': ach_details['account_type'],
                            'routing_number': ach_details['routing_number'],
                            'account_number': ach_details['account_number'],
                            'special_instructions': ach_details.get('special_instructions')
                        }
            
            # Check if this is the requesting user's participation
            if lender_id == requesting_user_id:
                user_participation = enriched_participant
            
            # Add to all participants list (will be filtered based on role)
            all_participants.append(enriched_participant)
        
        # Apply privacy filtering based on user role
        if is_borrower:
            # Borrowers see all participants (for loan management)
            return {
                'user_participation': None,  # Not applicable for borrowers
                'participants': all_participants
            }
        else:
            # Lenders see only their own participation, no other lender info
            return {
                'user_participation': user_participation,
                'participants': []  # Empty for lenders - privacy protection
            }
        
    except Exception as e:
        logger.error(f"Error getting filtered participant data: {str(e)}")
        return {
            'user_participation': None,
            'participants': []
        }


def get_loan_participants(loan_id: str) -> List[Dict[str, Any]]:
    """
    Get loan participants with lender information (legacy function for borrower use).
    
    Args:
        loan_id: Loan ID
        
    Returns:
        List of participant records with lender details
    """
    try:
        participants = DynamoDBHelper.query_items(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            'loan_id = :loan_id',
            {':loan_id': loan_id}
        )
        
        enriched_participants = []
        for participant in participants:
            lender_id = participant['lender_id']
            
            # Handle pending invitations (placeholder lender_id)
            if lender_id.startswith('pending:'):
                email = lender_id.replace('pending:', '')
                enriched_participant = {
                    'lender_id': lender_id,
                    'lender_name': f"Pending: {email}",
                    'lender_email': email,
                    'contribution_amount': float(participant['contribution_amount']),
                    'status': participant['status'],
                    'invited_at': participant['invited_at'],
                    'responded_at': participant.get('responded_at')
                }
            else:
                # Get lender information
                lender = DynamoDBHelper.get_item(TABLE_NAMES['USERS'], {'user_id': lender_id})
                enriched_participant = {
                    'lender_id': lender_id,
                    'lender_name': lender['name'] if lender else 'Unknown',
                    'lender_email': lender['email'] if lender else 'Unknown',
                    'contribution_amount': float(participant['contribution_amount']),
                    'status': participant['status'],
                    'invited_at': participant['invited_at'],
                    'responded_at': participant.get('responded_at')
                }
                
                # Include ACH details for accepted participants (needed for repayment)
                if participant['status'] == ParticipantStatus.ACCEPTED:
                    ach_details = DynamoDBHelper.get_item(
                        TABLE_NAMES['ACH_DETAILS'], 
                        {'user_id': lender_id, 'loan_id': loan_id}
                    )
                    if ach_details:
                        enriched_participant['ach_details'] = {
                            'bank_name': ach_details['bank_name'],
                            'account_type': ach_details['account_type'],
                            'routing_number': ach_details['routing_number'],
                            'account_number': ach_details['account_number'],
                            'special_instructions': ach_details.get('special_instructions')
                        }
            
            enriched_participants.append(enriched_participant)
        
        return enriched_participants
        
    except Exception as e:
        logger.error(f"Error getting loan participants: {str(e)}")
        return []


def calculate_basic_funding_progress(total_amount, total_funded) -> Dict[str, Any]:
    """
    Calculate basic loan funding progress metrics without participant details.
    Used for privacy-protected responses to lenders.
    
    Args:
        total_amount: Total loan amount (can be Decimal or float)
        total_funded: Current funded amount (can be Decimal or float)
        
    Returns:
        Basic funding progress metrics
    """
    try:
        # Convert Decimal to float for calculations
        total_amount = float(total_amount) if total_amount else 0.0
        total_funded = float(total_funded) if total_funded else 0.0
        
        funding_percentage = (total_funded / total_amount * 100) if total_amount > 0 else 0
        
        return {
            'total_amount': total_amount,
            'total_funded': total_funded,
            'remaining_amount': total_amount - total_funded,
            'funding_percentage': round(funding_percentage, 2),
            'is_fully_funded': total_funded >= total_amount
        }
        
    except Exception as e:
        logger.error(f"Error calculating basic funding progress: {str(e)}")
        # Convert to float for error response
        total_amount_float = float(total_amount) if total_amount else 0.0
        total_funded_float = float(total_funded) if total_funded else 0.0
        return {
            'total_amount': total_amount_float,
            'total_funded': total_funded_float,
            'remaining_amount': total_amount_float - total_funded_float,
            'funding_percentage': 0,
            'is_fully_funded': False
        }


def calculate_funding_progress(total_amount, total_funded, participants: List[Dict]) -> Dict[str, Any]:
    """
    Calculate loan funding progress metrics with participant details.
    Used for borrower responses and legacy compatibility.
    
    Args:
        total_amount: Total loan amount (can be Decimal or float)
        total_funded: Current funded amount (can be Decimal or float)
        participants: List of participants
        
    Returns:
        Funding progress metrics with participant details
    """
    try:
        # Convert Decimal to float for calculations
        total_amount = float(total_amount) if total_amount else 0.0
        total_funded = float(total_funded) if total_funded else 0.0
        
        accepted_participants = [p for p in participants if p['status'] == ParticipantStatus.ACCEPTED]
        pending_participants = [p for p in participants if p['status'] == ParticipantStatus.PENDING]
        
        pending_amount = sum(float(p['contribution_amount']) for p in pending_participants)
        
        funding_percentage = (total_funded / total_amount * 100) if total_amount > 0 else 0
        
        return {
            'total_amount': total_amount,
            'total_funded': total_funded,
            'remaining_amount': total_amount - total_funded,
            'funding_percentage': round(funding_percentage, 2),
            'total_participants': len(participants),
            'accepted_participants': len(accepted_participants),
            'pending_participants': len(pending_participants),
            'pending_amount': pending_amount,
            'is_fully_funded': total_funded >= total_amount
        }
        
    except Exception as e:
        logger.error(f"Error calculating funding progress: {str(e)}")
        # Convert to float for error response
        total_amount_float = float(total_amount) if total_amount else 0.0
        total_funded_float = float(total_funded) if total_funded else 0.0
        return {
            'total_amount': total_amount_float,
            'total_funded': total_funded_float,
            'remaining_amount': total_amount_float - total_funded_float,
            'funding_percentage': 0,
            'total_participants': 0,
            'accepted_participants': 0,
            'pending_participants': 0,
            'pending_amount': 0,
            'is_fully_funded': False
        }