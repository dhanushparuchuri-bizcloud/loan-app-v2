"""
User handler for user profile and dashboard operations.
"""
import json
import logging
from typing import Dict, Any, Optional
from decimal import Decimal

# Import shared modules
from shared.dynamodb_client import DynamoDBHelper, TABLE_NAMES
from shared.jwt_auth import JWTAuth, AuthenticatedUser
from shared.response_helper import ResponseHelper
# Constants to avoid import conflicts with Python's built-in types module
class UserStatus:
    ACTIVE = 'ACTIVE'
    INACTIVE = 'INACTIVE'

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


class UserService:
    """Service class for user operations."""
    
    @staticmethod
    def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user profile information (sanitized).
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            User profile dictionary or None if not found
        """
        try:
            user_data = DynamoDBHelper.get_item(
                TABLE_NAMES['USERS'],
                {'user_id': user_id}
            )
            
            if not user_data:
                return None
            
            # Return sanitized user profile (no password_hash)
            return {
                'user_id': user_data['user_id'],
                'email': user_data['email'],
                'name': user_data['name'],
                'is_borrower': user_data['is_borrower'],
                'is_lender': user_data['is_lender'],
                'created_at': user_data['created_at'],
                'status': user_data['status']
            }
        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            raise Exception("Failed to retrieve user profile")
    
    @staticmethod
    def calculate_borrower_stats(user_id: str) -> Dict[str, Any]:
        """
        Calculate borrower dashboard statistics.
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            Borrower statistics dictionary
        """
        try:
            # Get all loans for this borrower
            loans = DynamoDBHelper.query_items(
                TABLE_NAMES['LOANS'],
                'borrower_id = :borrower_id',
                {':borrower_id': user_id},
                index_name='BorrowerIndex'
            )
            
            active_loans = 0
            total_borrowed = Decimal('0')
            pending_requests = 0
            total_interest_rate = Decimal('0')
            active_loan_count = 0
            
            for loan in loans:
                if loan['status'] == LoanStatus.ACTIVE:
                    active_loans += 1
                    total_borrowed += Decimal(str(loan['amount']))
                    total_interest_rate += Decimal(str(loan['interest_rate']))
                    active_loan_count += 1
                elif loan['status'] == LoanStatus.PENDING:
                    pending_requests += 1
            
            # Calculate average interest rate
            average_interest_rate = float(total_interest_rate / active_loan_count) if active_loan_count > 0 else 0.0
            
            return {
                'active_loans': active_loans,
                'total_borrowed': float(total_borrowed),
                'pending_requests': pending_requests,
                'average_interest_rate': average_interest_rate
            }
        except Exception as e:
            logger.error(f"Error calculating borrower stats: {e}")
            raise Exception("Failed to calculate borrower statistics")
    
    @staticmethod
    def calculate_lender_stats(user_id: str) -> Dict[str, Any]:
        """
        Calculate lender dashboard statistics.
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            Lender statistics dictionary
        """
        try:
            # Get all loan participations for this lender
            participations = DynamoDBHelper.query_items(
                TABLE_NAMES['LOAN_PARTICIPANTS'],
                'lender_id = :lender_id',
                {':lender_id': user_id},
                index_name='LenderIndex'
            )
            
            pending_invitations = 0
            active_investments = 0
            total_lent = Decimal('0')
            expected_returns = Decimal('0')
            
            # Get loan details for calculating returns
            loan_ids = set()
            for participation in participations:
                loan_ids.add(participation['loan_id'])
                
                if participation['status'] == ParticipantStatus.PENDING:
                    pending_invitations += 1
                elif participation['status'] == ParticipantStatus.ACCEPTED:
                    active_investments += 1
                    total_lent += Decimal(str(participation['contribution_amount']))
            
            # Calculate expected returns for accepted loans
            for loan_id in loan_ids:
                loan = DynamoDBHelper.get_item(
                    TABLE_NAMES['LOANS'],
                    {'loan_id': loan_id}
                )
                
                if loan and loan['status'] == LoanStatus.ACTIVE:
                    # Find this lender's participation
                    for participation in participations:
                        if (participation['loan_id'] == loan_id and 
                            participation['status'] == ParticipantStatus.ACCEPTED):
                            
                            contribution = Decimal(str(participation['contribution_amount']))
                            interest_rate = Decimal(str(loan['interest_rate'])) / 100
                            expected_returns += contribution * interest_rate
                            break
            
            return {
                'pending_invitations': pending_invitations,
                'active_investments': active_investments,
                'total_lent': float(total_lent),
                'expected_returns': float(expected_returns)
            }
        except Exception as e:
            logger.error(f"Error calculating lender stats: {e}")
            raise Exception("Failed to calculate lender statistics")
    
    @staticmethod
    def get_dashboard_stats(user_id: str, is_borrower: bool, is_lender: bool) -> Dict[str, Any]:
        """
        Get dashboard statistics based on user roles.
        
        Args:
            user_id: User's unique identifier
            is_borrower: Whether user has borrower role
            is_lender: Whether user has lender role
            
        Returns:
            Dashboard statistics dictionary
        """
        try:
            borrower_stats = None
            lender_stats = None
            
            if is_borrower:
                borrower_stats = UserService.calculate_borrower_stats(user_id)
            
            if is_lender:
                lender_stats = UserService.calculate_lender_stats(user_id)
            
            return {
                'borrower': borrower_stats,
                'lender': lender_stats
            }
        except Exception as e:
            logger.error(f"Error getting dashboard stats: {e}")
            raise Exception("Failed to retrieve dashboard statistics")


def handle_get_profile(event: Dict[str, Any], context: Any, user: AuthenticatedUser) -> Dict[str, Any]:
    """
    Handle GET /user/profile endpoint.
    
    Args:
        event: API Gateway event
        context: Lambda context
        user: Authenticated user
        
    Returns:
        API Gateway response
    """
    try:
        profile = UserService.get_user_profile(user.user_id)
        
        if not profile:
            return JWTAuth.create_response(404, {
                'error': 'USER_NOT_FOUND',
                'message': 'User profile not found'
            })
        
        return JWTAuth.create_response(200, {
            'success': True,
            'data': profile
        })
    except Exception as e:
        logger.error(f"Profile endpoint error: {e}")
        return JWTAuth.create_response(500, {
            'error': 'INTERNAL_ERROR',
            'message': 'Failed to retrieve user profile'
        })


def handle_get_dashboard(event: Dict[str, Any], context: Any, user: AuthenticatedUser) -> Dict[str, Any]:
    """
    Handle GET /user/dashboard endpoint.
    
    Args:
        event: API Gateway event
        context: Lambda context
        user: Authenticated user
        
    Returns:
        API Gateway response
    """
    try:
        dashboard_stats = UserService.get_dashboard_stats(
            user.user_id,
            user.is_borrower,
            user.is_lender
        )
        
        response_data = {}
        
        if dashboard_stats.get('borrower'):
            response_data['borrower'] = dashboard_stats['borrower']
        
        if dashboard_stats.get('lender'):
            response_data['lender'] = dashboard_stats['lender']
        
        return JWTAuth.create_response(200, {
            'success': True,
            'data': response_data
        })
    except Exception as e:
        logger.error(f"Dashboard endpoint error: {e}")
        return JWTAuth.create_response(500, {
            'error': 'INTERNAL_ERROR',
            'message': 'Failed to retrieve dashboard statistics'
        })


def handle_get_lender_portfolio(event: Dict[str, Any], context: Any, user: AuthenticatedUser) -> Dict[str, Any]:
    """
    Handle GET /user/lender-portfolio endpoint.
    
    Args:
        event: API Gateway event
        context: Lambda context
        user: Authenticated user
        
    Returns:
        API Gateway response
    """
    try:
        # Ensure user is a lender
        if not user.is_lender:
            return JWTAuth.create_response(403, {
                'error': 'FORBIDDEN',
                'message': 'User is not authorized as a lender'
            })
        
        logger.info(f"Getting lender portfolio for user: {user.user_id}")
        
        # Get all loan participations for this lender (both pending and accepted)
        participations = DynamoDBHelper.query_items(
            TABLE_NAMES['LOAN_PARTICIPANTS'],
            'lender_id = :lender_id',
            {':lender_id': user.user_id},
            index_name='LenderIndex'
        )
        
        logger.info(f"Found {len(participations)} participations for lender")
        
        # Enrich participations with loan and borrower details
        portfolio_items = []
        for participation in participations:
            try:
                # Get loan details
                loan = DynamoDBHelper.get_item(
                    TABLE_NAMES['LOANS'],
                    {'loan_id': participation['loan_id']}
                )
                
                if not loan:
                    logger.warning(f"Loan not found: {participation['loan_id']}")
                    continue
                
                # Get borrower details
                borrower = DynamoDBHelper.get_item(
                    TABLE_NAMES['USERS'],
                    {'user_id': loan['borrower_id']}
                )
                
                borrower_name = borrower['name'] if borrower else 'Unknown Borrower'
                
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
                
                # Calculate expected returns
                contribution_amount = float(participation['contribution_amount'])
                interest_rate = float(loan['interest_rate'])
                expected_annual_return = (contribution_amount * interest_rate) / 100
                expected_monthly_return = expected_annual_return / 12
                
                # Create portfolio item
                portfolio_item = {
                    'loan_id': participation['loan_id'],
                    'borrower_name': borrower_name,
                    'loan_amount': float(loan['amount']),
                    'contribution_amount': contribution_amount,
                    'interest_rate': interest_rate,
                    'maturity_terms': maturity_terms,
                    'purpose': loan['purpose'],
                    'description': loan['description'],
                    'loan_status': loan['status'],
                    'participation_status': participation['status'],
                    'invited_at': participation['invited_at'],
                    'responded_at': participation.get('responded_at'),
                    'total_funded': float(loan['total_funded']),
                    'funding_percentage': round((float(loan['total_funded']) / float(loan['amount'])) * 100, 2) if float(loan['amount']) > 0 else 0,
                    'expected_annual_return': expected_annual_return,
                    'expected_monthly_return': expected_monthly_return,
                    'created_at': loan['created_at']
                }
                
                portfolio_items.append(portfolio_item)
                
            except Exception as e:
                logger.error(f"Error enriching portfolio item for loan {participation['loan_id']}: {str(e)}")
                continue
        
        # Sort by invitation date (newest first)
        portfolio_items.sort(key=lambda x: x['invited_at'], reverse=True)
        
        # Calculate summary statistics
        total_invested = sum(item['contribution_amount'] for item in portfolio_items if item['participation_status'] == ParticipantStatus.ACCEPTED)
        total_expected_returns = sum(item['expected_annual_return'] for item in portfolio_items if item['participation_status'] == ParticipantStatus.ACCEPTED)
        pending_count = len([item for item in portfolio_items if item['participation_status'] == ParticipantStatus.PENDING])
        active_count = len([item for item in portfolio_items if item['participation_status'] == ParticipantStatus.ACCEPTED and item['loan_status'] == LoanStatus.ACTIVE])
        
        response_data = {
            'portfolio': portfolio_items,
            'total_count': len(portfolio_items),
            'summary': {
                'total_invested': total_invested,
                'total_expected_returns': total_expected_returns,
                'pending_invitations': pending_count,
                'active_investments': active_count
            }
        }
        
        return ResponseHelper.success_response(response_data)
        
    except Exception as e:
        logger.error(f"Lender portfolio endpoint error: {e}")
        return ResponseHelper.error_response(
            500, 
            'INTERNAL_ERROR',
            'Failed to retrieve lender portfolio'
        )


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for user endpoints.
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    try:
        path = event.get('path', '')
        method = event.get('httpMethod', '').upper()
        
        logger.info(f"User handler called with {method} {path}")
        
        # Handle CORS preflight requests
        if method == 'OPTIONS':
            return JWTAuth.create_response(200, {})
        
        # Route to appropriate handler with authentication
        if path == '/user/profile' and method == 'GET':
            return JWTAuth.with_auth(handle_get_profile)(event, context)
        elif path == '/user/dashboard' and method == 'GET':
            return JWTAuth.with_auth(handle_get_dashboard)(event, context)
        elif path == '/user/lender-portfolio' and method == 'GET':
            return JWTAuth.with_auth(handle_get_lender_portfolio)(event, context)
        else:
            return JWTAuth.create_response(404, {
                'error': 'NOT_FOUND',
                'message': f'Endpoint {method} {path} not found'
            })
    
    except Exception as e:
        logger.error(f"Unexpected error in user handler: {e}")
        return JWTAuth.create_response(500, {
            'error': 'INTERNAL_ERROR',
            'message': 'An unexpected error occurred'
        })