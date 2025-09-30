"""
Date and time utilities.
"""
from datetime import datetime, timezone


class DateHelper:
    """Helper class for date operations."""
    
    @staticmethod
    def get_current_timestamp() -> str:
        """
        Get current timestamp in ISO format.
        
        Returns:
            ISO formatted timestamp string
        """
        return datetime.now(timezone.utc).isoformat()
    
    @staticmethod
    def parse_timestamp(timestamp_str: str) -> datetime:
        """
        Parse ISO timestamp string to datetime object.
        
        Args:
            timestamp_str: ISO formatted timestamp string
            
        Returns:
            datetime object
            
        Raises:
            ValueError: If timestamp format is invalid
        """
        try:
            return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except ValueError as e:
            raise ValueError(f"Invalid timestamp format: {e}")
    
    @staticmethod
    def format_timestamp(dt: datetime) -> str:
        """
        Format datetime object to ISO string.
        
        Args:
            dt: datetime object
            
        Returns:
            ISO formatted timestamp string
        """
        return dt.isoformat()