"""
Type definitions and data models for the marketplace backend.
"""
from typing import Dict, List, Optional, Any, Literal
from dataclasses import dataclass
from datetime import datetime


# Database entity types
@dataclass
class User:
    user_id: str
    email: str
    name: str
    password_hash: str
    is_borrower: bool
    is_lender: bool
    user_type: Literal['BORROWER_ONLY', 'ACTIVE_LENDER']
    created_at: str
    status: Literal['ACTIVE', 'INACTIVE']


@dataclass
class MaturityTerms:
    start_date: str
    payment_frequency: Literal['Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Annually']
    term_length: int  # months
    maturity_date: str
    total_payments: int


@dataclass
class LenderPaymentDetails:
    contribution_amount: float
    payment_amount: float
    total_interest: float
    total_repayment: float
    payment_schedule: Optional[List[str]] = None


@dataclass
class Loan:
    loan_id: str
    borrower_id: str
    amount: float
    interest_rate: float
    # Enhanced maturity terms (replaces simple 'term' field)
    start_date: str
    payment_frequency: Literal['Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Annually']
    term_length: int  # months
    maturity_date: str
    total_payments: int
    purpose: str
    description: str
    status: Literal['PENDING', 'ACTIVE', 'COMPLETED']
    total_funded: float
    created_at: str


@dataclass
class LoanParticipant:
    loan_id: str
    lender_id: str
    contribution_amount: float
    status: Literal['PENDING', 'ACCEPTED', 'DECLINED']
    invited_at: str
    responded_at: Optional[str] = None


@dataclass
class Invitation:
    invitation_id: str
    inviter_id: str
    invitee_email: str
    status: Literal['PENDING', 'ACTIVATED']
    created_at: str
    activated_at: Optional[str] = None


@dataclass
class ACHDetails:
    user_id: str
    loan_id: str
    bank_name: str
    account_type: Literal['checking', 'savings']
    routing_number: str
    account_number: str
    special_instructions: Optional[str]
    created_at: str


# API response types
@dataclass
class AuthResponse:
    success: bool
    token: Optional[str] = None
    user: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class LoanResponse:
    success: bool
    loan: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class LoanDetails:
    loan_id: str
    borrower_id: str
    amount: float
    interest_rate: float
    # Enhanced maturity terms
    maturity_terms: MaturityTerms
    purpose: str
    description: str
    status: str
    total_funded: float
    created_at: str
    borrower_name: str
    participants: List[Dict[str, Any]]
    funding_progress: Dict[str, Any]
    # Lender-specific payment details (only for lender requests)
    user_participation: Optional[LenderPaymentDetails] = None


@dataclass
class LenderInvitation:
    loan_id: str
    loan_amount: float
    loan_purpose: str
    loan_description: str
    interest_rate: float
    maturity_terms: MaturityTerms
    borrower_name: str
    contribution_amount: float
    invited_at: str
    status: str


@dataclass
class AcceptResponse:
    success: bool
    loan_status: Optional[str] = None
    error: Optional[str] = None


@dataclass
class UserProfile:
    user_id: str
    email: str
    name: str
    is_borrower: bool
    is_lender: bool
    created_at: str
    status: str


@dataclass
class BorrowerStats:
    active_loans: int
    total_borrowed: float
    pending_requests: int
    average_interest_rate: float


@dataclass
class LenderStats:
    pending_invitations: int
    active_investments: int
    total_lent: float
    expected_returns: float


@dataclass
class DashboardStats:
    borrower: Optional[BorrowerStats] = None
    lender: Optional[LenderStats] = None


# Request types
@dataclass
class LenderInvite:
    email: str
    contribution_amount: float


# Error types
@dataclass
class ErrorResponse:
    error: str
    message: str
    details: Optional[Any] = None


# Common API response wrapper
@dataclass
class APIResponse:
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    message: Optional[str] = None


# Lambda handler types
@dataclass
class LambdaResponse:
    statusCode: int
    headers: Dict[str, str]
    body: str


# Database query result types
@dataclass
class QueryResult:
    items: List[Dict[str, Any]]
    last_evaluated_key: Optional[Dict[str, Any]]
    count: int


# Constants
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


class InvitationStatus:
    PENDING = 'PENDING'
    ACTIVATED = 'ACTIVATED'


class UserType:
    BORROWER_ONLY = 'BORROWER_ONLY'
    ACTIVE_LENDER = 'ACTIVE_LENDER'


class AccountType:
    CHECKING = 'checking'
    SAVINGS = 'savings'


class PaymentFrequency:
    WEEKLY = 'Weekly'
    BI_WEEKLY = 'Bi-Weekly'
    MONTHLY = 'Monthly'
    QUARTERLY = 'Quarterly'
    ANNUALLY = 'Annually'