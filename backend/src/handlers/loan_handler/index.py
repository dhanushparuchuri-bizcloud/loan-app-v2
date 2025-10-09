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
from shared.validation_schemas import CreateLoanRequest, LenderInviteRequest, ValidationHelper
from shared.response_helper import ResponseHelper
from shared.payment_calculator import PaymentCalculator

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

        # GET /lenders/search - Search for previous lenders (check before /loans routes)
        if path.endswith('/lenders/search') and method == 'GET':
            return handle_search_lenders(event)

        # GET /loans/my-loans - Get borrower's loans (check this first to avoid UUID validation)
        if path.endswith('/loans/my-loans') and method == 'GET':
            return handle_get_my_loans(event)

        # POST /loans/{id}/lenders - Add lenders to existing loan (check before generic /{id})
        if re.match(r'.*/loans/[^/]+/lenders$', path) and method == 'POST':
            return handle_add_lenders(event)

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
        
        # Validate that user is not inviting themselves as a lender
        user_email_lower = user.email.lower()
        for lender in request_data.lenders:
            if lender.email.lower() == user_email_lower:
                logger.warning(f"User {user.user_id} attempted to invite themselves as lender: {lender.email}")
                return ResponseHelper.validation_error_response(
                    "You cannot invite yourself as a lender to your own loan"
                )
        
        logger.info(f"Creating loan for borrower: {user.user_id}, amount: {request_data.amount}")
        
        # Generate loan ID and timestamp
        loan_id = UUIDHelper.generate_uuid()
        now = datetime.now(timezone.utc).isoformat()
        
        # Calculate loan-level maturity terms
        loan_terms = PaymentCalculator.calculate_loan_terms(
            start_date=request_data.maturity_terms.start_date,
            payment_frequency=request_data.maturity_terms.payment_frequency,
            term_length=request_data.maturity_terms.term_length
        )
        
        # Create loan record with enhanced maturity terms
        loan = {
            'loan_id': loan_id,
            'loan_name': ValidationHelper.sanitize_string(request_data.loan_name),
            'borrower_id': user.user_id,
            'amount': Decimal(str(request_data.amount)),
            'interest_rate': Decimal(str(request_data.interest_rate)),
            # Enhanced maturity terms
            'start_date': request_data.maturity_terms.start_date,
            'payment_frequency': request_data.maturity_terms.payment_frequency,
            'term_length': request_data.maturity_terms.term_length,
            'maturity_date': loan_terms['maturity_date'],
            'total_payments': loan_terms['total_payments'],
            'purpose': ValidationHelper.sanitize_string(request_data.purpose),
            'description': ValidationHelper.sanitize_string(request_data.description),
            'status': LoanStatus.PENDING,
            'total_funded': Decimal('0'),
            'created_at': now
        }
        
        # Add entity details if provided
        if request_data.entity_details:
            loan.update({
                'entity_name': ValidationHelper.sanitize_string(request_data.entity_details.entity_name) if request_data.entity_details.entity_name else None,
                'entity_type': request_data.entity_details.entity_type,
                'entity_tax_id': ValidationHelper.sanitize_string(request_data.entity_details.entity_tax_id) if request_data.entity_details.entity_tax_id else None,
                'borrower_relationship': request_data.entity_details.borrower_relationship
            })
        
        # Save loan to database
        DynamoDBHelper.put_item(TABLE_NAMES['LOANS'], loan)
        logger.info(f"Created loan record: {loan_id}")

        # Process lender invitations (if any)
        if request_data.lenders:
            invitation_results = create_lender_invitations(loan_id, user.user_id, request_data.lenders, now)
        else:
            logger.info(f"Loan {loan_id} created with no initial lenders")
            invitation_results = {'invitations_created': 0, 'participants_created': 0}
        
        # Prepare response with loan details and invitation results
        response_data = {
            'loan_id': loan_id,
            'loan_name': request_data.loan_name,
            'borrower_id': user.user_id,
            'amount': request_data.amount,
            'interest_rate': request_data.interest_rate,
            'maturity_terms': {
                'start_date': request_data.maturity_terms.start_date,
                'payment_frequency': request_data.maturity_terms.payment_frequency,
                'term_length': request_data.maturity_terms.term_length,
                'maturity_date': loan_terms['maturity_date'],
                'total_payments': loan_terms['total_payments']
            },
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

        # Handle backward compatibility for loans without loan_name
        if 'loan_name' not in loan:
            loan['loan_name'] = f"{loan['purpose']} Loan"

        # Check access permissions (borrower or invited lender)
        has_access = validate_loan_access(loan_id, user.user_id, user.email, loan['borrower_id'])
        if not has_access:
            return ResponseHelper.forbidden_response('Access denied to this loan')
        
        # Get borrower information
        borrower = DynamoDBHelper.get_item(TABLE_NAMES['USERS'], {'user_id': loan['borrower_id']})
        borrower_name = borrower['name'] if borrower else 'Unknown'
        
        # Determine user role for privacy filtering
        is_borrower = user.user_id == loan['borrower_id']
        
        # Get filtered participant data based on user role
        participant_data = get_filtered_participant_data(loan_id, user.user_id, user.email, is_borrower)
        
        # Calculate funding progress (basic info only)
        funding_progress = calculate_basic_funding_progress(loan['amount'], loan['total_funded'])
        
        # Handle backward compatibility for old loans without maturity terms
        if 'start_date' in loan:
            # New format with enhanced maturity terms
            maturity_terms = {
                'start_date': loan['start_date'],
                'payment_frequency': loan['payment_frequency'],
                'term_length': loan['term_length'],
                'maturity_date': loan['maturity_date'],
                'total_payments': loan['total_payments']
            }
        else:
            # Old format - convert on the fly
            maturity_terms = {
                'start_date': loan['created_at'][:10],  # Use creation date as start
                'payment_frequency': loan.get('term', 'Monthly'),  # Use old term field
                'term_length': 12,  # Default to 12 months
                'maturity_date': loan['created_at'][:10],  # Placeholder
                'total_payments': 12  # Default
            }
        
        # Calculate payment details based on user role
        user_participation_with_payments = None
        borrower_payment_details = None
        
        logger.info(f"Payment calculation conditions - is_borrower: {is_borrower}, user_participation exists: {bool(participant_data['user_participation'])}")
        
        if not is_borrower and participant_data['user_participation']:
            # LENDER: Calculate their individual payment details
            user_participation = participant_data['user_participation']
            logger.info(f"Calculating lender payments for user {user.user_id}, contribution: {user_participation['contribution_amount']}")
            try:
                lender_payments = PaymentCalculator.calculate_lender_payments(
                    contribution_amount=float(user_participation['contribution_amount']),
                    annual_rate=float(loan['interest_rate']) / 100,  # Convert percentage to decimal
                    total_payments=int(maturity_terms['total_payments']),
                    payment_frequency=maturity_terms['payment_frequency']
                )
                logger.info(f"Lender payment calculation successful: {lender_payments}")
            except Exception as e:
                logger.error(f"Error calculating lender payments: {str(e)}")
                lender_payments = {
                    'payment_amount': 0,
                    'total_interest': 0,
                    'total_repayment': 0
                }
            
            user_participation_with_payments = {
                'lender_id': user_participation['lender_id'],
                'contribution_amount': user_participation['contribution_amount'],
                'status': user_participation['status'],
                'invited_at': user_participation['invited_at'],
                'responded_at': user_participation.get('responded_at'),
                'payment_amount': lender_payments['payment_amount'],
                'total_interest': lender_payments['total_interest'],
                'total_repayment': lender_payments['total_repayment'],
                'disclaimer': "These calculations are estimates for informational purposes only. Not financial or legal advice. No warranties or guarantees of accuracy. Your actual returns, payment schedule, and terms will be established in your signed agreement with the borrower. Independently verify all calculations and consult your financial and legal advisors before committing funds. We accept no liability for investment decisions based on these estimates."
            }
        
        elif is_borrower:
            # BORROWER: Calculate payment details for each lender + total
            lender_payment_details = []
            total_payment_amount = 0
            
            for participant in participant_data['participants']:
                # Only calculate for non-pending participants (those with real lender_ids)
                if not participant['lender_id'].startswith('pending:'):
                    lender_payments = PaymentCalculator.calculate_lender_payments(
                        contribution_amount=float(participant['contribution_amount']),
                        annual_rate=float(loan['interest_rate']) / 100,
                        total_payments=int(maturity_terms['total_payments']),
                        payment_frequency=maturity_terms['payment_frequency']
                    )
                    
                    lender_detail = {
                        'lender_id': participant['lender_id'],
                        'lender_name': participant['lender_name'],
                        'lender_email': participant['lender_email'],
                        'contribution_amount': participant['contribution_amount'],
                        'payment_amount': lender_payments['payment_amount'],
                        'status': participant['status']
                    }
                    
                    # Include ACH details for accepted lenders (borrower needs this for payments)
                    if 'ach_details' in participant:
                        lender_detail['ach_details'] = participant['ach_details']
                    
                    lender_payment_details.append(lender_detail)
                    total_payment_amount += lender_payments['payment_amount']
            
            # Generate payment schedule dates
            payment_dates = PaymentCalculator._generate_payment_schedule(
                maturity_terms['start_date'],
                maturity_terms['payment_frequency'],
                int(maturity_terms['total_payments'])
            )
            
            borrower_payment_details = {
                'total_payment_amount': round(total_payment_amount, 2),
                'payment_frequency': maturity_terms['payment_frequency'],
                'total_payments': int(maturity_terms['total_payments']),
                'payment_dates': payment_dates,
                'lender_payments': lender_payment_details,
                'disclaimer': "Estimates for informational purposes only. Not financial or legal advice. No warranties or guarantees of accuracy. Your lender will provide final payment amounts and terms. Review all documents and consult your lender before signing. We accept no liability for reliance on these estimates."
            }
        
        # Prepare detailed response
        loan_details = {
            'loan_id': loan['loan_id'],
            'loan_name': loan['loan_name'],
            'borrower_id': loan['borrower_id'],
            'borrower_name': borrower_name,
            'amount': float(loan['amount']),
            'interest_rate': float(loan['interest_rate']),
            'maturity_terms': maturity_terms,
            'purpose': loan['purpose'],
            'description': loan['description'],
            'status': loan['status'],
            'total_funded': float(loan['total_funded']),
            'created_at': loan['created_at'],
            'user_participation': user_participation_with_payments,
            'borrower_payment_details': borrower_payment_details,
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

            # Handle backward compatibility for old loans without loan_name
            loan_name = loan.get('loan_name', f"{loan['purpose']} Loan")

            # Handle backward compatibility for old loans without maturity terms
            if 'start_date' in loan:
                # New format with enhanced maturity terms
                term_display = f"{loan['payment_frequency']} for {loan['term_length']} months"
            else:
                # Old format - use existing term field
                term_display = loan.get('term', 'Unknown')

            enriched_loan = {
                'loan_id': loan['loan_id'],
                'loan_name': loan_name,
                'amount': float(loan['amount']),
                'interest_rate': float(loan['interest_rate']),
                'term': term_display,
                'purpose': loan['purpose'],
                'description': loan['description'],
                'status': loan['status'],
                'total_funded': float(loan['total_funded']),
                'created_at': loan['created_at'],
                'participant_count': len(participants),
                'accepted_participants': len([p for p in participants if p['status'] == ParticipantStatus.ACCEPTED]),
                'funding_progress': funding_progress,
                'participants': [
                    {
                        'lender_id': p['lender_id'],
                        'lender_name': p.get('lender_name'),
                        'lender_email': p.get('lender_email'),
                        'contribution_amount': float(p['contribution_amount']),
                        'status': p['status']
                    }
                    for p in participants
                ]
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
                
                # Activate user as lender if not already
                if not user.get('is_lender', False):
                    DynamoDBHelper.update_item(
                        TABLE_NAMES['USERS'],
                        {'user_id': user['user_id']},
                        'SET is_lender = :true, user_type = :active_lender',
                        {
                            ':true': True,
                            ':active_lender': UserType.ACTIVE_LENDER
                        }
                    )
                    logger.info(f"Activated lender role for user: {email}")
                
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


def validate_loan_access(loan_id: str, user_id: str, user_email: str, borrower_id: str) -> bool:
    """
    Validate if user has access to view loan details.
    
    Args:
        loan_id: Loan ID
        user_id: User ID requesting access
        user_email: Email of user requesting access
        borrower_id: Loan borrower ID
        
    Returns:
        True if user has access, False otherwise
    """
    try:
        # Borrower always has access
        if user_id == borrower_id:
            logger.info(f"Loan access granted: user {user_id} is borrower for loan {loan_id}")
            return True
        
        # Check if user is an invited lender
        participants = DynamoDBHelper.query_items(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            'loan_id = :loan_id',
            {':loan_id': loan_id}
        )
        
        pending_lender_id = f"pending:{user_email}"
        logger.info(f"Access validation for loan {loan_id}: user_id={user_id}, user_email={user_email}, pending_lender_id={pending_lender_id}")
        logger.info(f"Found {len(participants)} participants: {[p['lender_id'] for p in participants]}")
        
        for participant in participants:
            # Check both actual user_id and pending:email format
            if participant['lender_id'] == user_id or participant['lender_id'] == pending_lender_id:
                logger.info(f"Loan access granted: user {user_id} found as participant with lender_id {participant['lender_id']}")
                return True
        
        logger.info(f"Loan access denied: user {user_id} not found in participants")
        return False
        
    except Exception as e:
        logger.error(f"Error validating loan access: {str(e)}")
        return False


def get_filtered_participant_data(loan_id: str, requesting_user_id: str, requesting_user_email: str, is_borrower: bool) -> Dict[str, Any]:
    """
    Get participant data filtered based on user role for privacy protection.
    
    Args:
        loan_id: Loan ID
        requesting_user_id: ID of user requesting data
        requesting_user_email: Email of user requesting data
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
            # Handle both actual user_id and pending:email format
            pending_lender_id = f"pending:{requesting_user_email}"
            logger.info(f"Checking participation: lender_id={lender_id}, requesting_user_id={requesting_user_id}, pending_lender_id={pending_lender_id}")
            if lender_id == requesting_user_id or lender_id == pending_lender_id:
                logger.info(f"MATCH FOUND! Setting user_participation for {requesting_user_id}")
                user_participation = enriched_participant
            else:
                logger.info(f"No match: {lender_id} != {requesting_user_id} and {lender_id} != {pending_lender_id}")
            
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
        # Calculate total invited (both accepted and pending)
        total_invited = sum(float(p['contribution_amount']) for p in participants)
        
        funding_percentage = (total_funded / total_amount * 100) if total_amount > 0 else 0
        
        return {
            'total_amount': total_amount,
            'total_funded': total_funded,
            'total_invited': total_invited,  # Total invited including pending
            'remaining_amount': total_amount - total_invited,  # Use total_invited, not total_funded
            'funding_percentage': round(funding_percentage, 2),
            'total_participants': len(participants),
            'accepted_participants': len(accepted_participants),
            'pending_participants': len(pending_participants),
            'pending_amount': pending_amount,
            'is_fully_funded': total_invited >= total_amount  # Use total_invited
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


def handle_add_lenders(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add lenders to an existing loan.
    POST /loans/{loan_id}/lenders

    Allows borrowers to incrementally invite lenders to pending loans.
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)

        # Get loan ID from path
        path = event.get('path', '')
        loan_id = path.split('/')[-2]  # Extract from /loans/{id}/lenders

        # Validate loan ID
        ValidationHelper.validate_uuid_param(loan_id, 'loan_id')

        logger.info(f"Adding lenders to loan: {loan_id}, user: {user.user_id}")

        # Get loan
        loan = DynamoDBHelper.get_item(TABLE_NAMES['LOANS'], {'loan_id': loan_id})
        if not loan:
            return ResponseHelper.not_found_response('Loan not found')

        # Verify user is the borrower
        if loan['borrower_id'] != user.user_id:
            return ResponseHelper.forbidden_response('Only the loan creator can add lenders')

        # Verify loan is still PENDING
        if loan['status'] != LoanStatus.PENDING:
            return ResponseHelper.validation_error_response(
                f'Cannot add lenders to {loan["status"]} loan. Only PENDING loans can be modified.'
            )

        # Parse new lenders from request body
        body = json.loads(event.get('body', '{}'))
        lender_data = body.get('lenders', [])

        if not lender_data:
            return ResponseHelper.validation_error_response('No lenders provided')

        # Validate new lenders
        new_lenders = []
        for lender in lender_data:
            try:
                validated = ValidationHelper.validate_request_body(LenderInviteRequest, lender)
                new_lenders.append(validated)
            except ValueError as e:
                return ResponseHelper.validation_error_response(f'Invalid lender data: {str(e)}')

        # Calculate current total invited
        current_invited = calculate_total_invited(loan_id)
        new_contributions = sum(float(l.contribution_amount) for l in new_lenders)
        total_after_add = current_invited + new_contributions

        logger.info(f"Current invited: {current_invited}, New: {new_contributions}, Total after: {total_after_add}, Loan amount: {loan['amount']}")

        # Validate total doesn't exceed loan amount
        if total_after_add > float(loan['amount']):
            return ResponseHelper.validation_error_response(
                f"Total invitations ({total_after_add}) would exceed loan amount ({loan['amount']}). "
                f"Current invited: {current_invited}, Remaining available: {float(loan['amount']) - current_invited}"
            )

        # Validate borrower not inviting themselves
        user_email_lower = user.email.lower()
        for lender in new_lenders:
            if lender.email.lower() == user_email_lower:
                return ResponseHelper.validation_error_response(
                    "You cannot invite yourself as a lender to your own loan"
                )

        # Create invitations
        now = datetime.now(timezone.utc).isoformat()
        invitation_results = create_lender_invitations(
            loan_id, user.user_id, new_lenders, now
        )

        # Prepare response
        response_data = {
            'loan_id': loan_id,
            'lenders_added': len(new_lenders),
            'invitations_created': invitation_results['invitations_created'],
            'participants_created': invitation_results['participants_created'],
            'total_invited': total_after_add,
            'remaining': float(loan['amount']) - total_after_add,
            'is_fully_invited': total_after_add >= float(loan['amount'])
        }

        logger.info(f"Successfully added {len(new_lenders)} lenders to loan {loan_id}")
        return ResponseHelper.success_response(response_data, 'Lenders added successfully')

    except ValueError as e:
        logger.error(f"Add lenders validation error: {str(e)}")
        return ResponseHelper.validation_error_response(str(e))
    except Exception as e:
        logger.error(f"Add lenders error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def calculate_total_invited(loan_id: str) -> float:
    """
    Calculate total contribution amount for all participants (pending + accepted).

    Args:
        loan_id: Loan ID

    Returns:
        Total invited amount
    """
    participants = DynamoDBHelper.query_items(
        TABLE_NAMES['LOAN_PARTICIPANTS'],
        'loan_id = :loan_id',
        {':loan_id': loan_id}
    )

    total = sum(float(p['contribution_amount']) for p in participants)
    logger.info(f"Calculated total invited for loan {loan_id}: {total} ({len(participants)} participants)")
    return total



def handle_search_lenders(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Search for lenders the borrower has previously worked with.
    
    Args:
        event: API Gateway event
        
    Returns:
        API Gateway response with list of lenders
    """
    try:
        # Authenticate user and require borrower role
        user = JWTAuth.authenticate_user(event)
        JWTAuth.require_role(user, 'borrower')
        
        # Get search query from query parameters
        query_params = event.get('queryStringParameters') or {}
        search_query = query_params.get('q', '').lower().strip()
        
        logger.info(f"Searching lenders for borrower: {user.user_id}, query: '{search_query}'")
        
        # Get all loans for this borrower
        borrower_loans = DynamoDBHelper.query_items(
            TABLE_NAMES['LOANS'],
            'borrower_id = :borrower_id',
            {':borrower_id': user.user_id},
            'BorrowerIndex'
        )
        
        logger.info(f"Found {len(borrower_loans)} loans for borrower")
        
        # Collect all unique lenders from those loans
        lender_map = {}
        
        for loan in borrower_loans:
            # Get participants for this loan
            participants = DynamoDBHelper.query_items(
                TABLE_NAMES['LOAN_PARTICIPANTS'],
                'loan_id = :loan_id',
                {':loan_id': loan['loan_id']}
            )
            
            for participant in participants:
                lender_id = participant['lender_id']
                
                # Skip pending lenders (not registered yet)
                if lender_id.startswith('pending:'):
                    continue
                
                # Only include accepted lenders (proven track record)
                if participant['status'] != ParticipantStatus.ACCEPTED:
                    continue
                
                # Get or initialize lender stats
                if lender_id not in lender_map:
                    lender = DynamoDBHelper.get_item(
                        TABLE_NAMES['USERS'],
                        {'user_id': lender_id}
                    )
                    
                    if not lender:
                        continue
                    
                    lender_map[lender_id] = {
                        'lender_id': lender_id,
                        'name': lender['name'],
                        'email': lender['email'],
                        'investment_count': 0,
                        'total_invested': 0,
                        'investments': []
                    }
                
                # Aggregate stats
                lender_map[lender_id]['investment_count'] += 1
                lender_map[lender_id]['total_invested'] += float(participant['contribution_amount'])
                lender_map[lender_id]['investments'].append({
                    'loan_name': loan.get('loan_name', loan['purpose']),
                    'amount': float(participant['contribution_amount']),
                    'apr': float(loan['interest_rate']),
                    'status': loan['status'],
                    'date': participant.get('responded_at', participant['invited_at'])
                })
        
        # Convert to list and calculate averages
        lenders = []
        for lender_data in lender_map.values():
            # Calculate average investment and APR
            avg_investment = lender_data['total_invested'] / lender_data['investment_count']
            avg_apr = sum(inv['amount'] * inv['apr'] for inv in lender_data['investments']) / lender_data['total_invested']
            
            # Get last investment
            last_investment = max(lender_data['investments'], key=lambda x: x['date'])
            
            lenders.append({
                'lender_id': lender_data['lender_id'],
                'name': lender_data['name'],
                'email': lender_data['email'],
                'stats': {
                    'investment_count': lender_data['investment_count'],
                    'total_invested': round(lender_data['total_invested'], 2),
                    'average_investment': round(avg_investment, 2),
                    'average_apr': round(avg_apr, 2)
                },
                'last_investment': {
                    'loan_name': last_investment['loan_name'],
                    'amount': last_investment['amount'],
                    'apr': last_investment['apr'],
                    'status': last_investment['status']
                }
            })
        
        # Filter by search query if provided
        if search_query:
            lenders = [
                l for l in lenders
                if search_query in l['name'].lower() or search_query in l['email'].lower()
            ]
        
        # Sort by investment count (most frequent first)
        lenders.sort(key=lambda x: x['stats']['investment_count'], reverse=True)
        
        logger.info(f"Returning {len(lenders)} lenders (filtered from {len(lender_map)} total)")
        
        return ResponseHelper.success_response({
            'lenders': lenders,
            'total_count': len(lenders)
        })
        
    except Exception as e:
        logger.error(f"Search lenders error: {str(e)}")
        return ResponseHelper.handle_exception(e)
