// Mock data for the lending marketplace
export interface User {
  user_id: string
  email: string
  name: string
  is_borrower: boolean
  is_lender: boolean
}

export interface Loan {
  loan_id: string
  borrower_id: string
  amount: number
  interest_rate: number
  term: string
  purpose: string
  description: string
  status: "PENDING" | "ACTIVE"
  total_funded: number
  created_at: string
}

export interface LoanParticipant {
  loan_id: string
  lender_id: string
  lender_name: string
  contribution_amount: number
  status: "PENDING" | "ACCEPTED" | "DECLINED"
  invited_at: string
  ach_details?: {
    bank_name: string
    account_type: string
    routing_number: string
    account_number: string
    special_instructions?: string
  }
}

export const mockUsers: User[] = [
  {
    user_id: "1",
    email: "john@example.com",
    name: "John Borrower",
    is_borrower: true,
    is_lender: false,
  },
  {
    user_id: "2",
    email: "jane@example.com",
    name: "Jane Lender",
    is_borrower: false,
    is_lender: true,
  },
  {
    user_id: "3",
    email: "bob@example.com",
    name: "Bob Both",
    is_borrower: true,
    is_lender: true,
  },
]

// Mock data
export const mockLoans: Loan[] = [
  {
    loan_id: "1",
    borrower_id: "1",
    amount: 50000,
    interest_rate: 8.5,
    term: "Monthly",
    purpose: "Business",
    description: "Expanding my restaurant business with new equipment",
    status: "ACTIVE",
    total_funded: 50000,
    created_at: "2024-01-15",
  },
  {
    loan_id: "2",
    borrower_id: "1",
    amount: 25000,
    interest_rate: 6.0,
    term: "Quarterly",
    purpose: "Personal",
    description: "Home renovation project",
    status: "PENDING",
    total_funded: 15000,
    created_at: "2024-02-01",
  },
  {
    loan_id: "3",
    borrower_id: "1",
    amount: 75000,
    interest_rate: 9.2,
    term: "Monthly",
    purpose: "Education",
    description: "MBA program tuition",
    status: "ACTIVE",
    total_funded: 75000,
    created_at: "2023-09-10",
  },
]

export const mockLoanParticipants: LoanParticipant[] = [
  {
    loan_id: "1",
    lender_id: "2",
    lender_name: "Jane Lender",
    contribution_amount: 30000,
    status: "ACCEPTED",
    invited_at: "2024-01-16",
    ach_details: {
      bank_name: "Chase Bank",
      account_type: "Checking",
      routing_number: "021000021",
      account_number: "1234567890",
      special_instructions: "Please process during business hours",
    },
  },
  {
    loan_id: "1",
    lender_id: "3",
    lender_name: "Bob Both",
    contribution_amount: 20000,
    status: "ACCEPTED",
    invited_at: "2024-01-16",
    ach_details: {
      bank_name: "Bank of America",
      account_type: "Savings",
      routing_number: "026009593",
      account_number: "9876543210",
    },
  },
  {
    loan_id: "2",
    lender_id: "2",
    lender_name: "Jane Lender",
    contribution_amount: 15000,
    status: "PENDING",
    invited_at: "2024-02-02",
  },
]
