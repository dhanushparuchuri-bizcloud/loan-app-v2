"""
API response helper utilities.
"""
import json
import logging
from decimal import Decimal
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def decimal_default(obj):
    """JSON encoder function to handle Decimal types."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


class ResponseHelper:
    """Helper class for creating standardized API responses."""
    
    @staticmethod
    def create_response(
        status_code: int,
        body: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Create standardized API Gateway response.
        
        Args:
            status_code: HTTP status code
            body: Response body dictionary
            headers: Additional headers (optional)
            
        Returns:
            API Gateway response dictionary
        """
        default_headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        }
        
        if headers:
            default_headers.update(headers)
        
        return {
            'statusCode': status_code,
            'headers': default_headers,
            'body': json.dumps(body, default=decimal_default)
        }
    
    @staticmethod
    def success_response(data: Any, message: Optional[str] = None) -> Dict[str, Any]:
        """
        Create success response.
        
        Args:
            data: Response data
            message: Optional success message
            
        Returns:
            Success response dictionary
        """
        body = {
            'success': True,
            'data': data
        }
        
        if message:
            body['message'] = message
        
        return ResponseHelper.create_response(200, body)
    
    @staticmethod
    def error_response(
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Create error response.
        
        Args:
            status_code: HTTP status code
            error_code: Error code identifier
            message: Error message
            details: Optional error details
            
        Returns:
            Error response dictionary
        """
        body = {
            'success': False,
            'error': error_code,
            'message': message
        }
        
        if details:
            body['details'] = details
        
        return ResponseHelper.create_response(status_code, body)
    
    @staticmethod
    def validation_error_response(message: str) -> Dict[str, Any]:
        """
        Create validation error response.
        
        Args:
            message: Validation error message
            
        Returns:
            Validation error response dictionary
        """
        return ResponseHelper.error_response(400, 'VALIDATION_ERROR', message)
    
    @staticmethod
    def unauthorized_response(message: str = "Authentication required") -> Dict[str, Any]:
        """
        Create unauthorized error response.
        
        Args:
            message: Unauthorized error message
            
        Returns:
            Unauthorized error response dictionary
        """
        return ResponseHelper.error_response(401, 'UNAUTHORIZED', message)
    
    @staticmethod
    def forbidden_response(message: str = "Access denied") -> Dict[str, Any]:
        """
        Create forbidden error response.
        
        Args:
            message: Forbidden error message
            
        Returns:
            Forbidden error response dictionary
        """
        return ResponseHelper.error_response(403, 'FORBIDDEN', message)
    
    @staticmethod
    def not_found_response(message: str = "Resource not found") -> Dict[str, Any]:
        """
        Create not found error response.
        
        Args:
            message: Not found error message
            
        Returns:
            Not found error response dictionary
        """
        return ResponseHelper.error_response(404, 'NOT_FOUND', message)
    
    @staticmethod
    def internal_error_response(message: str = "Internal server error") -> Dict[str, Any]:
        """
        Create internal server error response.
        
        Args:
            message: Internal error message
            
        Returns:
            Internal server error response dictionary
        """
        return ResponseHelper.error_response(500, 'INTERNAL_ERROR', message)
    
    @staticmethod
    def handle_exception(e: Exception) -> Dict[str, Any]:
        """
        Handle exception and create appropriate error response.
        
        Args:
            e: Exception to handle
            
        Returns:
            Error response dictionary
        """
        error_message = str(e)
        logger.error(f"Exception occurred: {error_message}")
        
        # Map common exceptions to appropriate HTTP status codes
        if "validation" in error_message.lower():
            return ResponseHelper.validation_error_response(error_message)
        elif "authentication" in error_message.lower() or "unauthorized" in error_message.lower():
            return ResponseHelper.unauthorized_response(error_message)
        elif "permission" in error_message.lower() or "forbidden" in error_message.lower():
            return ResponseHelper.forbidden_response(error_message)
        elif "not found" in error_message.lower():
            return ResponseHelper.not_found_response(error_message)
        else:
            return ResponseHelper.internal_error_response("An unexpected error occurred")