"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import {
  fetchLoanDetail,
  fetchLoanLenders,
  fetchLoanRepayments,
  fetchLoanNotifications,
  fetchBorrowerInfo,
  revokeLenderInvitation,
  acceptLenderInvitation,
  declineLenderInvitation,
  markNotificationRead,
  updateLoanStatus,
} from "@/lib/api"
import type {
  LoanDetail,
  LoanLender,
  Repayment,
  LoanNotification,
  BorrowerInfo,
  AcceptInvitationRequest,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/status-badge"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Users,
  Receipt,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Building,
  Calendar,
  DollarSign,
  Check,
  Mail,
} from "lucide-react"
import {
  formatCurrency,
  formatDate,
  formatPercentage,
  formatACHRouting,
  maskACHAccount,
  maskTaxId,
  formatRelativeTime,
} from "@/lib/utils"
import { InviteLenderModal } from "@/components/invite-lender-modal"

export default function LoanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, activeRole } = useUser()
  const { toast } = useToast()
  const loanId = params.id as string

  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [lenders, setLenders] = useState<LoanLender[]>([])
  const [repayments, setRepayments] = useState<Repayment[]>([])
  const [notifications, setNotifications] = useState<LoanNotification[]>([])
  const [borrowerInfo, setBorrowerInfo] = useState<BorrowerInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  // ACH form state for lenders
  const [showACHForm, setShowACHForm] = useState(false)
  const [achRouting, setAchRouting] = useState("")
  const [achAccount, setAchAccount] = useState("")
  const [achType, setAchType] = useState<"checking" | "savings">("checking")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Revoke dialog state
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [lenderToRevoke, setLenderToRevoke] = useState<LoanLender | null>(null)

  // Decline dialog state
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)

  // Lender details dialog state
  const [lenderDetailsOpen, setLenderDetailsOpen] = useState(false)
  const [selectedLender, setSelectedLender] = useState<LoanLender | null>(null)

  // Repayment details dialog state
  const [repaymentDetailsOpen, setRepaymentDetailsOpen] = useState(false)
  const [selectedRepayment, setSelectedRepayment] = useState<Repayment | null>(null)

  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  useEffect(() => {
    if (user?.email) {
      loadLoanData()
    }
  }, [loanId, user?.email, activeRole])

  async function loadLoanData() {
    if (!user?.email) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch loan details
      const loanResult = await fetchLoanDetail(loanId, user.email, activeRole)
      if (loanResult.error || !loanResult.data) {
        setError("Loan not found or you don't have access to view it")
        setIsLoading(false)
        return
      }
      setLoan(loanResult.data)

      // Fetch lenders (borrowers see all, lenders see only themselves)
      const lenderEmail = activeRole === "lender" ? user.email : undefined
      const lendersResult = await fetchLoanLenders(loanId, user.email, activeRole, lenderEmail)
      if (lendersResult.data) {
        setLenders(lendersResult.data)

        // Check if lender has access
        if (activeRole === "lender" && lendersResult.data.length === 0) {
          setError("You don't have access to this loan")
          setIsLoading(false)
          return
        }
      }

      // Fetch repayments
      const repaymentsResult = await fetchLoanRepayments(
        loanId,
        user.email,
        activeRole,
        activeRole === "lender" ? user.email : undefined,
      )
      if (repaymentsResult.data) {
        setRepayments(repaymentsResult.data)
      }

      // Fetch notifications
      const notificationsResult = await fetchLoanNotifications(loanId, user.email, activeRole)
      if (notificationsResult.data) {
        setNotifications(notificationsResult.data)
      }

      // Fetch borrower info
      const borrowerResult = await fetchBorrowerInfo(loanResult.data.borrower_id, user.email, activeRole)
      if (borrowerResult.data) {
        setBorrowerInfo(borrowerResult.data)
      }
    } catch (err) {
      console.error("[v0] Error loading loan data:", err)
      setError("Failed to load loan details")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRevoke() {
    if (!lenderToRevoke || !user?.email) return

    setIsSubmitting(true)
    const result = await revokeLenderInvitation(lenderToRevoke.id, user.email, activeRole)
    setIsSubmitting(false)

    if (result.error) {
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Invitation revoked successfully",
      })
      setRevokeDialogOpen(false)
      setLenderToRevoke(null)
      loadLoanData()
    }
  }

  async function handleAcceptInvitation() {
    if (!user?.email || lenders.length === 0) return

    // Validate ACH form
    if (achRouting.length !== 9) {
      toast({
        title: "Validation Error",
        description: "Routing number must be 9 digits",
        variant: "destructive",
      })
      return
    }

    if (!achAccount) {
      toast({
        title: "Validation Error",
        description: "Account number is required",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    const acceptData: AcceptInvitationRequest = {
      invitation_status: "accepted",
      responded_at: new Date().toISOString(),
      ach_routing_number: achRouting,
      ach_account_number_encrypted: achAccount,
      ach_account_type: achType,
    }

    const result = await acceptLenderInvitation(lenders[0].id, acceptData, user.email, activeRole)
    setIsSubmitting(false)

    if (result.error) {
      toast({
        title: "Error",
        description: "Failed to accept invitation",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Invitation accepted successfully",
      })
      setShowACHForm(false)
      setAchRouting("")
      setAchAccount("")
      loadLoanData()
    }
  }

  async function handleDeclineInvitation() {
    if (!user?.email || lenders.length === 0) return

    setIsSubmitting(true)
    const result = await declineLenderInvitation(lenders[0].id, user.email, activeRole)
    setIsSubmitting(false)

    if (result.error) {
      toast({
        title: "Error",
        description: "Failed to decline invitation",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Invitation declined",
      })
      setDeclineDialogOpen(false)
      router.push("/dashboard")
    }
  }

  async function handleActivateLoan() {
    console.log("handleActivateLoan called")
    console.log("user:", user)
    console.log("loan:", loan)
    console.log("lenders:", lenders)

    if (!user?.email || !loan) {
      console.log("Early return: missing user or loan")
      return
    }

    // Check if at least one lender has been invited
    const totalInvited = lenders.filter(
      (l) => l.invitation_status !== "declined" && l.invitation_status !== "revoked",
    ).length

    console.log("totalInvited:", totalInvited)

    if (totalInvited === 0) {
      toast({
        title: "Cannot Activate",
        description: "You must invite at least one lender before activating the loan.",
        variant: "destructive",
      })
      alert("Cannot activate loan: You must invite at least one lender first. Click 'Invite Lenders' to get started.")
      return
    }

    const confirmed = window.confirm(
      "Are you sure you want to activate this loan? Once activated, you won't be able to edit loan details.",
    )

    console.log("confirmed:", confirmed)

    if (!confirmed) return

    setIsSubmitting(true)
    console.log("Calling updateLoanStatus with loanId:", loanId)
    const result = await updateLoanStatus(loanId, "active", user.email, activeRole)
    console.log("updateLoanStatus result:", result)
    setIsSubmitting(false)

    if (result.error) {
      console.log("Error from API:", result.error)
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Loan Activated!",
      description: "Your loan is now active and ready for lender acceptance.",
    })

    // Reload loan data to show updated status
    loadLoanData()
  }

  async function handleMarkNotificationRead(notificationId: string) {
    if (!user?.email) return

    const result = await markNotificationRead(notificationId, user.email, activeRole)
    if (result.data) {
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)))
    }
  }

  // Calculate funding stats (borrower and admin only)
  const fundingStats = loan
    ? {
        totalInvited: lenders
          .filter((l) => l.invitation_status !== "declined" && l.invitation_status !== "revoked")
          .reduce((sum, l) => sum + Number.parseFloat(l.allocated_amount), 0),
        totalFunded: lenders
          .filter((l) => l.invitation_status === "accepted")
          .reduce((sum, l) => sum + Number.parseFloat(l.allocated_amount), 0),
        totalRepaid: repayments
          .filter((r) => r.status === "approved")
          .reduce((sum, r) => sum + Number.parseFloat(r.principal_portion), 0),
        acceptedCount: lenders.filter((l) => l.invitation_status === "accepted").length,
        pendingCount: lenders.filter((l) => l.invitation_status === "pending").length,
        totalRemaining: lenders
          .filter((l) => l.invitation_status === "accepted")
          .reduce((sum, l) => sum + Number.parseFloat(l.remaining_balance), 0),
      }
    : null

  // Calculate lender's investment (lender only)
  const myParticipation = activeRole === "lender" && lenders.length > 0 ? lenders[0] : null
  const myInvestment = myParticipation
    ? {
        allocated: Number.parseFloat(myParticipation.allocated_amount),
        remaining: Number.parseFloat(myParticipation.remaining_balance),
        received:
          Number.parseFloat(myParticipation.allocated_amount) - Number.parseFloat(myParticipation.remaining_balance),
      }
    : null

  // Count pending repayments for lender
  const pendingRepaymentsCount = repayments.filter((r) => r.status === "pending").length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !loan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="w-16 h-16 text-destructive" />
        <h1 className="text-2xl font-bold">Loan Not Found</h1>
        <p className="text-muted-foreground">
          {error || "This loan doesn't exist or you don't have access to view it"}
        </p>
        <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
      </div>
    )
  }

  const principalAmount = Number.parseFloat(loan.principal_amount)

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} aria-label="Go back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold mb-2">{loan.loan_name}</h1>
            <StatusBadge type="loan" status={loan.status} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {activeRole === "borrower" && (
            <>
              {loan.status === "draft" && (
                <>
                  <Button variant="outline" onClick={() => setInviteModalOpen(true)}>
                    Invite Lenders
                  </Button>
                  <Button
                    onClick={handleActivateLoan}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Activate Loan
                  </Button>
                  <Button variant="destructive" onClick={() => toast({ title: "Coming soon" })}>
                    Delete Loan
                  </Button>
                </>
              )}
              {loan.status === "pending" && (
                <>
                  <Button onClick={() => setInviteModalOpen(true)}>Invite More Lenders</Button>
                  <Button variant="outline" onClick={() => setActiveTab("lenders")}>
                    View Invitations
                  </Button>
                </>
              )}
              {loan.status === "active" && (
                <>
                  <Button onClick={() => router.push(`/loans/${loanId}/submit-payment`)}>Submit Payment</Button>
                  <Button variant="outline" onClick={() => setInviteModalOpen(true)}>
                    Invite More Lenders
                  </Button>
                </>
              )}
              {loan.status === "partially_completed" && (
                <>
                  <Button onClick={() => router.push(`/loans/${loanId}/submit-payment`)}>Submit Payment</Button>
                  <Button variant="outline" onClick={() => setActiveTab("overview")}>
                    View Progress
                  </Button>
                </>
              )}
              {loan.status === "completed" && (
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle className="w-5 h-5" />
                  Loan Fully Repaid
                </div>
              )}
            </>
          )}

          {activeRole === "lender" && myParticipation && (
            <>
              {myParticipation.invitation_status === "pending" && (
                <>
                  <Button onClick={() => setShowACHForm(true)} className="bg-green-600 hover:bg-green-700">
                    Accept Invitation
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 bg-transparent"
                    onClick={() => setDeclineDialogOpen(true)}
                  >
                    Decline Invitation
                  </Button>
                </>
              )}
              {myParticipation.invitation_status === "accepted" && loan.status === "active" && (
                <Button onClick={() => toast({ title: "Coming soon" })}>
                  Review Pending Payments {pendingRepaymentsCount > 0 && `(${pendingRepaymentsCount})`}
                </Button>
              )}
              {myParticipation.invitation_status === "accepted" && loan.status === "completed" && (
                <div className="text-muted-foreground">This loan has been fully repaid</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lenders">Lenders</TabsTrigger>
          <TabsTrigger value="repayments">Repayments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Loan Information */}
            <Card>
              <CardHeader>
                <CardTitle>Loan Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Principal Amount</p>
                    <p className="text-lg font-semibold">{formatCurrency(principalAmount, loan.currency_code)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Interest Rate</p>
                    <p className="text-lg font-semibold">
                      {formatPercentage(Number.parseFloat(loan.interest_rate))} APR
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Term</p>
                    <p className="text-lg font-semibold">{loan.term_months} months</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <StatusBadge type="loan" status={loan.status} size="sm" />
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">{formatDate(loan.created_at)}</span>
                  </div>
                  {loan.origination_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Origination:</span>
                      <span className="font-medium">{formatDate(loan.origination_date)}</span>
                    </div>
                  )}
                  {loan.maturity_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Maturity:</span>
                      <span className="font-medium">{formatDate(loan.maturity_date)}</span>
                    </div>
                  )}
                </div>

                {loan.loan_type === "business" && (
                  <div className="pt-4 border-t space-y-3">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">
                        {loan.business_entity_name} ({loan.business_entity_type})
                      </span>
                    </div>
                    {loan.business_tax_id && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Tax ID:</span> {maskTaxId(loan.business_tax_id)}
                      </div>
                    )}
                    {loan.business_address && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Address:</span> {loan.business_address}
                      </div>
                    )}
                  </div>
                )}

                {loan.purpose && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Purpose</p>
                    <p className="text-sm">{loan.purpose}</p>
                  </div>
                )}

                {loan.collateral_description && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Collateral</p>
                    <p className="text-sm">{loan.collateral_description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Borrower Information */}
            <Card>
              <CardHeader>
                <CardTitle>Borrower Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {borrowerInfo && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Name</p>
                      <p className="font-medium">{borrowerInfo.full_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Email</p>
                      <p className="font-medium">{borrowerInfo.email}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Funding Progress (Borrower & Admin Only) */}
          {activeRole !== "lender" && fundingStats && (
            <Card>
              <CardHeader>
                <CardTitle>Funding Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Invited</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(fundingStats.totalInvited)} / {formatCurrency(principalAmount)} (
                        {((fundingStats.totalInvited / principalAmount) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={(fundingStats.totalInvited / principalAmount) * 100} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Funded</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(fundingStats.totalFunded)} / {formatCurrency(principalAmount)} (
                        {((fundingStats.totalFunded / principalAmount) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={(fundingStats.totalFunded / principalAmount) * 100} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Repaid</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(fundingStats.totalRepaid)} / {formatCurrency(principalAmount)} (
                        {((fundingStats.totalRepaid / principalAmount) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={(fundingStats.totalRepaid / principalAmount) * 100} className="h-2" />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Accepted Lenders</p>
                    <p className="text-2xl font-bold">{fundingStats.acceptedCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pending Invitations</p>
                    <p className="text-2xl font-bold">{fundingStats.pendingCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Remaining</p>
                    <p className="text-2xl font-bold">{formatCurrency(fundingStats.totalRemaining)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Completion</p>
                    <p className="text-2xl font-bold">
                      {((fundingStats.totalRepaid / principalAmount) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lender Investment (Lender Only) */}
          {activeRole === "lender" && myParticipation && myInvestment && (
            <Card>
              <CardHeader>
                <CardTitle>Your Investment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Your Investment</p>
                    <p className="text-2xl font-bold">{formatCurrency(myInvestment.allocated)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Amount Received</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(myInvestment.received)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Remaining Balance</p>
                    <p className="text-2xl font-bold">{formatCurrency(myInvestment.remaining)}</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Repayment Progress</span>
                    <span className="text-sm font-medium">
                      {((myInvestment.received / myInvestment.allocated) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={(myInvestment.received / myInvestment.allocated) * 100} className="h-2" />
                </div>

                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Invitation Status</span>
                    <StatusBadge type="invitation" status={myParticipation.invitation_status} size="sm" />
                  </div>
                  {myParticipation.responded_at && myParticipation.invitation_status === "accepted" && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Accepted On</span>
                      <span className="text-sm font-medium">{formatDate(myParticipation.responded_at)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Lenders Tab */}
        <TabsContent value="lenders" className="space-y-6">
          {activeRole === "borrower" ? (
            <>
              {/* Summary Stats */}
              {fundingStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground mb-1">Total Allocated</p>
                      <p className="text-2xl font-bold">{formatCurrency(fundingStats.totalInvited)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground mb-1">Total Accepted</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(fundingStats.totalFunded)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground mb-1">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {formatCurrency(fundingStats.totalInvited - fundingStats.totalFunded)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground mb-1">Available to Invite</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(principalAmount - fundingStats.totalInvited)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Lenders Table */}
              <Card>
                <CardHeader>
                  <CardTitle>All Lenders</CardTitle>
                  <CardDescription>View and manage lender invitations</CardDescription>
                </CardHeader>
                <CardContent>
                  {lenders.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No lenders invited yet</h3>
                      <p className="text-muted-foreground mb-4">Invite lenders to fund this loan</p>
                      <Button onClick={() => setInviteModalOpen(true)}>Invite Lenders</Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lender Email</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Remaining</TableHead>
                            <TableHead>ACH Details</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lenders.map((lender) => (
                            <TableRow key={lender.id}>
                              <TableCell className="font-medium">{lender.lender_email}</TableCell>
                              <TableCell>{formatCurrency(Number.parseFloat(lender.allocated_amount))}</TableCell>
                              <TableCell>
                                <StatusBadge type="invitation" status={lender.invitation_status} size="sm" />
                              </TableCell>
                              <TableCell>
                                {lender.invitation_status === "accepted"
                                  ? formatCurrency(Number.parseFloat(lender.remaining_balance))
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {lender.invitation_status === "accepted" && lender.ach_routing_number ? (
                                  <div className="text-xs space-y-1">
                                    <div>Routing: {formatACHRouting(lender.ach_routing_number)}</div>
                                    <div>Account: {maskACHAccount("1234567890")}</div>
                                    <div>Type: {lender.ach_account_type}</div>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {lender.invitation_status === "pending" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setLenderToRevoke(lender)
                                      setRevokeDialogOpen(true)
                                    }}
                                  >
                                    Revoke
                                  </Button>
                                )}
                                {lender.invitation_status === "accepted" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedLender(lender)
                                      setLenderDetailsOpen(true)
                                    }}
                                  >
                                    View Details
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : activeRole === "admin" ? (
            // Admin View - All Lenders (Read-Only)
            <>
              {/* Summary Stats */}
              {fundingStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground mb-1">Total Allocated</p>
                      <p className="text-2xl font-bold">{formatCurrency(fundingStats.totalInvited)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground mb-1">Total Accepted</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(fundingStats.totalFunded)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground mb-1">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {formatCurrency(fundingStats.totalInvited - fundingStats.totalFunded)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground mb-1">Remaining Capacity</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(principalAmount - fundingStats.totalInvited)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Lenders Table */}
              <Card>
                <CardHeader>
                  <CardTitle>All Lenders</CardTitle>
                  <CardDescription>View all lender invitations and participation details</CardDescription>
                </CardHeader>
                <CardContent>
                  {lenders.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No lenders invited yet</h3>
                      <p className="text-muted-foreground">This loan has not invited any lenders</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lender Email</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Remaining</TableHead>
                            <TableHead>Repaid</TableHead>
                            <TableHead>ACH Details</TableHead>
                            <TableHead>Invited</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lenders.map((lender) => (
                            <TableRow key={lender.id}>
                              <TableCell className="font-medium">{lender.lender_email}</TableCell>
                              <TableCell>{formatCurrency(Number.parseFloat(lender.allocated_amount))}</TableCell>
                              <TableCell>
                                <StatusBadge type="invitation" status={lender.invitation_status} size="sm" />
                              </TableCell>
                              <TableCell>
                                {lender.invitation_status === "accepted"
                                  ? formatCurrency(Number.parseFloat(lender.remaining_balance))
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {lender.invitation_status === "accepted"
                                  ? formatCurrency(
                                      Number.parseFloat(lender.allocated_amount) -
                                        Number.parseFloat(lender.remaining_balance),
                                    )
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {lender.invitation_status === "accepted" && lender.ach_routing_number ? (
                                  <div className="text-xs space-y-1">
                                    <div>Routing: {formatACHRouting(lender.ach_routing_number)}</div>
                                    <div>Account: {maskACHAccount("1234567890")}</div>
                                    <div>Type: {lender.ach_account_type}</div>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(lender.invited_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            // Lender View - Single Participation Card
            <Card>
              <CardHeader>
                <CardTitle>Your Participation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {myParticipation ? (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Invitation Status</p>
                        <StatusBadge type="invitation" status={myParticipation.invitation_status} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Your Contribution</p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(Number.parseFloat(myParticipation.allocated_amount))}
                        </p>
                      </div>
                      {myParticipation.invitation_status === "accepted" && (
                        <>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Remaining Balance</p>
                            <p className="text-2xl font-bold">
                              {formatCurrency(Number.parseFloat(myParticipation.remaining_balance))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Amount Received</p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency(
                                Number.parseFloat(myParticipation.allocated_amount) -
                                  Number.parseFloat(myParticipation.remaining_balance),
                              )}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {myParticipation.invitation_status === "pending" && !showACHForm && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          You have been invited to participate in this loan. Review the loan details and accept or
                          decline the invitation.
                        </AlertDescription>
                      </Alert>
                    )}

                    {myParticipation.invitation_status === "pending" && showACHForm && (
                      <div className="border rounded-lg p-6 space-y-4 bg-muted/50">
                        <h3 className="font-semibold text-lg">Enter ACH Details</h3>
                        <p className="text-sm text-muted-foreground">
                          Please provide your bank account details to receive repayments.
                        </p>

                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="routing">Routing Number</Label>
                            <Input
                              id="routing"
                              placeholder="9 digits"
                              maxLength={9}
                              value={achRouting}
                              onChange={(e) => setAchRouting(e.target.value.replace(/\D/g, ""))}
                            />
                          </div>

                          <div>
                            <Label htmlFor="account">Account Number</Label>
                            <Input
                              id="account"
                              type="password"
                              placeholder="Enter account number"
                              value={achAccount}
                              onChange={(e) => setAchAccount(e.target.value)}
                            />
                          </div>

                          <div>
                            <Label>Account Type</Label>
                            <RadioGroup value={achType} onValueChange={(v) => setAchType(v as "checking" | "savings")}>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="checking" id="checking" />
                                <Label htmlFor="checking">Checking</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="savings" id="savings" />
                                <Label htmlFor="savings">Savings</Label>
                              </div>
                            </RadioGroup>
                          </div>

                          <div className="flex gap-2 pt-4">
                            <Button onClick={handleAcceptInvitation} disabled={isSubmitting} className="flex-1">
                              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit & Accept"}
                            </Button>
                            <Button variant="outline" onClick={() => setShowACHForm(false)} disabled={isSubmitting}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {myParticipation.invitation_status === "accepted" && myParticipation.ach_routing_number && (
                      <div className="border rounded-lg p-4 space-y-2">
                        <h4 className="font-semibold text-sm">ACH Details</h4>
                        <div className="text-sm space-y-1">
                          <div>Routing: {myParticipation.ach_routing_number}</div>
                          <div>Account: {myParticipation.ach_account_number_encrypted}</div>
                          <div>Type: {myParticipation.ach_account_type}</div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">No participation data available</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Repayments Tab */}
        <TabsContent value="repayments" className="space-y-6">
          {activeRole === "borrower" && (
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Total Submitted</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(repayments.reduce((sum, r) => sum + Number.parseFloat(r.amount), 0))}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Total Approved</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(
                      repayments
                        .filter((r) => r.status === "approved")
                        .reduce((sum, r) => sum + Number.parseFloat(r.amount), 0),
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Pending Approval</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(
                      repayments
                        .filter((r) => r.status === "pending")
                        .reduce((sum, r) => sum + Number.parseFloat(r.amount), 0),
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeRole === "lender" && pendingRepaymentsCount > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{pendingRepaymentsCount} payment(s) awaiting your review</span>
                <Button size="sm" onClick={() => router.push("/repayments/review")}>
                  Review Payments
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Repayment History</CardTitle>
              <CardDescription>
                {activeRole === "lender" ? "Payments made to you" : "All repayments for this loan"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {repayments.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No repayments yet</h3>
                  <p className="text-muted-foreground mb-4">
                    {activeRole === "lender"
                      ? "Borrower hasn't made any payments to you"
                      : "Submit your first payment to start repaying lenders"}
                  </p>
                  {activeRole === "borrower" && loan.status === "active" && (
                    <Button onClick={() => router.push(`/loans/${loanId}/submit-payment`)}>Submit Payment</Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Lender</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead>Interest</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repayments.map((repayment) => (
                        <TableRow key={repayment.id}>
                          <TableCell>{formatDate(repayment.payment_date)}</TableCell>
                          <TableCell>{repayment.lender_email}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(Number.parseFloat(repayment.amount))}
                          </TableCell>
                          <TableCell>{formatCurrency(Number.parseFloat(repayment.principal_portion))}</TableCell>
                          <TableCell>{formatCurrency(Number.parseFloat(repayment.interest_portion))}</TableCell>
                          <TableCell>
                            <StatusBadge type="repayment" status={repayment.status} size="sm" />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRepayment(repayment)
                                setRepaymentDetailsOpen(true)
                              }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Notifications and updates for this loan</CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
                  <p className="text-muted-foreground">Activity for this loan will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => {
                    const icon =
                      notification.notification_type === "loan_invitation" ? (
                        <Mail className="w-5 h-5" />
                      ) : notification.notification_type === "invitation_accepted" ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : notification.notification_type === "invitation_declined" ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : notification.notification_type === "repayment_submitted" ? (
                        <DollarSign className="w-5 h-5 text-blue-600" />
                      ) : notification.notification_type === "repayment_approved" ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )

                    return (
                      <div
                        key={notification.id}
                        className={`flex items-start gap-4 p-4 rounded-lg border ${notification.is_read ? "bg-background" : "bg-muted/50"}`}
                      >
                        <div className="mt-1">{icon}</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-1">{notification.body}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(notification.created_at)}</p>
                        </div>
                        <div>
                          {notification.is_read ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkNotificationRead(notification.id)}
                            >
                              Mark Read
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke the invitation for {lenderToRevoke?.lender_email}? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Confirmation Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline this loan invitation? You will not be able to participate in this loan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeclineInvitation} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lender Details Dialog */}
      <Dialog open={lenderDetailsOpen} onOpenChange={setLenderDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lender Details</DialogTitle>
            <DialogDescription>View detailed information about this lender's participation</DialogDescription>
          </DialogHeader>
          {selectedLender && (
            <div className="space-y-6">
              {/* Lender Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="font-medium">{selectedLender.lender_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <StatusBadge type="invitation" status={selectedLender.invitation_status} />
                </div>
              </div>

              {/* Financial Details */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Financial Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Allocated Amount</p>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(Number.parseFloat(selectedLender.allocated_amount))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Remaining Balance</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(Number.parseFloat(selectedLender.remaining_balance))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Amount Repaid</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(
                        Number.parseFloat(selectedLender.allocated_amount) -
                          Number.parseFloat(selectedLender.remaining_balance),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Repayment Progress</p>
                    <p className="text-xl font-bold">
                      {(
                        ((Number.parseFloat(selectedLender.allocated_amount) -
                          Number.parseFloat(selectedLender.remaining_balance)) /
                          Number.parseFloat(selectedLender.allocated_amount)) *
                        100
                      ).toFixed(1)}
                      %
                    </p>
                  </div>
                </div>
              </div>

              {/* Banking Details */}
              {selectedLender.ach_routing_number && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">ACH Banking Details</h4>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Routing Number:</span>
                      <span className="font-mono font-medium">{formatACHRouting(selectedLender.ach_routing_number)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Account Number:</span>
                      <span className="font-mono font-medium">{maskACHAccount("1234567890")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Account Type:</span>
                      <span className="font-medium capitalize">{selectedLender.ach_account_type}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Timeline</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invited:</span>
                    <span className="font-medium">{formatDate(selectedLender.invited_at)}</span>
                  </div>
                  {selectedLender.responded_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Responded:</span>
                      <span className="font-medium">{formatDate(selectedLender.responded_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLenderDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repayment Details Dialog */}
      <Dialog open={repaymentDetailsOpen} onOpenChange={setRepaymentDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Repayment Transaction Details</DialogTitle>
            <DialogDescription>Complete information about this repayment</DialogDescription>
          </DialogHeader>
          {selectedRepayment && (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <StatusBadge type="repayment" status={selectedRepayment.status} />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Payment Date</p>
                  <p className="font-semibold">{formatDate(selectedRepayment.payment_date)}</p>
                </div>
              </div>

              {/* Payment Amount - Highlighted */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Payment Breakdown</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="text-sm font-medium">Total Amount</span>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary">
                        {formatCurrency(Number.parseFloat(selectedRepayment.amount))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{selectedRepayment.currency_code}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-muted-foreground mb-1">Principal Portion</p>
                      <p className="text-xl font-semibold text-blue-700">
                        {formatCurrency(Number.parseFloat(selectedRepayment.principal_portion))}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {((Number.parseFloat(selectedRepayment.principal_portion) / Number.parseFloat(selectedRepayment.amount)) * 100).toFixed(1)}% of total
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs text-muted-foreground mb-1">Interest Portion</p>
                      <p className="text-xl font-semibold text-green-700">
                        {formatCurrency(Number.parseFloat(selectedRepayment.interest_portion))}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {((Number.parseFloat(selectedRepayment.interest_portion) / Number.parseFloat(selectedRepayment.amount)) * 100).toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lender Information */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Lender Information</h4>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Email:</span>
                    <span className="font-medium">{selectedRepayment.lender_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Loan-Lender ID:</span>
                    <span className="font-mono text-xs">{selectedRepayment.loan_lender_id}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method & Reference */}
              {(selectedRepayment.payment_method || selectedRepayment.payment_reference) && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Payment Method & Reference</h4>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    {selectedRepayment.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Payment Method:</span>
                        <span className="font-medium capitalize">{selectedRepayment.payment_method}</span>
                      </div>
                    )}
                    {selectedRepayment.payment_reference && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Transaction Reference:</span>
                        <span className="font-mono font-medium">{selectedRepayment.payment_reference}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Proof */}
              {selectedRepayment.payment_proof_url && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Payment Proof</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <a
                      href={selectedRepayment.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      View Payment Proof Document
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              )}

              {/* Transaction IDs */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Transaction Identifiers</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">Repayment ID:</span>
                    <span className="font-mono text-xs">{selectedRepayment.id}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">Loan ID:</span>
                    <span className="font-mono text-xs">{selectedRepayment.loan_id}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">Borrower ID:</span>
                    <span className="font-mono text-xs">{selectedRepayment.borrower_id}</span>
                  </div>
                </div>
              </div>

              {/* Submission Details */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Submission Details</h4>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Submitted By:</span>
                    <span className="font-medium">{selectedRepayment.submitted_by}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Submitted At:</span>
                    <span className="font-medium">{formatDate(selectedRepayment.submitted_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Created At:</span>
                    <span className="font-medium">{formatDate(selectedRepayment.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Last Updated:</span>
                    <span className="font-medium">{formatDate(selectedRepayment.updated_at)}</span>
                  </div>
                </div>
              </div>

              {/* Review Details */}
              {(selectedRepayment.reviewed_by || selectedRepayment.reviewed_at || selectedRepayment.review_notes) && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Review Details</h4>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    {selectedRepayment.reviewed_by && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Reviewed By:</span>
                        <span className="font-medium">{selectedRepayment.reviewed_by}</span>
                      </div>
                    )}
                    {selectedRepayment.reviewed_at && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Reviewed At:</span>
                        <span className="font-medium">{formatDate(selectedRepayment.reviewed_at)}</span>
                      </div>
                    )}
                    {selectedRepayment.review_notes && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Review Notes:</p>
                        <div className="bg-background rounded-lg p-3 border">
                          <p className="text-sm">{selectedRepayment.review_notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status-specific Alerts */}
              {selectedRepayment.status === "pending" && (
                <div className="border-t pt-4">
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      This repayment is pending approval from the lender. Once approved, the remaining balance will be updated automatically.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              {selectedRepayment.status === "approved" && (
                <div className="border-t pt-4">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      This repayment has been approved and processed. The lender's remaining balance has been updated.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              {selectedRepayment.status === "rejected" && (
                <div className="border-t pt-4">
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      This repayment was rejected. Please check the review notes for details and resubmit if necessary.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepaymentDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InviteLenderModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        loanId={loanId}
        loanPrincipal={principalAmount}
        onSuccess={loadLoanData}
      />
    </div>
  )
}
