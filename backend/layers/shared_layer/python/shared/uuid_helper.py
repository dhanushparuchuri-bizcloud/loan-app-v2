"""
UUID generation utilities.
"""
import uuid


class UUIDHelper:
    """Helper class for UUID operations."""
    
    @staticmethod
    def generate_uuid() -> str:
        """
        Generate a new UUID4 string.
        
        Returns:
            UUID string
        """
        return str(uuid.uuid4())
    
    @staticmethod
    def is_valid_uuid(uuid_string: str) -> bool:
        """
        Check if a string is a valid UUID.
        
        Args:
            uuid_string: String to validate
            
        Returns:
            True if valid UUID, False otherwise
        """
        try:
            uuid.UUID(uuid_string)
            return True
        except ValueError:
            return False