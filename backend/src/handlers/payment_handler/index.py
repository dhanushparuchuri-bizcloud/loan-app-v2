"""
Payment handler for payment tracking operations.
Handles payment ssubmission, approval, rejection, and receipt management.
"""
import json
import logging
import os
import re
import boto3
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from urllib.parse import quote

# Import shared utilities
from shared.dynamodb_client import DynamoDBHelper, TABLE_NAMES
from shared.jwt_auth import JWTAuth, AuthenticatedUser
from shared.uuid_helper import UUIDHelper
from shared.response_helper import ResponseHelper

# Constants
class PaymentStatus:
    PENDING = 'PENDING'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'

class ParticipantStatus:
    ACCEPTED = 'ACCEPTED'

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# S3 client for presigned URLs
s3_client = boto3.client('s3')
RECEIPTS_BUCKET = os.environ.get('RECEIPTS_BUCKET')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for payment endpoints.

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        API Gateway response
    """
    try:
        logger.info(f"Payment handler invoked: {event.get('httpMethod')} {event.get('path')}")

        # Validate required environment variables
        required_env_vars = ['PAYMENTS_TABLE', 'LOANS_TABLE', 'LOAN_PARTICIPANTS_TABLE', 'RECEIPTS_BUCKET']
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

        # POST /payments - Submit payment
        if path.endswith('/payments') and method == 'POST':
            return handle_submit_payment(event)

        # POST /payments/receipt-upload-url - Get presigned upload URL
        if path.endswith('/payments/receipt-upload-url') and method == 'POST':
            return handle_get_upload_url(event)

        # GET /payments/loan/{loan_id} - List payments for a loan
        if re.match(r'.*/payments/loan/[^/]+$', path) and method == 'GET':
            return handle_list_payments_by_loan(event)

        # GET /payments/{payment_id}/receipt-url - Get presigned view URL
        if re.match(r'.*/payments/[^/]+/receipt-url$', path) and method == 'GET':
            return handle_get_receipt_url(event)

        # PUT /payments/{payment_id}/approve - Approve payment
        if re.match(r'.*/payments/[^/]+/approve$', path) and method == 'PUT':
            return handle_approve_payment(event)

        # PUT /payments/{payment_id}/reject - Reject payment
        if re.match(r'.*/payments/[^/]+/reject$', path) and method == 'PUT':
            return handle_reject_payment(event)

        # GET /payments/{payment_id} - Get payment details
        if re.match(r'.*/payments/[^/]+$', path) and method == 'GET':
            return handle_get_payment(event)

        return ResponseHelper.not_found_response('Endpoint not found')

    except Exception as e:
        logger.error(f"Payment handler error: {str(e)}", exc_info=True)
        return ResponseHelper.internal_error_response(str(e))


def handle_submit_payment(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle POST /payments - Submit a payment.
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)

        # Parse request body
        body = json.loads(event.get('body', '{}'))
        loan_id = body.get('loan_id')
        lender_id = body.get('lender_id')
        amount = body.get('amount')
        payment_date = body.get('payment_date')
        notes = body.get('notes', '')
        receipt_key = body.get('receipt_key', '')
        receipt_url = body.get('receipt_url', '')

        # Validate required fields
        if not all([loan_id, lender_id, amount, payment_date]):
            return ResponseHelper.validation_error_response('Missing required fields')

        # Validate amount
        try:
            amount_decimal = Decimal(str(amount))
            if amount_decimal <= 0:
                return ResponseHelper.validation_error_response('Amount must be greater than 0')
        except:
            return ResponseHelper.validation_error_response('Invalid amount')

        # Get loan details
        loan = DynamoDBHelper.get_item(TABLE_NAMES['LOANS'], {'loan_id': loan_id})
        if not loan:
            return ResponseHelper.not_found_response('Loan not found')

        # Verify user is the borrower
        if loan['borrower_id'] != user.user_id:
            return ResponseHelper.forbidden_response('Only the borrower can submit payments')

        # Get lender participation
        participant_key = {'loan_id': loan_id, 'lender_id': lender_id}
        participant = DynamoDBHelper.get_item(TABLE_NAMES['LOAN_PARTICIPANTS'], participant_key)

        if not participant:
            return ResponseHelper.not_found_response('Lender not found for this loan')

        if participant['status'] != ParticipantStatus.ACCEPTED:
            return ResponseHelper.validation_error_response('Lender must have accepted the loan')

        # Calculate remaining balance
        contribution = Decimal(str(participant['contribution_amount']))
        total_paid = Decimal(str(participant.get('total_paid', 0)))
        remaining_balance = contribution - total_paid

        # Validate amount doesn't exceed remaining balance
        if amount_decimal > remaining_balance:
            return ResponseHelper.validation_error_response(
                f'Payment amount ${amount} exceeds remaining balance ${remaining_balance}'
            )

        # Create payment record
        # If receipt_key provided, extract payment_id from it (format: loan_id/lender_id/payment_id/filename)
        # Otherwise generate new payment_id
        if receipt_key:
            try:
                payment_id = receipt_key.split('/')[2]
            except:
                payment_id = UUIDHelper.generate_uuid()
        else:
            payment_id = UUIDHelper.generate_uuid()

        now = datetime.now(timezone.utc).isoformat()

        payment = {
            'payment_id': payment_id,
            'loan_id': loan_id,
            'borrower_id': user.user_id,
            'lender_id': lender_id,
            'amount': amount_decimal,
            'payment_date': payment_date,
            'status': PaymentStatus.PENDING,
            'receipt_key': receipt_key,
            'receipt_url': receipt_url,
            'notes': notes,
            'created_at': now,
            'updated_at': now
        }

        DynamoDBHelper.put_item(TABLE_NAMES['PAYMENTS'], payment)

        logger.info(f"Payment {payment_id} submitted by {user.user_id} for loan {loan_id}")

        # Convert Decimal to float for JSON response
        response_payment = {k: float(v) if isinstance(v, Decimal) else v for k, v in payment.items()}

        return ResponseHelper.success_response({
            'payment': response_payment,
            'message': 'Payment submitted successfully'
        })

    except Exception as e:
        logger.error(f"Error submitting payment: {str(e)}", exc_info=True)
        return ResponseHelper.internal_error_response(str(e))


def handle_list_payments_by_loan(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle GET /payments/loan/{loan_id} - List all payments for a loan.
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)

        # Extract loan_id from path
        path_params = event.get('pathParameters', {})
        loan_id = path_params.get('loan_id') if path_params else None

        if not loan_id:
            # Try to extract from path directly
            path = event.get('path', '')
            match = re.search(r'/payments/loan/([^/]+)', path)
            if match:
                loan_id = match.group(1)

        if not loan_id:
            return ResponseHelper.validation_error_response('Missing loan_id')

        # Get loan to verify access
        loan = DynamoDBHelper.get_item(TABLE_NAMES['LOANS'], {'loan_id': loan_id})
        if not loan:
            return ResponseHelper.not_found_response('Loan not found')

        # Verify user has access (borrower or lender on this loan)
        is_borrower = loan['borrower_id'] == user.user_id
        is_lender = False

        if not is_borrower:
            # Check if user is a lender on this loan
            participants = DynamoDBHelper.query_items(
                TABLE_NAMES['LOAN_PARTICIPANTS'],
                'loan_id = :loan_id',
                {':loan_id': loan_id}
            )
            is_lender = any(p.get('lender_id') == user.user_id for p in participants)

        if not is_borrower and not is_lender:
            return ResponseHelper.forbidden_response('Not authorized to view payments for this loan')

        # Query payments by loan
        payments = DynamoDBHelper.query_items(
            TABLE_NAMES['PAYMENTS'],
            'loan_id = :loan_id',
            {':loan_id': loan_id},
            index_name='LoanIndex'
        )

        # If user is a lender, only show their payments
        if is_lender and not is_borrower:
            payments = [p for p in payments if p.get('lender_id') == user.user_id]

        # Sort by created_at desc
        payments.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        # Convert Decimal to float
        response_payments = []
        for payment in payments:
            response_payment = {k: float(v) if isinstance(v, Decimal) else v for k, v in payment.items()}
            response_payments.append(response_payment)

        return ResponseHelper.success_response({
            'payments': response_payments
        })

    except Exception as e:
        logger.error(f"Error listing payments: {str(e)}", exc_info=True)
        return ResponseHelper.internal_error_response(str(e))


def handle_get_payment(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle GET /payments/{payment_id} - Get payment details.
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)

        # Extract payment_id from path
        path_params = event.get('pathParameters', {})
        payment_id = path_params.get('payment_id') if path_params else None

        if not payment_id:
            # Try to extract from path directly
            path = event.get('path', '')
            match = re.search(r'/payments/([^/]+)$', path)
            if match:
                payment_id = match.group(1)

        if not payment_id:
            return ResponseHelper.validation_error_response('Missing payment_id')

        # Get payment
        payment = DynamoDBHelper.get_item(TABLE_NAMES['PAYMENTS'], {'payment_id': payment_id})
        if not payment:
            return ResponseHelper.not_found_response('Payment not found')

        # Verify user has access (borrower or lender)
        if user.user_id not in [payment['borrower_id'], payment['lender_id']]:
            return ResponseHelper.forbidden_response('Not authorized to view this payment')

        # Convert Decimal to float
        response_payment = {k: float(v) if isinstance(v, Decimal) else v for k, v in payment.items()}

        return ResponseHelper.success_response({
            'payment': response_payment
        })

    except Exception as e:
        logger.error(f"Error getting payment: {str(e)}", exc_info=True)
        return ResponseHelper.internal_error_response(str(e))


def handle_approve_payment(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle PUT /payments/{payment_id}/approve - Lender approves payment.
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)

        # Extract payment_id from path
        path_params = event.get('pathParameters', {})
        payment_id = path_params.get('payment_id') if path_params else None

        if not payment_id:
            # Try to extract from path
            path = event.get('path', '')
            match = re.search(r'/payments/([^/]+)/approve', path)
            if match:
                payment_id = match.group(1)

        if not payment_id:
            return ResponseHelper.validation_error_response('Missing payment_id')

        # Parse request body for optional notes
        body = json.loads(event.get('body', '{}'))
        approval_notes = body.get('approval_notes', '')

        # Get payment
        payment = DynamoDBHelper.get_item(TABLE_NAMES['PAYMENTS'], {'payment_id': payment_id})
        if not payment:
            return ResponseHelper.not_found_response('Payment not found')

        # Verify user is the lender
        if payment['lender_id'] != user.user_id:
            return ResponseHelper.forbidden_response('Only the lender can approve this payment')

        # Verify status is PENDING
        if payment['status'] != PaymentStatus.PENDING:
            return ResponseHelper.validation_error_response(f'Payment status is {payment["status"]}, cannot approve')

        # Update payment status with optional notes
        now = datetime.now(timezone.utc).isoformat()
        update_expression = 'SET #status = :status, updated_at = :updated_at'
        expression_values = {
            ':status': PaymentStatus.APPROVED,
            ':updated_at': now
        }

        if approval_notes:
            update_expression += ', approval_notes = :notes'
            expression_values[':notes'] = approval_notes

        DynamoDBHelper.update_item(
            TABLE_NAMES['PAYMENTS'],
            {'payment_id': payment_id},
            update_expression,
            expression_values,
            {
                '#status': 'status'
            }
        )

        # Update participant's total_paid and remaining_balance
        participant_key = {
            'loan_id': payment['loan_id'],
            'lender_id': payment['lender_id']
        }

        participant = DynamoDBHelper.get_item(TABLE_NAMES['LOAN_PARTICIPANTS'], participant_key)
        if participant:
            current_total_paid = Decimal(str(participant.get('total_paid', 0)))
            payment_amount = Decimal(str(payment['amount']))
            new_total_paid = current_total_paid + payment_amount

            contribution = Decimal(str(participant['contribution_amount']))
            new_remaining = contribution - new_total_paid

            DynamoDBHelper.update_item(
                TABLE_NAMES['LOAN_PARTICIPANTS'],
                participant_key,
                'SET total_paid = :total_paid, remaining_balance = :remaining_balance',
                {
                    ':total_paid': new_total_paid,
                    ':remaining_balance': new_remaining
                }
            )

        logger.info(f"Payment {payment_id} approved by {user.user_id}")

        return ResponseHelper.success_response({
            'message': 'Payment approved successfully',
            'payment_id': payment_id
        })

    except Exception as e:
        logger.error(f"Error approving payment: {str(e)}", exc_info=True)
        return ResponseHelper.internal_error_response(str(e))


def handle_reject_payment(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle PUT /payments/{payment_id}/reject - Lender rejects payment.
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)

        # Extract payment_id from path
        path_params = event.get('pathParameters', {})
        payment_id = path_params.get('payment_id') if path_params else None

        if not payment_id:
            # Try to extract from path
            path = event.get('path', '')
            match = re.search(r'/payments/([^/]+)/reject', path)
            if match:
                payment_id = match.group(1)

        if not payment_id:
            return ResponseHelper.validation_error_response('Missing payment_id')

        # Parse request body
        body = json.loads(event.get('body', '{}'))
        rejection_reason = body.get('rejection_reason', '')

        if not rejection_reason:
            return ResponseHelper.validation_error_response('Rejection reason is required')

        # Get payment
        payment = DynamoDBHelper.get_item(TABLE_NAMES['PAYMENTS'], {'payment_id': payment_id})
        if not payment:
            return ResponseHelper.not_found_response('Payment not found')

        # Verify user is the lender
        if payment['lender_id'] != user.user_id:
            return ResponseHelper.forbidden_response('Only the lender can reject this payment')

        # Verify status is PENDING
        if payment['status'] != PaymentStatus.PENDING:
            return ResponseHelper.validation_error_response(f'Payment status is {payment["status"]}, cannot reject')

        # Update payment status
        now = datetime.now(timezone.utc).isoformat()
        DynamoDBHelper.update_item(
            TABLE_NAMES['PAYMENTS'],
            {'payment_id': payment_id},
            'SET #status = :status, rejection_reason = :reason, updated_at = :updated_at',
            {
                ':status': PaymentStatus.REJECTED,
                ':reason': rejection_reason,
                ':updated_at': now
            },
            {
                '#status': 'status'
            }
        )

        logger.info(f"Payment {payment_id} rejected by {user.user_id}")

        return ResponseHelper.success_response({
            'message': 'Payment rejected successfully',
            'payment_id': payment_id
        })

    except Exception as e:
        logger.error(f"Error rejecting payment: {str(e)}", exc_info=True)
        return ResponseHelper.internal_error_response(str(e))


def handle_get_upload_url(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle POST /payments/receipt-upload-url - Generate presigned upload URL.
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)

        # Parse request body
        body = json.loads(event.get('body', '{}'))
        loan_id = body.get('loan_id')
        lender_id = body.get('lender_id')
        file_name = body.get('file_name')
        file_type = body.get('file_type')

        if not all([loan_id, lender_id, file_name, file_type]):
            return ResponseHelper.validation_error_response('Missing required fields')

        # Validate file type (basic validation)
        allowed_types = ['application/pdf', 'image/jpeg', 'image/png']
        if file_type not in allowed_types:
            return ResponseHelper.validation_error_response('Invalid file type. Allowed: PDF, JPG, PNG')

        # Get loan to verify user is borrower
        loan = DynamoDBHelper.get_item(TABLE_NAMES['LOANS'], {'loan_id': loan_id})
        if not loan:
            return ResponseHelper.not_found_response('Loan not found')

        if loan['borrower_id'] != user.user_id:
            return ResponseHelper.forbidden_response('Only the borrower can upload receipts')

        # Generate payment_id and S3 key
        payment_id = UUIDHelper.generate_uuid()
        # Sanitize filename: remove path separators and special chars
        safe_filename = file_name.replace('/', '_').replace('\\', '_')
        file_key = f"{loan_id}/{lender_id}/{payment_id}/{safe_filename}"

        # Generate presigned URL (15 minutes expiration)
        presigned_url = s3_client.generate_presigned_url(
            ClientMethod='put_object',
            Params={
                'Bucket': RECEIPTS_BUCKET,
                'Key': file_key,
                'ContentType': file_type
            },
            ExpiresIn=900,  # 15 minutes
            HttpMethod='PUT'
        )

        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()

        logger.info(f"Generated upload URL for {user.user_id}, loan {loan_id}")

        return ResponseHelper.success_response({
            'upload_url': presigned_url,
            'file_key': file_key,
            'payment_id': payment_id,
            'expires_at': expires_at
        })

    except Exception as e:
        logger.error(f"Error generating upload URL: {str(e)}", exc_info=True)
        return ResponseHelper.internal_error_response(str(e))


def handle_get_receipt_url(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle GET /payments/{payment_id}/receipt-url - Generate presigned view URL.
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)

        # Extract payment_id from path
        path_params = event.get('pathParameters', {})
        payment_id = path_params.get('payment_id') if path_params else None

        if not payment_id:
            # Try to extract from path
            path = event.get('path', '')
            match = re.search(r'/payments/([^/]+)/receipt-url', path)
            if match:
                payment_id = match.group(1)

        if not payment_id:
            return ResponseHelper.validation_error_response('Missing payment_id')

        # Get payment
        payment = DynamoDBHelper.get_item(TABLE_NAMES['PAYMENTS'], {'payment_id': payment_id})
        if not payment:
            return ResponseHelper.not_found_response('Payment not found')

        # Verify user has access (borrower or lender)
        if user.user_id not in [payment['borrower_id'], payment['lender_id']]:
            return ResponseHelper.forbidden_response('Not authorized to view this receipt')

        # Check if receipt exists
        receipt_key = payment.get('receipt_key')
        if not receipt_key:
            return ResponseHelper.not_found_response('No receipt uploaded for this payment')

        # Generate presigned GET URL (1 hour expiration)
        presigned_url = s3_client.generate_presigned_url(
            ClientMethod='get_object',
            Params={
                'Bucket': RECEIPTS_BUCKET,
                'Key': receipt_key
            },
            ExpiresIn=3600,  # 1 hour
            HttpMethod='GET'
        )

        expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

        logger.info(f"Generated view URL for payment {payment_id} by {user.user_id}")

        return ResponseHelper.success_response({
            'url': presigned_url,
            'expires_at': expires_at
        })

    except Exception as e:
        logger.error(f"Error generating receipt URL: {str(e)}", exc_info=True)
        return ResponseHelper.internal_error_response(str(e))
