"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DashboardLoader } from "@/components/dashboard-loader"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAuth } from "@/lib/auth-context"
import { apiClient, type Loan } from "@/lib/api-client"
import { ArrowLeft, DollarSign, Calendar, TrendingUp, Users, FileText, Clock, Printer, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoanDetailsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [loan, setLoan] = useState<Loan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const loanId = params["loan-id"] as string

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    fetchLoanDetails()
  }, [user, router, loanId])

  const fetchLoanDetails = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      console.log('[LoanDetails] Fetching loan details for ID:', loanId)
      const response = await apiClient.getLoanDetails(loanId)
      
      if (response.success && response.data) {
        setLoan(response.data)
        console.log('[LoanDetails] Loan details loaded:', response.data)
      } else {
        setError('Failed to load loan details')
        console.error('[LoanDetails] Failed to load loan:', response)
      }
    } catch (err) {
      console.error('[LoanDetails] Error fetching loan:', err)
      setError(err instanceof Error ? err.message : 'Failed to load loan details')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return <DashboardLoader type={user?.is_lender ? "lender" : "borrower"} />
  }

  if (!user) return null

  if (error || (!isLoading && !loan)) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader currentRole={user.is_lender ? "lender" : "borrower"} />
        <main className="p-6">
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">Loan Not Found</h1>
            <p className="text-muted-foreground mb-4">
              {error || "The loan you're looking for doesn't exist or you don't have access to it."}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Button variant="outline" onClick={fetchLoanDetails}>
                Try Again
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!loan) return null

  // Get participants for this loan
  const participants = loan.participants || []

  // Check if current user is a participant
  const userParticipation = participants.find((p) => p.lender_id === user.user_id)
  const isBorrower = loan.borrower_id === user.user_id
  const isLender = !!userParticipation

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Awaiting funding approval
          </Badge>
        )
      case "ACTIVE":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Funded
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const fundingPercentage = (loan.total_funded / loan.amount) * 100

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader currentRole={user.is_lender ? "lender" : "borrower"} />

      <main className="p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-balance">Loan Details</h1>
              <p className="text-muted-foreground">Loan ID: {loan.loan_id}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              {getStatusBadge(loan.status)}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loan Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Loan Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Loan Amount</span>
                    </div>
                    <p className="text-2xl font-bold">${loan.amount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Interest Rate</span>
                    </div>
                    <p className="text-2xl font-bold">{loan.interest_rate}%</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Term</span>
                    </div>
                    <p className="text-xl font-semibold">{loan.term}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">Purpose</span>
                    </div>
                    <p className="text-xl font-semibold">{loan.purpose}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">{loan.description}</p>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Funding Progress</h3>
                    <span className="text-sm text-muted-foreground">
                      ${loan.total_funded.toLocaleString()} / ${loan.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-500"
                      style={{ width: `${fundingPercentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{fundingPercentage.toFixed(1)}% funded</p>
                  
                  {loan.funding_progress && (
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Accepted Participants:</span>
                        <p className="font-medium">{loan.funding_progress.accepted_participants}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pending Participants:</span>
                        <p className="font-medium">{loan.funding_progress.pending_participants}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lenders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Lenders ({participants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No lenders yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {participants.map((participation) => (
                      <div key={participation.lender_id} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="font-semibold text-primary">
                                {participation.lender_name?.charAt(0).toUpperCase() || 'L'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{participation.lender_name || 'Unknown Lender'}</p>
                              <p className="text-sm text-muted-foreground">{participation.lender_email || ''}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${participation.contribution_amount.toLocaleString()}</p>
                            <Badge
                              variant="secondary"
                              className={
                                participation.status === "ACCEPTED"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }
                            >
                              {participation.status}
                            </Badge>
                          </div>
                        </div>

                        {isBorrower && participation.status === "ACCEPTED" && participation.ach_details && (
                          <div className="border-t bg-muted/30 p-4">
                            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Bank Account Details for Repayment
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Bank Name:</span>
                                <p className="font-medium">{participation.ach_details.bank_name}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Account Type:</span>
                                <p className="font-medium">{participation.ach_details.account_type}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Routing Number:</span>
                                <p className="font-mono font-medium">{participation.ach_details.routing_number}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Account Number:</span>
                                <p className="font-mono font-medium">{participation.ach_details.account_number}</p>
                              </div>
                              {participation.ach_details.special_instructions && (
                                <div className="md:col-span-2">
                                  <span className="text-muted-foreground">Special Instructions:</span>
                                  <p className="font-medium">{participation.ach_details.special_instructions}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Borrower Info */}
            <Card>
              <CardHeader>
                <CardTitle>Borrower Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-semibold text-primary text-lg">
                        {loan.borrower_name?.charAt(0).toUpperCase() || 'B'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{loan.borrower_name || 'Unknown Borrower'}</p>
                      <p className="text-sm text-muted-foreground">Borrower ID: {loan.borrower_id}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Your Participation (for lenders) */}
            {isLender && userParticipation && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle>Your Participation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Your Contribution</span>
                    <span className="font-bold text-lg">${userParticipation.contribution_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Expected Return</span>
                    <span className="font-semibold text-green-600">
                      ${((userParticipation.contribution_amount * loan.interest_rate) / 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge
                      variant="secondary"
                      className={
                        userParticipation.status === "ACCEPTED"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {userParticipation.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loan Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div>
                      <p className="font-medium">Loan Created</p>
                      <p className="text-sm text-muted-foreground">{new Date(loan.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {loan.status === "ACTIVE" && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                      <div>
                        <p className="font-medium">Loan Activated</p>
                        <p className="text-sm text-muted-foreground">Funding complete</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
