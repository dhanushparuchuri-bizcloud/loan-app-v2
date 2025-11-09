import type {
  UserRolesData,
  Notification,
  ApiResponse,
  BorrowerLoan,
  AdminLoan,
  CreateLoanRequest,
  CreateLoanResponse,
  DbError,
  LoanDetail,
  LoanLender,
  Repayment,
  LoanNotification,
  BorrowerInfo,
  AcceptInvitationRequest,
  InviteLenderRequest,
  InviteLenderResponse,
  CurrentAllocation,
  AvailableLendersResponse,
  AvailableLender,
  SubmitPaymentRequest,
  SubmitPaymentResponse,
  SystemUser,
  CreateUserRequest,
  UpdateUserRequest,
  UserRole,
  LenderLoanPortfolio,
} from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || ""

// Helper function to make API calls with proper headers
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "X-User-Email": userEmail,
        "X-Active-Role": activeRole,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return { data, error: null }
  } catch (error) {
    console.error("[v0] API call failed:", error)
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Fetch user's available roles
// If currentRole is null/undefined, backend will default to user's primary_role
export async function fetchUserRoles(userEmail: string, currentRole?: string | null): Promise<ApiResponse<UserRolesData>> {
  try {
    // Build headers - only include X-Active-Role if explicitly provided
    const headers: Record<string, string> = {
      "X-User-Email": userEmail,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    }

    // Only add X-Active-Role if currentRole is provided
    // If not provided, backend will default to user's primary_role from database
    if (currentRole) {
      headers["X-Active-Role"] = currentRole
    }

    // CRITICAL FIX: PostgREST RPC functions should use GET, not POST
    // The schema comment says "Usage: GET /rpc/my_available_roles"
    const response = await fetch(`${API_URL}/rpc/my_available_roles`, {
      method: "GET",
      headers,
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return { data: null, error: "No roles found" }
    }

    // PostgREST returns array, extract first item
    return { data: data[0], error: null }
  } catch (error) {
    console.error("[API] fetchUserRoles failed:", error)
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Fetch unread notifications
export async function fetchNotifications(userEmail: string, activeRole: string): Promise<ApiResponse<Notification[]>> {
  return apiCall<Notification[]>(
    "/notifications?recipient_email=eq." +
      userEmail +
      "&is_read=eq.false&select=id,subject,body,notification_type,created_at&order=created_at.desc&limit=5",
    {},
    userEmail,
    activeRole,
  )
}

// Mark notification as read
export async function markNotificationRead(
  notificationId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<Notification>> {
  const result = await apiCall<Notification[]>(
    `/notifications?id=eq.${notificationId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        is_read: true,
        read_at: new Date().toISOString(),
      }),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to update notification" }
  }

  return { data: result.data[0], error: null }
}

// Fetch borrower loans
export async function fetchBorrowerLoans(
  userEmail: string,
  activeRole: string,
  statusFilter?: string,
): Promise<ApiResponse<BorrowerLoan[]>> {
  let endpoint = "/loan_summary?select=*&order=created_at.desc"

  if (statusFilter && statusFilter !== "all") {
    endpoint += `&status=eq.${statusFilter}`
  }

  return apiCall<BorrowerLoan[]>(endpoint, {}, userEmail, activeRole)
}

// Fetch admin loans with borrower info
export async function fetchAdminLoans(
  userEmail: string,
  activeRole: string,
  statusFilter?: string,
): Promise<ApiResponse<AdminLoan[]>> {
  // Use the loan_summary view which already has aggregated counts and borrower info
  let endpoint = "/loan_summary?select=*&order=created_at.desc"

  if (statusFilter && statusFilter !== "all") {
    endpoint += `&status=eq.${statusFilter}`
  }

  const result = await apiCall<AdminLoan[]>(endpoint, {}, userEmail, activeRole)

  // Map borrower fields from view columns to nested object structure
  if (result.data && result.data.length > 0) {
    result.data = result.data.map((loan) => ({
      ...loan,
      borrower: {
        full_name: loan.borrower_name,
        email: loan.borrower_email,
        is_active: loan.borrower_is_active
      }
    })) as AdminLoan[]
  }

  return result
}

export async function createLoan(
  loanData: CreateLoanRequest,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<CreateLoanResponse>> {
  const result = await apiCall<CreateLoanResponse[]>(
    "/loans",
    {
      method: "POST",
      body: JSON.stringify(loanData),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to create loan" }
  }

  // PostgREST returns array, extract first item
  return { data: result.data[0], error: null }
}

export function parseDbError(error: DbError): string {
  if (error.code === "23505") {
    return "A loan with this name already exists. Please choose a different name."
  }
  if (error.code === "23514") {
    if (error.message.includes("principal_amount")) {
      return "Principal amount must be between $0.01 and $100,000,000"
    }
    if (error.message.includes("interest_rate")) {
      return "Interest rate must be between 0% and 100%"
    }
    if (error.message.includes("valid_business_loan")) {
      return "Business entity name is required for business loans"
    }
    if (error.message.includes("valid_dates")) {
      return "Maturity date must be after origination date"
    }
  }
  return error.message || "An unexpected error occurred"
}

export async function fetchLoanDetail(
  loanId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<LoanDetail>> {
  const result = await apiCall<LoanDetail[]>(`/loans?id=eq.${loanId}&select=*`, {}, userEmail, activeRole)

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Loan not found" }
  }

  return { data: result.data[0], error: null }
}

/**
 * Update loan status (direct PATCH to loans table)
 * Allows borrowers to change loan status: draft -> pending -> active
 */
export async function updateLoanStatus(
  loanId: string,
  newStatus: "draft" | "pending" | "active" | "completed" | "partially_completed",
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<LoanDetail>> {
  try {
    const response = await fetch(`${API_URL}/loans?id=eq.${loanId}`, {
      method: "PATCH",
      headers: {
        "X-User-Email": userEmail,
        "X-Active-Role": activeRole,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { data: null, error: `Failed to update status: ${errorText}` }
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return { data: null, error: "Failed to update loan status" }
    }

    return { data: data[0], error: null }
  } catch (error) {
    console.error("[API] updateLoanStatus failed:", error)
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function fetchLoanLenders(
  loanId: string,
  userEmail: string,
  activeRole: string,
  lenderEmail?: string,
): Promise<ApiResponse<LoanLender[]>> {
  let endpoint = `/loan_lenders?loan_id=eq.${loanId}&order=invited_at.asc`

  if (lenderEmail) {
    endpoint += `&lender_email=eq.${lenderEmail}`
  }

  return apiCall<LoanLender[]>(endpoint, {}, userEmail, activeRole)
}

export async function fetchLoanRepayments(
  loanId: string,
  userEmail: string,
  activeRole: string,
  lenderEmail?: string,
): Promise<ApiResponse<Repayment[]>> {
  let endpoint = `/repayments?loan_id=eq.${loanId}&order=submitted_at.desc`

  if (lenderEmail) {
    endpoint += `&lender_email=eq.${lenderEmail}`
  }

  return apiCall<Repayment[]>(endpoint, {}, userEmail, activeRole)
}

export async function fetchLoanNotifications(
  loanId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<LoanNotification[]>> {
  return apiCall<LoanNotification[]>(
    `/notifications?loan_id=eq.${loanId}&order=created_at.desc&limit=50`,
    {},
    userEmail,
    activeRole,
  )
}

export async function fetchBorrowerInfo(
  borrowerId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<BorrowerInfo>> {
  const result = await apiCall<BorrowerInfo[]>(
    `/users?id=eq.${borrowerId}&select=id,full_name,email`,
    {},
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Borrower not found" }
  }

  return { data: result.data[0], error: null }
}

export async function revokeLenderInvitation(
  loanLenderId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<LoanLender>> {
  const result = await apiCall<LoanLender[]>(
    `/loan_lenders?id=eq.${loanLenderId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        invitation_status: "revoked",
        responded_at: new Date().toISOString(), // Required by CHECK constraint
      }),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to revoke invitation" }
  }

  return { data: result.data[0], error: null }
}

export async function acceptLenderInvitation(
  loanLenderId: string,
  acceptData: AcceptInvitationRequest,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<LoanLender>> {
  const result = await apiCall<LoanLender[]>(
    `/loan_lenders?id=eq.${loanLenderId}`,
    {
      method: "PATCH",
      body: JSON.stringify(acceptData),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to accept invitation" }
  }

  return { data: result.data[0], error: null }
}

export async function declineLenderInvitation(
  loanLenderId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<LoanLender>> {
  const result = await apiCall<LoanLender[]>(
    `/loan_lenders?id=eq.${loanLenderId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        invitation_status: "declined",
        responded_at: new Date().toISOString(),
      }),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to decline invitation" }
  }

  return { data: result.data[0], error: null }
}

export async function fetchCurrentAllocation(
  loanId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<number>> {
  const result = await apiCall<CurrentAllocation[]>(
    `/loan_lenders?loan_id=eq.${loanId}&invitation_status=not.in.(declined,revoked)&select=allocated_amount`,
    {},
    userEmail,
    activeRole,
  )

  if (result.error) {
    return { data: null, error: result.error }
  }

  // Sum all allocated amounts
  const totalAllocated = (result.data || []).reduce(
    (sum, lender) => sum + Number.parseFloat(lender.allocated_amount),
    0,
  )

  return { data: totalAllocated, error: null }
}

export async function checkExistingInvitation(
  loanId: string,
  lenderEmail: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<boolean>> {
  const result = await apiCall<LoanLender[]>(
    `/loan_lenders?loan_id=eq.${loanId}&lender_email=eq.${lenderEmail}`,
    {},
    userEmail,
    activeRole,
  )

  if (result.error) {
    return { data: false, error: result.error }
  }

  return { data: (result.data || []).length > 0, error: null }
}

export async function inviteLender(
  inviteData: InviteLenderRequest,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<InviteLenderResponse>> {
  const result = await apiCall<InviteLenderResponse[]>(
    "/loan_lenders",
    {
      method: "POST",
      body: JSON.stringify(inviteData),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to send invitation" }
  }

  return { data: result.data[0], error: null }
}

export async function fetchAvailableLenders(
  loanId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<AvailableLendersResponse>> {
  const result = await apiCall<AvailableLender[]>(
    `/loan_lenders?loan_id=eq.${loanId}&invitation_status=eq.accepted&remaining_balance=gt.0&select=id,lender_email,allocated_amount,remaining_balance`,
    {},
    userEmail,
    activeRole,
  )

  if (result.error) {
    return { data: null, error: result.error }
  }

  const lenders = result.data || []
  const availableLenders = lenders.filter((lender) => Number.parseFloat(lender.remaining_balance) > 0)

  if (availableLenders.length === 0) {
    return {
      data: {
        available: false,
        message: "No lenders available for payment. All accepted lenders have been fully repaid.",
        lenders: [],
      },
      error: null,
    }
  }

  return {
    data: {
      available: true,
      lenders: availableLenders,
    },
    error: null,
  }
}

export async function submitPayment(
  paymentData: SubmitPaymentRequest,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<SubmitPaymentResponse>> {
  const result = await apiCall<SubmitPaymentResponse[]>(
    "/repayments",
    {
      method: "POST",
      body: JSON.stringify(paymentData),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to submit payment" }
  }

  return { data: result.data[0], error: null }
}

export async function fetchPendingRepayments(
  lenderEmail: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<Repayment[]>> {
  return apiCall<Repayment[]>(
    `/repayments?lender_email=eq.${lenderEmail}&status=eq.pending&order=submitted_at.desc`,
    {},
    userEmail,
    activeRole,
  )
}

export async function fetchLoanDetailsForRepayment(
  loanId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<{ id: string; loan_name: string; borrower_id: string }>> {
  const result = await apiCall<{ id: string; loan_name: string; borrower_id: string }[]>(
    `/loans?id=eq.${loanId}&select=id,loan_name,borrower_id`,
    {},
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Loan not found" }
  }

  return { data: result.data[0], error: null }
}

export async function fetchBorrowerDetailsForRepayment(
  borrowerId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<{ id: string; full_name: string; email: string }>> {
  const result = await apiCall<{ id: string; full_name: string; email: string }[]>(
    `/users?id=eq.${borrowerId}&select=id,full_name,email`,
    {},
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Borrower not found" }
  }

  return { data: result.data[0], error: null }
}

export async function reviewRepayment(
  repaymentId: string,
  reviewData: {
    status: "approved" | "rejected"
    reviewed_by: string
    reviewed_at: string
    review_notes?: string
  },
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<Repayment>> {
  const result = await apiCall<Repayment[]>(
    `/repayments?id=eq.${repaymentId}`,
    {
      method: "PATCH",
      body: JSON.stringify(reviewData),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to review payment" }
  }

  return { data: result.data[0], error: null }
}

export async function fetchPendingInvitations(
  lenderEmail: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<LoanLender[]>> {
  return apiCall<LoanLender[]>(
    `/loan_lenders?lender_email=eq.${encodeURIComponent(lenderEmail)}&invitation_status=eq.pending&order=invited_at.desc`,
    {},
    userEmail,
    activeRole,
  )
}

export async function fetchInvitationById(
  invitationId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<LoanLender>> {
  const result = await apiCall<LoanLender[]>(`/loan_lenders?id=eq.${invitationId}`, {}, userEmail, activeRole)

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Invitation not found" }
  }

  return { data: result.data[0], error: null }
}

export async function fetchUsers(
  userEmail: string,
  activeRole: string,
  filters?: {
    role?: UserRole
    isActive?: boolean
    searchTerm?: string
    includeDeleted?: boolean
  },
): Promise<ApiResponse<SystemUser[]>> {
  let endpoint = "/users?order=created_at.desc"

  // Exclude soft-deleted users by default
  if (!filters?.includeDeleted) {
    endpoint += "&deleted_at=is.null"
  }

  // Filter by role
  if (filters?.role) {
    endpoint += `&role=eq.${filters.role}`
  }

  // Filter by active status
  if (filters?.isActive !== undefined) {
    endpoint += `&is_active=eq.${filters.isActive}`
  }

  // Search by email or name
  if (filters?.searchTerm) {
    const term = encodeURIComponent(filters.searchTerm)
    endpoint += `&or=(email.ilike.*${term}*,full_name.ilike.*${term}*)`
  }

  return apiCall<SystemUser[]>(endpoint, {}, userEmail, activeRole)
}

export async function createUser(
  userData: CreateUserRequest,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<SystemUser>> {
  const result = await apiCall<SystemUser[]>(
    "/users",
    {
      method: "POST",
      body: JSON.stringify(userData),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to create user" }
  }

  return { data: result.data[0], error: null }
}

export async function updateUser(
  userId: string,
  userData: UpdateUserRequest,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<SystemUser>> {
  const result = await apiCall<SystemUser[]>(
    `/users?id=eq.${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify(userData),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to update user" }
  }

  return { data: result.data[0], error: null }
}

export async function softDeleteUser(
  userId: string,
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<SystemUser>> {
  const result = await apiCall<SystemUser[]>(
    `/users?id=eq.${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        deleted_at: new Date().toISOString(),
        is_active: false,
      }),
    },
    userEmail,
    activeRole,
  )

  if (result.error || !result.data || result.data.length === 0) {
    return { data: null, error: result.error || "Failed to delete user" }
  }

  return { data: result.data[0], error: null }
}

export async function fetchLenderPortfolio(
  lenderEmail: string,
  userEmail: string,
  activeRole: string,
  filters?: {
    invitationStatus?: "pending" | "accepted" | "declined" | "revoked"
    loanStatus?: "draft" | "pending" | "active" | "partially_completed" | "completed" | "cancelled"
  },
): Promise<ApiResponse<LenderLoanPortfolio[]>> {
  let endpoint = `/lender_loan_portfolio?lender_email=eq.${encodeURIComponent(lenderEmail)}&order=invited_at.desc`

  if (filters?.invitationStatus) {
    endpoint += `&invitation_status=eq.${filters.invitationStatus}`
  }

  if (filters?.loanStatus) {
    endpoint += `&loan_status=eq.${filters.loanStatus}`
  }

  return apiCall<LenderLoanPortfolio[]>(endpoint, {}, userEmail, activeRole)
}

export async function fetchLenderRepayments(
  lenderEmail: string,
  userEmail: string,
  activeRole: string,
  limit?: number,
): Promise<ApiResponse<Repayment[]>> {
  let endpoint = `/repayments?lender_email=eq.${encodeURIComponent(lenderEmail)}&order=submitted_at.desc`

  if (limit) {
    endpoint += `&limit=${limit}`
  }

  return apiCall<Repayment[]>(endpoint, {}, userEmail, activeRole)
}

export async function fetchUnreadNotificationCount(
  userEmail: string,
  activeRole: string,
): Promise<ApiResponse<number>> {
  try {
    const response = await fetch(`${API_URL}/rpc/unread_notification_count`, {
      method: "POST",
      headers: {
        "X-User-Email": userEmail,
        "X-Active-Role": activeRole,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const count = await response.json()
    return { data: count, error: null }
  } catch (error) {
    console.error("[v0] Failed to fetch unread notification count:", error)
    return { data: 0, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
