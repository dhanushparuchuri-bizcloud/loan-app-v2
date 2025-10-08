// API client for the private lending backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev'

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API Client] ${message}`, data ? data : '')
  },
  error: (message: string, error?: any) => {
    console.error(`[API Client Error] ${message}`, error ? error : '')
  },
  warn: (message: string, data?: any) => {
    console.warn(`[API Client Warning] ${message}`, data ? data : '')
  }
}

export interface User {
  user_id: string
  email: string
  name: string
  is_borrower: boolean
  is_lender: boolean
  user_type: string
  status: string
  created_at: string
}

// Auth response formats (based on actual API responses)
export interface RegisterResponse {
  success: boolean
  token: string
  user: User
  message?: string
}

export interface LoginResponse {
  success: boolean
  data: {
    success: boolean
    token: string
    user: User
  }
  message?: string
}

// Profile response format
export interface ProfileResponse {
  success: boolean
  data: User
  message?: string
}

// Dashboard response formats
export interface BorrowerStats {
  active_loans: number
  total_borrowed: number
  pending_requests: number
  average_interest_rate: number
}

export interface LenderStats {
  pending_invitations: number
  active_investments: number
  total_lent: number
  expected_returns: number
}

export interface DashboardResponse {
  success: boolean
  data: {
    borrower?: BorrowerStats
    lender?: LenderStats
  }
  message?: string
}

// Payment Calculator interfaces
export interface MaturityTerms {
  start_date: string
  payment_frequency: string
  term_length: number
  maturity_date: string
  total_payments: number
}

export interface LenderPaymentDetails {
  lender_id: string
  lender_name: string
  lender_email: string
  contribution_amount: number
  payment_amount: number
  status: string
  ach_details?: ACHDetails
}

export interface BorrowerPaymentDetails {
  total_payment_amount: number
  payment_frequency: string
  total_payments: number
  payment_dates: string[]
  lender_payments: LenderPaymentDetails[]
  disclaimer: string
}

export interface UserParticipation {
  lender_id: string
  contribution_amount: number
  status: string
  invited_at: string
  responded_at?: string | null
  payment_amount: number
  total_interest: number
  total_repayment: number
  disclaimer: string
}

// Loan interfaces
export interface FundingProgress {
  total_amount: number
  total_funded: number
  remaining_amount: number
  funding_percentage: number
  is_fully_funded: boolean
  // Privacy protection: participant counts removed for lenders
  total_participants?: number
  accepted_participants?: number
  pending_participants?: number
  pending_amount?: number
}

export interface LoanParticipant {
  lender_id: string
  lender_name: string
  lender_email: string
  contribution_amount: number
  status: string
  invited_at: string
  responded_at?: string | null
  ach_details?: ACHDetails
}

export interface Loan {
  loan_id: string
  loan_name: string
  borrower_id: string
  borrower_name: string
  amount: number
  purpose: string
  description: string
  interest_rate: number
  maturity_terms: MaturityTerms
  status: string
  created_at: string
  total_funded: number
  // Privacy protection: participants array empty for lenders
  participants: LoanParticipant[]
  // Enhanced participation data with payment calculations
  user_participation?: UserParticipation | null
  // Borrower payment details (only for borrowers)
  borrower_payment_details?: BorrowerPaymentDetails | null
  funding_progress: FundingProgress
  // Entity details for business loans
  entity_name?: string | null
  entity_type?: string | null
  entity_tax_id?: string | null
  borrower_relationship?: string | null
}

export interface LoanSummary {
  loan_id: string
  loan_name: string
  amount: number
  interest_rate: number
  term: string
  purpose: string
  description: string
  status: string
  total_funded: number
  created_at: string
  participant_count: number
  accepted_participants: number
  funding_progress: FundingProgress
  participants?: Array<{
    lender_id: string
    lender_name?: string
    lender_email?: string
    contribution_amount: number
    status: string
  }>
}

export interface CreateLoanResponse {
  success: boolean
  loan: {
    loan_id: string
    loan_name: string
    borrower_id: string
    amount: number
    interest_rate: number
    maturity_terms: MaturityTerms
    purpose: string
    description: string
    status: string
    total_funded: number
    created_at: string
    invitations_created: number
    participants_created: number
  }
  message?: string
}

export interface MyLoansResponse {
  success: boolean
  data: {
    loans: LoanSummary[]
    total_count: number
  }
  message?: string
}

export interface LoanDetailsResponse {
  success: boolean
  data: Loan
  message?: string
}

export interface ACHDetails {
  bank_name: string
  account_type: string
  routing_number: string
  account_number: string
  special_instructions?: string
}

export interface CreateLoanRequest {
  loan_name: string
  amount: number
  purpose: string
  description: string
  interest_rate: number
  maturity_terms: {
    start_date: string
    payment_frequency: string
    term_length: number
  }
  lenders?: Array<{
    email: string
    contribution_amount: number
  }>
  entity_details?: {
    entity_name: string
    entity_type: string
    entity_tax_id?: string | null
    borrower_relationship: string
  }
}

export interface AddLendersRequest {
  lenders: Array<{
    email: string
    contribution_amount: number
  }>
}

export interface AddLendersResponse {
  success: boolean
  data: {
    loan_id: string
    lenders_added: number
    invitations_created: number
    participants_created: number
    total_invited: number
    remaining: number
    is_fully_invited: boolean
  }
  message?: string
}

export interface AcceptLoanRequest {
  bank_name: string
  account_type: string
  routing_number: string
  account_number: string
  special_instructions?: string
}

export interface AcceptLoanResponse {
  success: boolean
  data: {
    loan_id: string
    status: string
    loan_status: string
    contribution_amount: number
    accepted_at: string
  }
  message?: string
}

export interface PendingInvitationsResponse {
  success: boolean
  data: {
    invitations: any[]
    total_count: number
  }
  message?: string
}

export interface PortfolioItem {
  loan_id: string
  borrower_name: string
  loan_amount: number
  contribution_amount: number
  interest_rate: number
  term: string
  purpose: string
  description: string
  loan_status: 'PENDING' | 'ACTIVE' | 'COMPLETED'
  participation_status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  invited_at: string
  responded_at?: string
  total_funded: number
  funding_percentage: number
  expected_annual_return: number
  expected_monthly_return: number
  created_at: string
  // New payment calculation fields
  payment_amount?: number
  total_interest?: number
  total_repayment?: number
  maturity_terms?: MaturityTerms
}

export interface LenderPortfolioResponse {
  success: boolean
  data: {
    portfolio: PortfolioItem[]
    total_count: number
    summary: {
      total_invested: number
      total_expected_returns: number
      pending_invitations: number
      active_investments: number
    }
  }
  message?: string
}

// Error response format
export interface ApiError {
  success: false
  error: string
  message: string
  details?: any
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor() {
    this.baseUrl = API_BASE_URL
    // Try to get token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token')
    }
    log.info('API Client initialized', { baseUrl: this.baseUrl })
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token)
    }
    log.info('Token set successfully')
  }

  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
    }
    log.info('Token cleared')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const config: RequestInit = {
      ...options,
      headers,
    }

    log.info(`Making ${options.method || 'GET'} request to ${endpoint}`)

    try {
      const response = await fetch(url, config)
      const responseData = await response.json()
      
      log.info(`Response from ${endpoint}:`, {
        status: response.status,
        success: responseData.success,
        hasData: !!responseData.data,
        hasToken: !!responseData.token
      })

      if (!response.ok) {
        log.error(`HTTP error ${response.status} from ${endpoint}`, responseData)
        throw new Error(responseData.message || `HTTP error! status: ${response.status}`)
      }

      return responseData
    } catch (error) {
      log.error(`Request failed for ${endpoint}`, error)
      throw error
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<LoginResponse> {
    log.info('Attempting login', { email })
    
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    // Handle the nested response structure from login
    if (response.success && response.data?.token) {
      this.setToken(response.data.token)
      log.info('Login successful', { userId: response.data.user.user_id })
    } else {
      log.error('Login failed - no token in response', response)
    }

    return response
  }

  async register(name: string, email: string, password: string): Promise<RegisterResponse> {
    log.info('Attempting registration', { name, email })
    
    const response = await this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })

    if (response.success && response.token) {
      this.setToken(response.token)
      log.info('Registration successful', { userId: response.user.user_id })
    } else {
      log.error('Registration failed - no token in response', response)
    }

    return response
  }

  // User endpoints
  async getProfile(): Promise<ProfileResponse> {
    log.info('Fetching user profile')
    return this.request<ProfileResponse>('/user/profile')
  }

  async getDashboard(): Promise<DashboardResponse> {
    log.info('Fetching dashboard data')
    return this.request<DashboardResponse>('/user/dashboard')
  }

  // Loan endpoints
  async createLoan(loanData: CreateLoanRequest): Promise<CreateLoanResponse> {
    log.info('Creating loan', {
      amount: loanData.amount,
      lendersCount: loanData.lenders?.length || 0
    })

    return this.request<CreateLoanResponse>('/loans', {
      method: 'POST',
      body: JSON.stringify(loanData),
    })
  }

  async addLendersToLoan(loanId: string, lendersData: AddLendersRequest): Promise<AddLendersResponse> {
    log.info('Adding lenders to loan', {
      loanId,
      lendersCount: lendersData.lenders.length
    })

    return this.request<AddLendersResponse>(`/loans/${loanId}/lenders`, {
      method: 'POST',
      body: JSON.stringify(lendersData),
    })
  }

  async getMyLoans(): Promise<MyLoansResponse> {
    log.info('Fetching my loans')
    return this.request<MyLoansResponse>('/loans/my-loans')
  }

  async getLoanDetails(loanId: string): Promise<LoanDetailsResponse> {
    log.info('Fetching loan details', { loanId })
    return this.request<LoanDetailsResponse>(`/loans/${loanId}`)
  }

  // Lender endpoints
  async getPendingInvitations(): Promise<PendingInvitationsResponse> {
    log.info('Fetching pending invitations')
    return this.request<PendingInvitationsResponse>('/lender/pending')
  }

  async acceptLoanInvitation(loanId: string, achDetails: AcceptLoanRequest): Promise<AcceptLoanResponse> {
    log.info('Accepting loan invitation', { loanId, bankName: achDetails.bank_name })
    
    return this.request<AcceptLoanResponse>(`/lender/accept/${loanId}`, {
      method: 'PUT',
      body: JSON.stringify(achDetails),
    })
  }

  async getLenderDashboard(): Promise<DashboardResponse> {
    log.info('Fetching lender dashboard')
    // For now, use the regular dashboard endpoint which includes lender stats
    return this.request<DashboardResponse>('/user/dashboard')
  }

  async getLenderPortfolio(): Promise<LenderPortfolioResponse> {
    log.info('Fetching lender portfolio')
    return this.request<LenderPortfolioResponse>('/user/lender-portfolio')
  }
}

export const apiClient = new ApiClient()