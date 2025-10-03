"""
Validation schemas and helper functions using Pydantic.
"""
import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, validator, Field
from email_validator import validate_email, EmailNotValidError


# User validation models
class RegisterUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="User's full name")
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=8, description="User's password")
    
    @validator('password')
    def validate_password(cls, v):
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @validator('email', pre=True)
    def validate_email_format(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


class LoginUserRequest(BaseModel):
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=1, description="User's password")
    
    @validator('email', pre=True)
    def validate_email_format(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


# Loan validation models
class LenderInviteRequest(BaseModel):
    email: EmailStr = Field(..., description="Lender's email address")
    contribution_amount: float = Field(..., gt=0, description="Lender's contribution amount")
    
    @validator('email', pre=True)
    def validate_email_format(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


class MaturityTermsRequest(BaseModel):
    start_date: str = Field(..., description="Payment start date (YYYY-MM-DD)")
    payment_frequency: str = Field(..., description="Payment frequency")
    term_length: int = Field(..., ge=1, le=60, description="Term length in months")
    
    @validator('payment_frequency')
    def validate_payment_frequency(cls, v):
        valid_frequencies = ['Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Annually']
        if v not in valid_frequencies:
            raise ValueError(f"Payment frequency must be one of: {', '.join(valid_frequencies)}")
        return v
    
    @validator('start_date')
    def validate_start_date(cls, v):
        from datetime import datetime
        try:
            start_date = datetime.fromisoformat(v)
            today = datetime.now().date()
            if start_date.date() < today:
                raise ValueError("Start date cannot be in the past")
            return v
        except ValueError as e:
            if "Start date cannot be in the past" in str(e):
                raise e
            raise ValueError("Invalid date format. Use YYYY-MM-DD")


class EntityDetails(BaseModel):
    entity_name: Optional[str] = Field(None, min_length=1, max_length=200, description="Business entity name")
    entity_type: Optional[str] = Field(None, description="Type of business entity")
    entity_tax_id: Optional[str] = Field(None, max_length=50, description="Entity tax ID or EIN")
    borrower_relationship: Optional[str] = Field(None, description="Borrower's relationship to the entity")
    
    @validator('entity_type')
    def validate_entity_type(cls, v):
        if v is not None:
            valid_types = ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship']
            if v not in valid_types:
                raise ValueError(f"Entity type must be one of: {', '.join(valid_types)}")
        return v
    
    @validator('borrower_relationship')
    def validate_borrower_relationship(cls, v):
        if v is not None:
            valid_relationships = ['Owner', 'Officer', 'Manager', 'Partner']
            if v not in valid_relationships:
                raise ValueError(f"Borrower relationship must be one of: {', '.join(valid_relationships)}")
        return v


class CreateLoanRequest(BaseModel):
    amount: float = Field(..., ge=1000, le=1000000, description="Loan amount")
    interest_rate: float = Field(..., ge=0.01, le=50, description="Interest rate percentage")
    maturity_terms: MaturityTermsRequest = Field(..., description="Maturity terms")
    purpose: str = Field(..., min_length=1, max_length=100, description="Loan purpose")
    description: str = Field(..., min_length=10, max_length=1000, description="Loan description")
    lenders: List[LenderInviteRequest] = Field(..., min_items=1, description="List of lender invitations")
    entity_details: Optional[EntityDetails] = Field(None, description="Business entity details (required when purpose is Business)")
    
    @validator('lenders')
    def validate_contributions_sum(cls, v, values):
        if 'amount' in values:
            total_contributions = sum(lender.contribution_amount for lender in v)
            if abs(total_contributions - values['amount']) > 0.01:
                raise ValueError(f"Total contributions ({total_contributions}) must equal loan amount ({values['amount']})")
        return v
    
    @validator('entity_details')
    def validate_entity_details_for_business(cls, v, values):
        if 'purpose' in values and values['purpose'] == 'Business':
            if v is None or not v.entity_name or not v.entity_type or not v.borrower_relationship:
                raise ValueError("Entity name, type, and borrower relationship are required for business loans")
        return v


# Lender validation models
class AcceptLoanRequest(BaseModel):
    bank_name: str = Field(..., min_length=1, max_length=100, description="Bank name")
    account_type: str = Field(..., pattern=r'^(checking|savings)$', description="Account type")
    routing_number: str = Field(..., pattern=r'^\d{9}$', description="9-digit routing number")
    account_number: str = Field(..., min_length=4, max_length=20, pattern=r'^\d+$', description="Account number")
    special_instructions: Optional[str] = Field(None, max_length=500, description="Special instructions")


# Common validation models
class PaginationRequest(BaseModel):
    limit: int = Field(20, ge=1, le=100, description="Number of items per page")
    offset: int = Field(0, ge=0, description="Number of items to skip")


# Validation helper class
class ValidationHelper:
    """Helper class for validation operations."""
    
    @staticmethod
    def validate_request_body(model_class: BaseModel, body: Dict[str, Any]):
        """
        Validate request body against Pydantic model.
        
        Args:
            model_class: Pydantic model class
            body: Request body dictionary
            
        Returns:
            Validated model instance
            
        Raises:
            ValueError: If validation fails
        """
        try:
            return model_class(**body)
        except Exception as e:
            raise ValueError(f"Validation failed: {str(e)}")
    
    @staticmethod
    def validate_path_param(value: Optional[str], param_name: str) -> str:
        """
        Validate path parameter exists.
        
        Args:
            value: Parameter value
            param_name: Parameter name for error messages
            
        Returns:
            Validated parameter value
            
        Raises:
            ValueError: If parameter is missing
        """
        if not value:
            raise ValueError(f"Missing required parameter: {param_name}")
        return value
    
    @staticmethod
    def validate_uuid_param(value: Optional[str], param_name: str) -> str:
        """
        Validate UUID path parameter.
        
        Args:
            value: Parameter value
            param_name: Parameter name for error messages
            
        Returns:
            Validated UUID string
            
        Raises:
            ValueError: If parameter is missing or invalid UUID format
        """
        param = ValidationHelper.validate_path_param(value, param_name)
        
        # Basic UUID format validation
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        if not re.match(uuid_pattern, param, re.IGNORECASE):
            raise ValueError(f"Invalid {param_name}: must be a valid UUID")
        
        return param
    
    @staticmethod
    def validate_query_params(query_params: Dict[str, str], model_class: BaseModel):
        """
        Validate query parameters against Pydantic model.
        
        Args:
            query_params: Query parameters dictionary
            model_class: Pydantic model class
            
        Returns:
            Validated model instance
            
        Raises:
            ValueError: If validation fails
        """
        try:
            # Convert string values to appropriate types
            processed_params = {}
            
            for key, value in query_params.items():
                if value is not None:
                    # Try to parse numbers
                    if value.isdigit():
                        processed_params[key] = int(value)
                    elif value.replace('.', '').isdigit():
                        processed_params[key] = float(value)
                    else:
                        processed_params[key] = value
            
            return model_class(**processed_params)
        except Exception as e:
            raise ValueError(f"Query parameter validation failed: {str(e)}")
    
    @staticmethod
    def sanitize_string(input_str: str) -> str:
        """
        Sanitize user input by removing potentially dangerous characters.
        
        Args:
            input_str: Input string to sanitize
            
        Returns:
            Sanitized string
        """
        # Remove HTML tags and quotes
        sanitized = re.sub(r'[<>\'"]', '', input_str)
        return sanitized.strip()
    
    @staticmethod
    def validate_email_format(email: str) -> str:
        """
        Validate email format and normalize.
        
        Args:
            email: Email address to validate
            
        Returns:
            Normalized email address
            
        Raises:
            ValueError: If email format is invalid
        """
        try:
            validated_email = validate_email(email)
            return validated_email.email.lower()
        except EmailNotValidError:
            raise ValueError("Invalid email format")
    
    @staticmethod
    def validate_loan_contributions(total_amount: float, contributions: List[Dict[str, Any]]) -> None:
        """
        Validate that loan contributions sum to total amount.
        
        Args:
            total_amount: Total loan amount
            contributions: List of contribution dictionaries
            
        Raises:
            ValueError: If contributions don't sum to total amount
        """
        total_contributions = sum(contrib.get('contribution_amount', 0) for contrib in contributions)
        
        if abs(total_contributions - total_amount) > 0.01:  # Allow for small floating point differences
            raise ValueError(f"Total contributions ({total_contributions}) must equal loan amount ({total_amount})")


# Export commonly used validation functions
__all__ = [
    'RegisterUserRequest',
    'LoginUserRequest',
    'CreateLoanRequest',
    'EntityDetails',
    'LenderInviteRequest',
    'AcceptLoanRequest',
    'PaginationRequest',
    'ValidationHelper'
]