"""
JWT authentication utilities for the marketplace backend.
"""
import os
import logging
from typing import Dict, Any, Optional
import jwt
from datetime import datetime, timedelta

# Configure logging
logger = logging.getLogger(__name__)

JWT_SECRET = os.environ['JWT_SECRET']
JWT_EXPIRES_IN_HOURS = 24


class JWTPayload:
    """JWT payload data structure."""
    
    def __init__(self, user_id: str, email: str, is_borrower: bool, is_lender: bool):
        self.user_id = user_id
        self.email = email
        self.is_borrower = is_borrower
        self.is_lender = is_lender


class AuthenticatedUser:
    """Authenticated user data structure."""
    
    def __init__(self, user_id: str, email: str, is_borrower: bool, is_lender: bool):
        self.user_id = user_id
        self.email = email
        self.is_borrower = is_borrower
        self.is_lender = is_lender


class JWTAuth:
    """JWT authentication helper class."""
    
    @staticmethod
    def generate_token(user_id: str, email: str, is_borrower: bool, is_lender: bool) -> str:
        """
        Generate a JWT token for a user.
        
        Args:
            user_id: User's unique identifier
            email: User's email address
            is_borrower: Whether user has borrower role
            is_lender: Whether user has lender role
            
        Returns:
            JWT token string
            
        Raises:
            Exception: If token generation fails
        """
        try:
            payload = {
                'user_id': user_id,
                'email': email,
                'is_borrower': is_borrower,
                'is_lender': is_lender,
                'iat': datetime.utcnow(),
                'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRES_IN_HOURS),
                'iss': 'marketplace-api'
            }
            
            return jwt.encode(payload, JWT_SECRET, algorithm='HS256')
        except Exception as e:
            logger.error(f"JWT Generation Error: {e}")
            raise Exception("Token generation failed")
    
    @staticmethod
    def verify_token(token: str) -> JWTPayload:
        """
        Verify and decode a JWT token.
        
        Args:
            token: JWT token string
            
        Returns:
            Decoded JWT payload
            
        Raises:
            Exception: If token verification fails
        """
        try:
            decoded = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=['HS256'],
                issuer='marketplace-api'
            )
            
            return JWTPayload(
                user_id=decoded['user_id'],
                email=decoded['email'],
                is_borrower=decoded['is_borrower'],
                is_lender=decoded['is_lender']
            )
        except jwt.ExpiredSignatureError:
            logger.error("JWT token has expired")
            raise Exception("Token has expired")
        except jwt.InvalidTokenError as e:
            logger.error(f"JWT Verification Error: {e}")
            raise Exception("Invalid token")
    
    @staticmethod
    def extract_token_from_header(auth_header: Optional[str]) -> str:
        """
        Extract JWT token from Authorization header.
        
        Args:
            auth_header: Authorization header value
            
        Returns:
            JWT token string
            
        Raises:
            Exception: If header is missing or invalid format
        """
        if not auth_header:
            raise Exception("Authorization header missing")
        
        parts = auth_header.split(' ')
        if len(parts) != 2 or parts[0] != 'Bearer':
            raise Exception("Invalid authorization header format")
        
        return parts[1]
    
    @staticmethod
    def authenticate_user(event: Dict[str, Any]) -> AuthenticatedUser:
        """
        Authenticate user from API Gateway event.
        
        Args:
            event: API Gateway event dictionary
            
        Returns:
            Authenticated user object
            
        Raises:
            Exception: If authentication fails
        """
        try:
            headers = event.get('headers', {})
            auth_header = headers.get('Authorization') or headers.get('authorization')
            
            token = JWTAuth.extract_token_from_header(auth_header)
            payload = JWTAuth.verify_token(token)
            
            return AuthenticatedUser(
                user_id=payload.user_id,
                email=payload.email,
                is_borrower=payload.is_borrower,
                is_lender=payload.is_lender
            )
        except Exception as e:
            logger.error(f"Authentication Error: {e}")
            raise Exception("Authentication failed")
    
    @staticmethod
    def require_role(user: AuthenticatedUser, role: str) -> None:
        """
        Check if user has required role.
        
        Args:
            user: Authenticated user object
            role: Required role ('borrower' or 'lender')
            
        Raises:
            Exception: If user doesn't have required role
        """
        has_role = user.is_borrower if role == 'borrower' else user.is_lender
        
        if not has_role:
            raise Exception(f"Insufficient permissions: {role} role required")
    
    @staticmethod
    def create_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create standardized API Gateway response.
        
        Args:
            status_code: HTTP status code
            body: Response body dictionary
            
        Returns:
            API Gateway response dictionary
        """
        import json
        
        return {
            'statusCode': status_code,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            'body': json.dumps(body)
        }
    
    @staticmethod
    def with_auth(handler_func, required_role: Optional[str] = None):
        """
        Decorator for Lambda handlers that require authentication.
        
        Args:
            handler_func: Lambda handler function
            required_role: Required role ('borrower' or 'lender', optional)
            
        Returns:
            Decorated handler function
        """
        def wrapper(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
            try:
                user = JWTAuth.authenticate_user(event)
                
                if required_role:
                    JWTAuth.require_role(user, required_role)
                
                return handler_func(event, context, user)
            except Exception as e:
                logger.error(f"Auth Middleware Error: {e}")
                return JWTAuth.create_response(401, {
                    'error': 'UNAUTHORIZED',
                    'message': str(e)
                })
        
        return wrapper