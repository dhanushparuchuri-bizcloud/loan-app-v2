"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useUser } from "@/lib/user-context"
import {
  fetchInvitationById,
  fetchLoanDetail,
  fetchBorrowerInfo,
  acceptLenderInvitation,
  declineLenderInvitation,
} from "@/lib/api"
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils"
import { StatusBadge } from "@/components/status-badge"
import { ACHBankingForm } from "@/components/invitations/ach-banking-form"
import { LoanDetailsExpand } from "@/components/invitations/loan-details-expand"
import { AlertCircle, ArrowLeft, CheckCircle, Calendar, TrendingUp, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { LoanLender, LoanDetail, BorrowerInfo } from "@/lib/types"

export default function InvitationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user, activeRole } = useUser()
  const { toast } = useToast()
  const [invitation, setInvitation] = useState<LoanLender | null>(null)
  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [borrower, setBorrower] = useState<BorrowerInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showACHForm, setShowACHForm] = useState(false)
  const [showDeclineDialog, setShowDeclineDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [invitationId, setInvitationId] = useState<string | null>(null)

  // Unwrap params Promise
  useEffect(() => {
    params.then(({ id }) => setInvitationId(id))
  }, [params])

  useEffect(() => {
    if (!user?.email || !invitationId) return

    async function loadInvitationDetails() {
      setIsLoading(true)
      setError(null)

      // Fetch invitation
      const invitationResult = await fetchInvitationById(invitationId!, user!.email, activeRole)

      if (invitationResult.error || !invitationResult.data) {
        setError(invitationResult.error || "Invitation not found")
        setIsLoading(false)
        return
      }

      setInvitation(invitationResult.data)

      // Fetch loan details
      const loanResult = await fetchLoanDetail(invitationResult.data.loan_id, user!.email, activeRole)

      if (loanResult.data) {
        setLoan(loanResult.data)

        // Fetch borrower details
        const borrowerResult = await fetchBorrowerInfo(loanResult.data.borrower_id, user!.email, activeRole)
        if (borrowerResult.data) {
          setBorrower(borrowerResult.data)
        }
      }

      setIsLoading(false)
    }

    loadInvitationDetails()
  }, [invitationId, user, activeRole])

  const handleAccept = async (achData: {
    ach_routing_number: string
    ach_account_number_encrypted: string
    ach_account_type: "checking" | "savings"
  }) => {
    if (!user?.email || !invitation) return

    setIsSubmitting(true)

    const result = await acceptLenderInvitation(
      invitation.id,
      {
        invitation_status: "accepted",
        responded_at: new Date().toISOString(),
        ...achData,
      },
      user.email,
      activeRole,
    )

    setIsSubmitting(false)

    if (result.error) {
      // Parse specific error messages
      if (result.error.includes("ach_routing_number_check")) {
        toast({
          title: "Invalid Routing Number",
          description: "Routing number must be exactly 9 digits",
          variant: "destructive",
        })
      } else if (result.error.includes("ach_account_type_check")) {
        toast({
          title: "Invalid Account Type",
          description: "Account type must be 'checking' or 'savings'",
          variant: "destructive",
        })
      } else if (result.error.includes("valid_ach_details")) {
        toast({
          title: "Missing Banking Details",
          description: "All banking details are required to accept",
          variant: "destructive",
        })
      } else if (result.error.includes("already responded")) {
        toast({
          title: "Already Responded",
          description: "This invitation has already been responded to",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Unable to accept invitation. Please try again.",
          variant: "destructive",
        })
      }
      return
    }

    toast({
      title: "Invitation Accepted!",
      description: "You will receive repayments to your account. Redirecting to dashboard...",
    })

    setTimeout(() => {
      router.push("/dashboard")
    }, 2000)
  }

  const handleDecline = async () => {
    if (!user?.email || !invitation) return

    setIsSubmitting(true)

    const result = await declineLenderInvitation(invitation.id, user.email, activeRole)

    setIsSubmitting(false)
    setShowDeclineDialog(false)

    if (result.error) {
      toast({
        title: "Error",
        description: result.error || "Unable to decline invitation. Please try again.",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Invitation Declined",
      description: "Redirecting to dashboard...",
    })

    setTimeout(() => {
      router.push("/dashboard")
    }, 1500)
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => router.push("/invitations")} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Invitations
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Invitation not found"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Check if already responded
  if (invitation.invitation_status !== "pending") {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => router.push("/invitations")} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Invitations
        </Button>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have already responded to this invitation. Status:{" "}
            <span className="font-semibold capitalize">{invitation.invitation_status}</span>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/invitations")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Invitations
        </Button>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Invitation</h1>
          {borrower && <p className="text-muted-foreground mt-2">From {borrower.full_name}</p>}
        </div>

        {/* Invitation Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-xl">Invitation Details</CardTitle>
              <StatusBadge type="invitation" status={invitation.invitation_status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">You are invited to fund:</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(Number.parseFloat(invitation.allocated_amount), invitation.currency_code)}
              </p>
              {loan && (
                <p className="text-sm text-muted-foreground mt-2">
                  of {formatCurrency(Number.parseFloat(loan.principal_amount), loan.currency_code)} total loan amount
                </p>
              )}
            </div>

            {loan && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Interest Rate</p>
                    <p className="text-xl font-semibold">{formatPercentage(Number.parseFloat(loan.interest_rate))}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Term</p>
                    <p className="text-xl font-semibold">{loan.term_months} months</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Invited</p>
                    <p className="text-xl font-semibold">{formatDate(invitation.invited_at)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loan Details */}
        {loan && <LoanDetailsExpand loan={loan} />}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setShowDeclineDialog(true)} disabled={isSubmitting}>
            Decline
          </Button>
          <Button onClick={() => setShowACHForm(true)} disabled={isSubmitting} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Accept Invitation
          </Button>
        </div>

        {/* ACH Form Dialog */}
        <Dialog open={showACHForm} onOpenChange={setShowACHForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Provide Banking Details</DialogTitle>
              <DialogDescription>
                To receive repayments, please provide your ACH banking information. Your account details will be
                encrypted and securely stored.
              </DialogDescription>
            </DialogHeader>
            <ACHBankingForm
              onSubmit={handleAccept}
              onCancel={() => setShowACHForm(false)}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        </Dialog>

        {/* Decline Confirmation Dialog */}
        <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Invitation?</DialogTitle>
              <DialogDescription>
                Are you sure you want to decline this invitation? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeclineDialog(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDecline} disabled={isSubmitting}>
                {isSubmitting ? "Declining..." : "Decline Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
