"""
Lender handler for lender operations.
Handles GET /lender/pending anfd PUT /lender/accept/{loan_id} endpoints.
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
from shared.validation_schemas import AcceptLoanRequest, ValidationHelper
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

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for lender endpoints.
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    # Set Lambda context to not wait for empty event loop
    context.callbackWaitsForEmptyEventLoop = False
    
    try:
        logger.info(f"Lender handler invoked: {event.get('httpMethod')} {event.get('path')}")
        
        # Validate required environment variables
        required_env_vars = ['LOAN_PARTICIPANTS_TABLE', 'LOANS_TABLE', 'ACH_DETAILS_TABLE', 'USERS_TABLE']
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
        
        # GET /lender/pending - Get pending loan invitations
        if path.endswith('/lender/pending') and method == 'GET':
            return handle_get_pending_invitations(event)
        
        # PUT /lender/accept/{loan_id} - Accept loan invitation
        if re.match(r'.*/lender/accept/[^/]+$', path) and method == 'PUT':
            return handle_accept_loan(event)
        
        # GET /lenders/search - Search for previous lenders
        if path.endswith('/lenders/search') and method == 'GET':
            return handle_search_lenders(event)
        
        return ResponseHelper.not_found_response('Endpoint not found')
        
    except Exception as e:
        logger.error(f"Lender handler error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def handle_get_pending_invitations(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle getting pending loan invitations for a lender.
    
    Args:
        event: API Gateway event
        
    Returns:
        API Gateway response
    """
    try:
        # Authenticate user and require lender role
        user = JWTAuth.authenticate_user(event)
        JWTAuth.require_role(user, 'lender')
        
        logger.info(f"Getting pending invitations for lender: {user.user_id}")
        
        # Query by actual lender_id using LenderIndex
        actual_participants = DynamoDBHelper.query_items(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            'lender_id = :lender_id',
            {':lender_id': user.user_id},
            'LenderIndex'
        )
        
        # Also query by pending:email format using LenderIndex
        pending_lender_id = f"pending:{user.email}"
        pending_participants = DynamoDBHelper.query_items(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            'lender_id = :pending_lender_id',
            {':pending_lender_id': pending_lender_id},
            'LenderIndex'
        )
        
        # Deduplicate by loan_id to prevent duplicate invitations
        # Prioritize actual user_id records over pending:email records
        seen_loan_ids = set()
        all_participants = []
        
        # First, add all actual user_id records
        for participant in actual_participants:
            loan_id = participant['loan_id']
            if loan_id not in seen_loan_ids:
                all_participants.append(participant)
                seen_loan_ids.add(loan_id)
            else:
                logger.warning(f"Duplicate participant record detected for loan {loan_id} with user_id {user.user_id}")
        
        # Then, add pending:email records only if not already seen
        for participant in pending_participants:
            loan_id = participant['loan_id']
            if loan_id not in seen_loan_ids:
                all_participants.append(participant)
                seen_loan_ids.add(loan_id)
            else:
                logger.warning(f"Duplicate participant record detected for loan {loan_id} with pending:{user.email}")
        
        # Filter for pending participants
        participants = [
            p for p in all_participants 
            if p.get('status') == ParticipantStatus.PENDING
        ]
        
        logger.info(f"Found {len(participants)} pending invitations")
        
        # Enrich invitations with loan and borrower details
        invitations = []
        for participant in participants:
            try:
                # Get loan details
                loan = DynamoDBHelper.get_item(TABLE_NAMES['LOANS'], {'loan_id': participant['loan_id']})
                if not loan:
                    logger.warning(f"Loan not found for participant: {participant['loan_id']}")
                    continue
                
                # Get borrower details
                borrower = DynamoDBHelper.get_item(TABLE_NAMES['USERS'], {'user_id': loan['borrower_id']})
                borrower_name = borrower['name'] if borrower else 'Unknown'

                # Handle backward compatibility for loan_name
                loan_name = loan.get('loan_name', f"{loan['purpose']} Loan")

                # Handle backward compatibility for maturity terms
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
                        'start_date': loan['created_at'][:10],
                        'payment_frequency': loan.get('term', 'Monthly'),
                        'term_length': 12,
                        'maturity_date': loan['created_at'][:10],
                        'total_payments': 12
                    }
                
                # Create invitation object
                invitation = {
                    'loan_id': participant['loan_id'],
                    'loan_name': loan_name,
                    'loan_amount': float(loan['amount']),
                    'loan_purpose': loan['purpose'],
                    'loan_description': loan['description'],
                    'interest_rate': float(loan['interest_rate']),
                    'maturity_terms': maturity_terms,
                    'borrower_name': borrower_name,
                    'contribution_amount': float(participant['contribution_amount']),
                    'invited_at': participant['invited_at'],
                    'status': participant['status'],
                    'loan_status': loan['status'],
                    'total_funded': float(loan['total_funded']),
                    'funding_percentage': round((float(loan['total_funded']) / float(loan['amount'])) * 100, 2) if float(loan['amount']) > 0 else 0
                }
                
                invitations.append(invitation)
                
            except Exception as e:
                logger.error(f"Error enriching invitation for loan {participant['loan_id']}: {str(e)}")
                continue
        
        # Sort by invitation date (newest first)
        invitations.sort(key=lambda x: x['invited_at'], reverse=True)
        
        response_data = {
            'invitations': invitations,
            'total_count': len(invitations)
        }
        
        logger.info(f"Retrieved {len(invitations)} pending invitations for lender: {user.user_id}")
        return ResponseHelper.success_response(response_data)
        
    except Exception as e:
        logger.error(f"Get pending invitations error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def handle_accept_loan(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle accepting a loan invitation with ACH details.
    
    Args:
        event: API Gateway event
        
    Returns:
        API Gateway response
    """
    try:
        # Authenticate user and require lender role
        user = JWTAuth.authenticate_user(event)
        JWTAuth.require_role(user, 'lender')
        
        # Extract loan ID from path
        path = event.get('path', '')
        loan_id = path.split('/')[-1]
        
        # Validate loan ID format
        ValidationHelper.validate_uuid_param(loan_id, 'loan_id')
        
        # Parse and validate request body
        body = json.loads(event.get('body', '{}'))
        ach_request = ValidationHelper.validate_request_body(AcceptLoanRequest, body)
        
        logger.info(f"Processing loan acceptance: loan_id={loan_id}, lender_id={user.user_id}")
        
        # Validate loan invitation exists and is pending
        participant = validate_loan_invitation(loan_id, user.user_id)
        if not participant:
            return ResponseHelper.not_found_response('Loan invitation not found or already processed')
        
        # Get loan details
        loan = DynamoDBHelper.get_item(TABLE_NAMES['LOANS'], {'loan_id': loan_id})
        if not loan:
            return ResponseHelper.not_found_response('Loan not found')
        
        # Check if loan is still pending (not already fully funded)
        if loan['status'] != LoanStatus.PENDING:
            return ResponseHelper.validation_error_response('Loan is no longer accepting new lenders')
        
        # Perform atomic transaction to accept loan
        result = accept_loan_atomic(loan_id, user.user_id, participant, loan, ach_request)
        
        if result['success']:
            logger.info(f"Loan acceptance successful: loan_id={loan_id}, lender_id={user.user_id}")
            return ResponseHelper.success_response({
                'loan_id': loan_id,
                'status': 'ACCEPTED',
                'loan_status': result['loan_status'],
                'contribution_amount': float(participant['contribution_amount']),
                'accepted_at': result['accepted_at']
            })
        else:
            logger.error(f"Loan acceptance failed: {result['error']}")
            return ResponseHelper.validation_error_response(result['error'])
        
    except ValueError as e:
        logger.error(f"Loan acceptance validation error: {str(e)}")
        return ResponseHelper.validation_error_response(str(e))
    except Exception as e:
        logger.error(f"Loan acceptance error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def validate_loan_invitation(loan_id: str, lender_id: str) -> Optional[Dict[str, Any]]:
    """
    Validate that a loan invitation exists and is pending.
    
    Args:
        loan_id: Loan ID
        lender_id: Lender user ID
        
    Returns:
        Participant record if valid, None otherwise
    """
    try:
        # Get participant record
        participant = DynamoDBHelper.get_item(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            {'loan_id': loan_id, 'lender_id': lender_id}
        )
        
        if not participant:
            logger.warning(f"No participant record found: loan_id={loan_id}, lender_id={lender_id}")
            return None
        
        if participant['status'] != ParticipantStatus.PENDING:
            logger.warning(f"Participant status not pending: {participant['status']}")
            return None
        
        return participant
        
    except Exception as e:
        logger.error(f"Error validating loan invitation: {str(e)}")
        return None


def accept_loan_atomic(
    loan_id: str,
    lender_id: str,
    participant: Dict[str, Any],
    loan: Dict[str, Any],
    ach_request: AcceptLoanRequest
) -> Dict[str, Any]:
    """
    Perform atomic loan acceptance with funding updates.
    
    Args:
        loan_id: Loan ID
        lender_id: Lender user ID
        participant: Participant record
        loan: Loan record
        ach_request: ACH details request
        
    Returns:
        Result dictionary with success status
    """
    try:
        now = datetime.now(timezone.utc).isoformat()
        contribution_amount = participant['contribution_amount']
        new_total_funded = loan['total_funded'] + contribution_amount
        
        # Determine new loan status
        loan_status = LoanStatus.ACTIVE if new_total_funded >= loan['amount'] else LoanStatus.PENDING
        
        # Update participant status to ACCEPTED
        DynamoDBHelper.update_item(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            {'loan_id': loan_id, 'lender_id': lender_id},
            'SET #status = :status, responded_at = :responded_at',
            {
                ':status': ParticipantStatus.ACCEPTED,
                ':responded_at': now
            },
            expression_attribute_names={'#status': 'status'}
        )
        
        # Update loan funding and status
        DynamoDBHelper.update_item(
            TABLE_NAMES['LOANS'],
            {'loan_id': loan_id},
            'SET total_funded = :total_funded, #status = :status',
            {
                ':total_funded': new_total_funded,
                ':status': loan_status
            },
            expression_attribute_names={'#status': 'status'}
        )
        
        # Store ACH details
        ach_record = {
            'user_id': lender_id,
            'loan_id': loan_id,
            'bank_name': ValidationHelper.sanitize_string(ach_request.bank_name),
            'account_type': ach_request.account_type,
            'routing_number': ach_request.routing_number,
            'account_number': ach_request.account_number,
            'special_instructions': ValidationHelper.sanitize_string(ach_request.special_instructions) if ach_request.special_instructions else None,
            'created_at': now
        }
        DynamoDBHelper.put_item(TABLE_NAMES['ACH_DETAILS'], ach_record)
        
        logger.info(f"Atomic loan acceptance completed: loan_id={loan_id}, new_total_funded={new_total_funded}, loan_status={loan_status}")
        
        return {
            'success': True,
            'loan_status': loan_status,
            'accepted_at': now,
            'new_total_funded': new_total_funded
        }
        
    except Exception as e:
        logger.error(f"Atomic loan acceptance failed: {str(e)}")
        return {
            'success': False,
            'error': f"Transaction failed: {str(e)}"
        }


def handle_search_lenders(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle searching for previous lenders.
    Returns lenders who have participated in loans with their stats.
    
    Args:
        event: API Gateway event
        
    Returns:
        API Gateway response with lender list
    """
    try:
        # Authenticate user and require borrower role
        user = JWTAuth.authenticate_user(event)
        JWTAuth.require_role(user, 'borrower')
        
        # Get optional search query
        query_params = event.get('queryStringParameters') or {}
        search_query = query_params.get('q', '').lower().strip()
        
        logger.info(f"Searching lenders for borrower: {user.user_id}, query: {search_query}")
        
        # Get all accepted participants
        participants = DynamoDBHelper.scan_items(TABLE_NAMES['LOAN_PARTICIPANTS'])
        
        # Filter for accepted participants only
        accepted_participants = [
            p for p in participants 
            if p.get('status') == ParticipantStatus.ACCEPTED
        ]
        
        # Group by lender_id and calculate stats
        lender_stats = {}
        for participant in accepted_participants:
            lender_id = participant['lender_id']
            
            # Skip pending:email format lenders
            if lender_id.startswith('pending:'):
                continue
            
            if lender_id not in lender_stats:
                lender_stats[lender_id] = {
                    'lender_id': lender_id,
                    'investments': [],
                    'total_invested': Decimal('0'),
                    'investment_count': 0
                }
            
            # Add investment details
            loan_id = participant['loan_id']
            contribution = participant['contribution_amount']
            
            # Get loan details for this investment
            loan = DynamoDBHelper.get_item(TABLE_NAMES['LOANS'], {'loan_id': loan_id})
            if loan:
                investment_detail = {
                    'loan_id': loan_id,
                    'loan_name': loan.get('loan_name', f"{loan['purpose']} Loan"),
                    'amount': contribution,
                    'apr': loan['interest_rate'],
                    'status': loan['status']
                }
                lender_stats[lender_id]['investments'].append(investment_detail)
                lender_stats[lender_id]['total_invested'] += contribution
                lender_stats[lender_id]['investment_count'] += 1
        
        # Enrich with user details and calculate averages
        lenders = []
        for lender_id, stats in lender_stats.items():
            try:
                # Get lender user details
                lender_user = DynamoDBHelper.get_item(TABLE_NAMES['USERS'], {'user_id': lender_id})
                if not lender_user:
                    logger.warning(f"Lender user not found: {lender_id}")
                    continue
                
                # Apply search filter if provided
                if search_query:
                    name_match = search_query in lender_user['name'].lower()
                    email_match = search_query in lender_user['email'].lower()
                    if not (name_match or email_match):
                        continue
                
                # Calculate averages
                avg_investment = stats['total_invested'] / stats['investment_count'] if stats['investment_count'] > 0 else Decimal('0')
                avg_apr = sum(inv['apr'] for inv in stats['investments']) / len(stats['investments']) if stats['investments'] else Decimal('0')
                
                # Get most recent investment
                last_investment = stats['investments'][-1] if stats['investments'] else None
                
                lender_data = {
                    'lender_id': lender_id,
                    'name': lender_user['name'],
                    'email': lender_user['email'],
                    'stats': {
                        'investment_count': stats['investment_count'],
                        'total_invested': float(stats['total_invested']),
                        'average_investment': float(avg_investment),
                        'average_apr': float(avg_apr)
                    },
                    'last_investment': {
                        'loan_name': last_investment['loan_name'],
                        'amount': float(last_investment['amount']),
                        'apr': float(last_investment['apr']),
                        'status': last_investment['status']
                    } if last_investment else None
                }
                
                lenders.append(lender_data)
                
            except Exception as e:
                logger.error(f"Error enriching lender {lender_id}: {str(e)}")
                continue
        
        # Sort by total invested (descending)
        lenders.sort(key=lambda x: x['stats']['total_invested'], reverse=True)
        
        response_data = {
            'lenders': lenders,
            'total_count': len(lenders)
        }
        
        logger.info(f"Found {len(lenders)} lenders matching query")
        return ResponseHelper.success_response(response_data)
        
    except Exception as e:
        logger.error(f"Search lenders error: {str(e)}")
        return ResponseHelper.handle_exception(e)