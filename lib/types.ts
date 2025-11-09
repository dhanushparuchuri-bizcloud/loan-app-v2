export type UserRole = "admin" | "borrower" | "lender"

export interface User {
  id: string
  email: string
  full_name: string
  primary_role: UserRole
  is_active: boolean
}

export interface UserRolesData {
  primary_role: UserRole
  available_roles: UserRole[]
  current_active_role: UserRole
}

export interface Notification {
  id: string
  subject: string
  body: string
  notification_type: "loan_invitation" | "invitation_accepted" | "repayment_submitted" | "repayment_approved"
  created_at: string
  is_read: boolean
  read_at?: string
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// Helper type for numeric fields that PostgREST returns as strings
export type NumericString = string | number

export interface BorrowerLoan {
  id: string
  loan_name: string
  borrower_id: string
  principal_amount: NumericString  // PostgREST returns NUMERIC as string
  currency_code: string
  interest_rate: NumericString  // PostgREST returns NUMERIC as string
  term_months: number
  status: "draft" | "pending" | "active" | "partially_completed" | "completed" | "cancelled"
  accepted_lenders_count: number
  pending_invitations_count: number
  total_funded_amount: NumericString  // PostgREST returns NUMERIC as string
  total_remaining_balance: NumericString  // PostgREST returns NUMERIC as string
  total_repaid_amount: NumericString  // PostgREST returns NUMERIC as string
  purpose?: string
  created_at: string
  updated_at: string
}

export interface LenderLoanPortfolio {
  loan_lender_id: string
  loan_id: string
  lender_email: string
  allocated_amount: NumericString  // PostgREST returns NUMERIC as string
  remaining_balance: NumericString  // PostgREST returns NUMERIC as string
  invitation_status: "pending" | "accepted" | "declined" | "revoked"
  loan_name: string
  principal_amount: NumericString  // PostgREST returns NUMERIC as string
  interest_rate: NumericString  // PostgREST returns NUMERIC as string
  term_months: number
  loan_status: "draft" | "pending" | "active" | "partially_completed" | "completed" | "cancelled"
  borrower_email: string
  borrower_name: string
  total_paid: NumericString  // PostgREST returns NUMERIC as string
  invited_at?: string
  responded_at?: string | null
}

export interface AdminLoan {
  id: string
  loan_name: string
  borrower_id: string
  principal_amount: string  // PostgREST returns NUMERIC as string
  currency_code: string
  status: "draft" | "pending" | "active" | "partially_completed" | "completed" | "cancelled"
  interest_rate: string  // PostgREST returns NUMERIC as string
  term_months: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Borrower data comes from loan_summary view JOIN with users table
  borrower_name: string
  borrower_email: string
  borrower_is_active: boolean
  borrower: {
    full_name: string
    email: string
    is_active: boolean
  }
  // Aggregated fields from loan_summary view
  accepted_lenders_count: number
  pending_invitations_count: number
  total_funded_amount: string  // PostgREST returns NUMERIC as string
  total_remaining_balance: string  // PostgREST returns NUMERIC as string
  total_repaid_amount: string  // PostgREST returns NUMERIC as string
}

export interface DashboardStats {
  activeLoans: number
  pendingInvitations: number
  totalBorrowed: number
  totalRepaid: number
  repaidPercentage: number
}

export type LoanType = "personal" | "business"

export interface CreateLoanRequest {
  loan_name: string
  borrower_id: string
  loan_type: LoanType
  principal_amount: number
  interest_rate: number // Decimal 0-1 (not percentage)
  term_months: number
  status: "draft"
  currency_code?: string
  purpose?: string
  collateral_description?: string
  origination_date?: string // YYYY-MM-DD
  maturity_date?: string // YYYY-MM-DD
  business_entity_name?: string
  business_entity_type?: string
  business_tax_id?: string
  business_address?: string
}

export interface CreateLoanResponse {
  id: string
  borrower_id: string
  loan_name: string
  loan_type: LoanType
  principal_amount: string
  currency_code: string
  interest_rate: string
  term_months: number
  business_entity_name?: string
  business_entity_type?: string
  business_tax_id?: string
  business_address?: string
  status: string
  purpose?: string
  collateral_description?: string
  origination_date?: string
  maturity_date?: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface DbError {
  code?: string
  message: string
  details?: string
}

export interface StatusCounts {
  all: number
  draft: number
  pending: number
  active: number
  completed: number
}

export interface LoanDetail {
  id: string
  borrower_id: string
  loan_name: string
  loan_type: LoanType
  principal_amount: string
  currency_code: string
  interest_rate: string
  term_months: number
  business_entity_name?: string
  business_entity_type?: string
  business_tax_id?: string
  business_address?: string
  status: "draft" | "pending" | "active" | "partially_completed" | "completed" | "cancelled"
  purpose?: string
  collateral_description?: string
  origination_date?: string
  maturity_date?: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface LoanLender {
  id: string
  loan_id: string
  borrower_id: string
  lender_id: string
  lender_email: string
  allocated_amount: string
  currency_code: string
  remaining_balance: string
  invitation_status: "pending" | "accepted" | "declined" | "revoked"
  invited_at: string
  responded_at?: string | null
  ach_routing_number?: string | null
  ach_account_number_encrypted?: string | null
  ach_account_type?: "checking" | "savings" | null
  created_at: string
  updated_at: string
}

export interface Repayment {
  id: string
  loan_lender_id: string
  loan_id: string
  borrower_id: string
  lender_email: string
  amount: string
  currency_code: string
  principal_portion: string
  interest_portion: string
  status: "pending" | "approved" | "rejected"
  payment_method?: string
  payment_reference?: string
  payment_date: string
  payment_proof_url?: string
  submitted_by: string
  submitted_at: string
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  created_at: string
  updated_at: string
}

export interface LoanNotification extends Notification {
  loan_id?: string
  repayment_id?: string
  status: string
  sent_at: string
}

export interface BorrowerInfo {
  id: string
  full_name: string
  email: string
}

export interface AcceptInvitationRequest {
  invitation_status: "accepted"
  responded_at: string
  ach_routing_number: string
  ach_account_number_encrypted: string
  ach_account_type: "checking" | "savings"
}

export interface InviteLenderRequest {
  loan_id: string
  lender_email: string
  allocated_amount: number
  invitation_status: "pending"
}

export interface InviteLenderResponse {
  id: string
  loan_id: string
  borrower_id: string
  lender_id: string | null
  lender_email: string
  allocated_amount: string
  currency_code: string
  remaining_balance: string
  invitation_status: "pending"
  invited_at: string
  responded_at: string | null
  ach_routing_number: string | null
  ach_account_number_encrypted: string | null
  ach_account_type: "checking" | "savings" | null
  created_at: string
  updated_at: string
}

export interface CurrentAllocation {
  allocated_amount: string
}

export interface AvailableLender {
  id: string
  lender_email: string
  allocated_amount: string
  remaining_balance: string
}

export interface AvailableLendersResponse {
  available: boolean
  message?: string
  lenders: AvailableLender[]
}

export interface SubmitPaymentRequest {
  loan_lender_id: string
  loan_id: string
  amount: number
  principal_portion: number
  interest_portion: number
  payment_date: string // YYYY-MM-DD
  status: "pending"
  payment_method?: string
  payment_reference?: string
  payment_proof_url?: string
}

export interface SubmitPaymentResponse extends Repayment {}

export interface EnrichedRepayment extends Repayment {
  loan_name: string
  borrower_name: string
  borrower_email: string
}

export interface LoanDetailsForRepayment {
  id: string
  loan_name: string
  borrower_id: string
}

export interface BorrowerDetailsForRepayment {
  id: string
  full_name: string
  email: string
}

export interface ReviewRepaymentRequest {
  status: "approved" | "rejected"
  reviewed_by: string
  reviewed_at: string
  review_notes?: string
}

export interface PendingInvitation extends LoanLender {
  loan_name?: string
  borrower_name?: string
}

export interface InvitationWithLoan {
  invitation: LoanLender
  loan: LoanDetail
  borrower: BorrowerInfo
}

export interface SystemUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CreateUserRequest {
  email: string
  full_name: string
  role: UserRole
  is_active?: boolean
}

export interface UpdateUserRequest {
  full_name?: string
  role?: UserRole
  is_active?: boolean
}

export interface SoftDeleteUserRequest {
  deleted_at: string
  is_active: false
}

export interface LenderDashboardStats {
  totalAllocated: number
  totalRepaid: number
  repaymentPercentage: number
  activeLoansCount: number
  pendingInvitationsCount: number
}
