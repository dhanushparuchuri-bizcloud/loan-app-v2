"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useUser } from "@/lib/user-context"
import { fetchPendingInvitations, fetchLoanDetail, fetchBorrowerInfo } from "@/lib/api"
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils"
import { StatusBadge } from "@/components/status-badge"
import { AlertCircle, ArrowRight, Mail, Inbox } from "lucide-react"
import type { LoanLender, LoanDetail, BorrowerInfo } from "@/lib/types"

interface InvitationWithDetails {
  invitation: LoanLender
  loan: LoanDetail | null
  borrower: BorrowerInfo | null
}

export default function InvitationsPage() {
  const router = useRouter()
  const { user, activeRole } = useUser()
  const [invitations, setInvitations] = useState<InvitationWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.email) return

    async function loadInvitations() {
      setIsLoading(true)
      setError(null)

      const result = await fetchPendingInvitations(user!.email, user!.email, activeRole)

      if (result.error || !result.data) {
        setError(result.error || "Failed to load invitations")
        setIsLoading(false)
        return
      }

      // Fetch loan and borrower details for each invitation
      const invitationsWithDetails = await Promise.all(
        result.data.map(async (invitation) => {
          const loanResult = await fetchLoanDetail(invitation.loan_id, user!.email, activeRole)
          let borrowerResult = null

          if (loanResult.data) {
            borrowerResult = await fetchBorrowerInfo(loanResult.data.borrower_id, user!.email, activeRole)
          }

          return {
            invitation,
            loan: loanResult.data,
            borrower: borrowerResult?.data || null,
          }
        }),
      )

      setInvitations(invitationsWithDetails)
      setIsLoading(false)
    }

    loadInvitations()
  }, [user, activeRole])

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (invitations.length === 0) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pending Loan Invitations</h1>
            <p className="text-muted-foreground mt-2">Review and respond to loan funding opportunities</p>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Pending Invitations</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                You don't have any loan invitations at the moment. Check back later for new funding opportunities.
              </p>
              <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Loan Invitations</h1>
          <p className="text-muted-foreground mt-2">
            You have {invitations.length} pending {invitations.length === 1 ? "invitation" : "invitations"}
          </p>
        </div>

        <div className="space-y-4">
          {invitations.map(({ invitation, loan, borrower }) => (
            <Card key={invitation.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <h3 className="text-xl font-semibold leading-tight">
                      {loan?.loan_name || "Loan Details Unavailable"}
                    </h3>
                    {borrower && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>From: {borrower.full_name}</span>
                      </div>
                    )}
                  </div>
                  <StatusBadge type="invitation" status={invitation.invitation_status} size="sm" />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {loan ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Your Allocation</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(Number.parseFloat(invitation.allocated_amount), invitation.currency_code)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Interest Rate</p>
                        <p className="text-lg font-semibold">
                          {formatPercentage(Number.parseFloat(loan.interest_rate))}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Term</p>
                        <p className="text-lg font-semibold">{loan.term_months} months</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Invited</p>
                        <p className="text-lg font-semibold">{formatDate(invitation.invited_at)}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button onClick={() => router.push(`/invitations/${invitation.id}`)} className="gap-2">
                        View Details
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Loan details are currently unavailable for this invitation.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
