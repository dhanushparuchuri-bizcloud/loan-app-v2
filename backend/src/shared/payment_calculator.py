"""
Payment Calculator for Private Lending Platform
Uses proper amortization formulas for installment loans with regular payments.
"""
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import Dict, List, Any, Optional
from decimal import Decimal, ROUND_HALF_UP
import logging

logger = logging.getLogger(__name__)

class PaymentCalculator:
    """
    Handles all payment calculations for the private lending platform.
    Uses industry-standard amortization formulas for installment loans.
    """
    
    # Payment frequency mappings
    PAYMENT_FREQUENCIES = {
        'Weekly': 52,
        'Bi-Weekly': 26,
        'Monthly': 12,
        'Quarterly': 4,
        'Annually': 1
    }
    
    @staticmethod
    def calculate_loan_terms(
        start_date: str,
        payment_frequency: str,
        term_length: int
    ) -> Dict[str, Any]:
        """
        Calculate loan-level terms that are the same for all lenders.
        
        Args:
            start_date: When payments begin (ISO format: '2024-01-15')
            payment_frequency: 'Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Annually'
            term_length: Duration in months
            
        Returns:
            Dict containing maturity_date, total_payments, payment_schedule
        """
        try:
            start = datetime.fromisoformat(start_date)
            
            # Calculate maturity date (add months to start date)
            maturity = start + relativedelta(months=term_length)
            
            # Calculate total number of payments
            payments_per_year = PaymentCalculator.PAYMENT_FREQUENCIES[payment_frequency]
            years = term_length / 12
            total_payments = round(payments_per_year * years)
            
            # Generate payment schedule dates
            payment_schedule = PaymentCalculator._generate_payment_schedule(
                start_date, payment_frequency, total_payments
            )
            
            return {
                'maturity_date': maturity.date().isoformat(),
                'total_payments': total_payments,
                'payment_schedule': payment_schedule
            }
            
        except Exception as e:
            logger.error(f"Error calculating loan terms: {str(e)}")
            raise ValueError(f"Invalid loan terms: {str(e)}")
    
    @staticmethod
    def calculate_lender_payments(
        contribution_amount: float,
        annual_rate: float,
        total_payments: int,
        payment_frequency: str
    ) -> Dict[str, float]:
        """
        Calculate payment details for a specific lender based on their contribution.
        Uses proper amortization formula for installment loans.

        Args:
            contribution_amount: Lender's contribution to the loan
            annual_rate: Annual interest rate (e.g., 0.085 for 8.5%)
            total_payments: Total number of payments
            payment_frequency: Payment frequency string

        Returns:
            Dict containing payment_amount, total_interest, total_repayment
        """
        try:
            if contribution_amount <= 0:
                raise ValueError("Contribution amount must be positive")
            if annual_rate <= 0:
                raise ValueError("Interest rate must be positive")
            if total_payments <= 0:
                raise ValueError("Total payments must be positive")
            
            # Convert annual rate to periodic rate
            payments_per_year = PaymentCalculator.PAYMENT_FREQUENCIES[payment_frequency]
            periodic_rate = annual_rate / payments_per_year
            
            # Calculate payment using amortization formula
            # PMT = P * [r * (1 + r)^n] / [(1 + r)^n - 1]
            if periodic_rate == 0:
                # Handle 0% interest rate edge case
                payment_amount = contribution_amount / total_payments
            else:
                numerator = periodic_rate * ((1 + periodic_rate) ** total_payments)
                denominator = ((1 + periodic_rate) ** total_payments) - 1
                payment_amount = contribution_amount * (numerator / denominator)
            
            # Round to nearest cent
            payment_amount = round(payment_amount, 2)
            
            # Calculate totals
            total_repayment = payment_amount * total_payments
            total_interest = total_repayment - contribution_amount
            
            return {
                'payment_amount': payment_amount,
                'total_interest': round(total_interest, 2),
                'total_repayment': round(total_repayment, 2)
            }
            
        except Exception as e:
            logger.error(f"Error calculating lender payments: {str(e)}")
            raise ValueError(f"Invalid payment calculation: {str(e)}")
    
    @staticmethod
    def generate_lender_amortization_schedule(
        contribution_amount: float,
        payment_amount: float,
        annual_rate: float,
        payment_frequency: str,
        total_payments: int,
        payment_schedule: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Generate individual amortization schedule for a specific lender.
        
        Args:
            contribution_amount: Lender's principal amount
            payment_amount: Lender's payment amount per period
            annual_rate: Annual interest rate
            payment_frequency: Payment frequency
            total_payments: Total number of payments
            payment_schedule: List of payment dates
            
        Returns:
            List of payment records with principal/interest breakdown
        """
        try:
            # Convert annual rate to periodic rate
            payments_per_year = PaymentCalculator.PAYMENT_FREQUENCIES[payment_frequency]
            periodic_rate = annual_rate / payments_per_year
            
            schedule = []
            balance = float(contribution_amount)
            cumulative_interest = 0.0
            cumulative_principal = 0.0
            
            for payment_num in range(1, total_payments + 1):
                # Calculate interest for this period
                interest = balance * periodic_rate
                
                # Calculate principal payment
                principal = payment_amount - interest
                
                # For the final payment, adjust to pay off remaining balance exactly
                if payment_num == total_payments:
                    principal = balance
                    actual_payment = balance + interest
                else:
                    actual_payment = payment_amount
                
                # Update balance
                balance -= principal
                balance = max(balance, 0)  # Ensure balance doesn't go negative
                
                # Update cumulative totals
                cumulative_interest += interest
                cumulative_principal += principal
                
                # Get payment date
                payment_date = payment_schedule[payment_num - 1] if payment_num <= len(payment_schedule) else None
                
                schedule.append({
                    'payment_number': payment_num,
                    'payment_date': payment_date,
                    'payment_amount': round(actual_payment, 2),
                    'interest': round(interest, 2),
                    'principal': round(principal, 2),
                    'balance': round(balance, 2),
                    'cumulative_interest': round(cumulative_interest, 2),
                    'cumulative_principal': round(cumulative_principal, 2)
                })
            
            return schedule
            
        except Exception as e:
            logger.error(f"Error generating amortization schedule: {str(e)}")
            raise ValueError(f"Invalid amortization schedule: {str(e)}")
    
    @staticmethod
    def calculate_borrower_total_payment(
        lender_payments: List[Dict[str, float]]
    ) -> Dict[str, float]:
        """
        Calculate the total payment the borrower needs to make.
        This is the sum of all lender payments.
        
        Args:
            lender_payments: List of lender payment dictionaries
            
        Returns:
            Dict with total payment amounts
        """
        try:
            total_payment_amount = sum(lender['payment_amount'] for lender in lender_payments)
            total_repayment = sum(lender['total_repayment'] for lender in lender_payments)
            total_interest = sum(lender['total_interest'] for lender in lender_payments)
            
            return {
                'total_payment_amount': round(total_payment_amount, 2),
                'total_repayment': round(total_repayment, 2),
                'total_interest': round(total_interest, 2)
            }
            
        except Exception as e:
            logger.error(f"Error calculating borrower total: {str(e)}")
            raise ValueError(f"Invalid borrower calculation: {str(e)}")
    
    @staticmethod
    def _generate_payment_schedule(
        start_date: str,
        payment_frequency: str,
        total_payments: int
    ) -> List[str]:
        """
        Generate list of payment dates based on frequency and start date.
        
        Args:
            start_date: Start date in ISO format
            payment_frequency: Payment frequency
            total_payments: Number of payments to generate
            
        Returns:
            List of payment dates in ISO format
        """
        try:
            start = datetime.fromisoformat(start_date)
            payment_dates = []
            
            for payment_num in range(total_payments):
                if payment_frequency == 'Weekly':
                    payment_date = start + timedelta(weeks=payment_num)
                elif payment_frequency == 'Bi-Weekly':
                    payment_date = start + timedelta(weeks=payment_num * 2)
                elif payment_frequency == 'Monthly':
                    payment_date = start + relativedelta(months=payment_num)
                elif payment_frequency == 'Quarterly':
                    payment_date = start + relativedelta(months=payment_num * 3)
                elif payment_frequency == 'Annually':
                    payment_date = start + relativedelta(years=payment_num)
                else:
                    raise ValueError(f"Unsupported payment frequency: {payment_frequency}")
                
                payment_dates.append(payment_date.date().isoformat())
            
            return payment_dates
            
        except Exception as e:
            logger.error(f"Error generating payment schedule: {str(e)}")
            raise ValueError(f"Invalid payment schedule: {str(e)}")
    
    @staticmethod
    def validate_maturity_terms(
        start_date: str,
        payment_frequency: str,
        term_length: int
    ) -> List[str]:
        """
        Validate maturity terms and return any validation errors.
        
        Args:
            start_date: Start date in ISO format
            payment_frequency: Payment frequency
            term_length: Term length in months
            
        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []
        
        try:
            # Validate start date
            start = datetime.fromisoformat(start_date)
            if start.date() < datetime.now().date():
                errors.append("Start date cannot be in the past")
        except ValueError:
            errors.append("Invalid start date format")
        
        # Validate payment frequency
        if payment_frequency not in PaymentCalculator.PAYMENT_FREQUENCIES:
            errors.append(f"Invalid payment frequency: {payment_frequency}")
        
        # Validate term length
        if term_length < 1 or term_length > 60:
            errors.append("Term length must be between 1 and 60 months")
        
        # Validate reasonable payment combinations
        if payment_frequency in PaymentCalculator.PAYMENT_FREQUENCIES:
            payments_per_year = PaymentCalculator.PAYMENT_FREQUENCIES[payment_frequency]
            total_payments = round((term_length / 12) * payments_per_year)
            
            max_payments = {
                'Weekly': 260,    # 5 years max
                'Bi-Weekly': 130, # 5 years max
                'Monthly': 60,    # 5 years max
                'Quarterly': 20,  # 5 years max
                'Annually': 5     # 5 years max
            }
            
            if total_payments > max_payments[payment_frequency]:
                errors.append(f"Too many {payment_frequency.lower()} payments for term length")
        
        return errors


# Example usage and testing
if __name__ == "__main__":
    # Test the calculator with example values
    try:
        # Example: $50,000 loan, 8.5% APR, 24 months, monthly payments
        # Lender A: $20,000, Lender B: $30,000
        
        # Calculate loan-level terms
        loan_terms = PaymentCalculator.calculate_loan_terms(
            start_date='2024-01-15',
            payment_frequency='Monthly',
            term_length=24
        )
        print("Loan Terms:", loan_terms)
        
        # Calculate Lender A payments ($20,000)
        lender_a = PaymentCalculator.calculate_lender_payments(
            contribution_amount=20000,
            annual_rate=0.085,
            total_payments=loan_terms['total_payments'],
            payment_frequency='Monthly'
        )
        print("Lender A Payments:", lender_a)

        # Calculate Lender B payments ($30,000)
        lender_b = PaymentCalculator.calculate_lender_payments(
            contribution_amount=30000,
            annual_rate=0.085,
            total_payments=loan_terms['total_payments'],
            payment_frequency='Monthly'
        )
        print("Lender B Payments:", lender_b)
        
        # Calculate borrower total
        borrower_total = PaymentCalculator.calculate_borrower_total_payment([lender_a, lender_b])
        print("Borrower Total:", borrower_total)
        
        # Generate amortization schedule for Lender A
        schedule_a = PaymentCalculator.generate_lender_amortization_schedule(
            contribution_amount=20000,
            payment_amount=lender_a['payment_amount'],
            annual_rate=0.085,
            payment_frequency='Monthly',
            total_payments=loan_terms['total_payments'],
            payment_schedule=loan_terms['payment_schedule']
        )
        print("Lender A Schedule (first 3 payments):", schedule_a[:3])
        
    except Exception as e:
        print(f"Error: {e}")