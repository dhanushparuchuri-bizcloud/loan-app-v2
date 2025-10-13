"""
Custom exceptions for the marketplace backend.
Provides specific exception types for better error handling and debugging.
"""
import logging

logger = logging.getLogger(__name__)


class MarketplaceException(Exception):
    """Base exception for all marketplace-specific errors."""
    pass


class DatabaseThrottledException(MarketplaceException):
    """
    Raised when DynamoDB throttles requests due to capacity limits.
    Should result in 429 Too Many Requests response with retry-after header.
    """
    def __init__(self, message="Database request rate exceeded. Please retry after a short delay.", retry_after=5):
        self.retry_after = retry_after
        super().__init__(message)


class DatabaseUnavailableException(MarketplaceException):
    """
    Raised when DynamoDB or other database services are temporarily unavailable.
    Should result in 503 Service Unavailable response with retry-after header.
    """
    def __init__(self, message="Database temporarily unavailable. Please retry.", retry_after=10):
        self.retry_after = retry_after
        super().__init__(message)


class InvalidPaginationTokenException(MarketplaceException):
    """
    Raised when pagination token is invalid or corrupted.
    Should result in 400 Bad Request response.
    """
    def __init__(self, message="Invalid pagination token. Please start from the beginning."):
        super().__init__(message)


class ResourceNotFoundException(MarketplaceException):
    """
    Raised when a requested resource is not found.
    Should result in 404 Not Found response.
    """
    pass


class ValidationException(MarketplaceException):
    """
    Raised when input validation fails.
    Should result in 400 Bad Request response.
    """
    pass


class AuthenticationException(MarketplaceException):
    """
    Raised when authentication fails.
    Should result in 401 Unauthorized response.
    """
    pass


class AuthorizationException(MarketplaceException):
    """
    Raised when user lacks required permissions.
    Should result in 403 Forbidden response.
    """
    pass


# Export commonly used exceptions
__all__ = [
    'MarketplaceException',
    'DatabaseThrottledException',
    'DatabaseUnavailableException',
    'InvalidPaginationTokenException',
    'ResourceNotFoundException',
    'ValidationException',
    'AuthenticationException',
    'AuthorizationException'
]
