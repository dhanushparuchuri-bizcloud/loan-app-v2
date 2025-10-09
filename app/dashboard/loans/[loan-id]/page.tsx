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
import { ArrowLeft, DollarSign, Calendar, TrendingUp, Users, FileText, Clock, Printer, AlertCircle, Plus, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Add Lenders Form Component
function AddLendersForm({
  loanId,
  loanAmount,
  currentInvited,
  onSuccess
}: {
  loanId: string
  loanAmount: number
  currentInvited: number
  onSuccess: () => void
}) {
  const [lenders, setLenders] = useState<Array<{ email: string; amount: number }>>([
    { email: '', amount: 0 }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = loanAmount - currentInvited
  const totalNew = lenders.reduce((sum, l) => sum + l.amount, 0)
  const isValid = lenders.every(l => l.email && l.amount > 0) && totalNew <= remaining

  const addLenderRow = () => {
    setLenders([...lenders, { email: '', amount: 0 }])
  }

  const removeLenderRow = (index: number) => {
    setLenders(lenders.filter((_, i) => i !== index))
  }

  const updateLender = (index: number, field: 'email' | 'amount', value: string | number) => {
    const updated = [...lenders]
    updated[index] = { ...updated[index], [field]: value }
    setLenders(updated)
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setError(null)

      // Map 'amount' to 'contribution_amount' for the API
      const lendersData = {
        lenders: lenders.map(l => ({
          email: l.email,
          contribution_amount: l.amount
        }))
      }

      const response = await apiClient.addLendersToLoan(loanId, lendersData)

      if (response.success) {
        alert(`Successfully added ${response.data.lenders_added} note holder(s)!`)
        setLenders([{ email: '', amount: 0 }])
        onSuccess() // Refresh loan details
        // Hide the form
        const addLendersSection = document.getElementById('add-lenders-section')
        if (addLendersSection) {
          addLendersSection.classList.add('hidden')
        }
      } else {
        setError('Failed to add note holders')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note holders')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Add Note Holders</h3>
        <div className="text-sm text-muted-foreground">
          Remaining: ${remaining.toLocaleString()} / ${loanAmount.toLocaleString()}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lenders.map((lender, index) => (
        <div key={index} className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor={`email-${index}`}>Email</Label>
            <Input
              id={`email-${index}`}
              type="email"
              value={lender.email}
              onChange={(e) => updateLender(index, 'email', e.target.value)}
              placeholder="lender@example.com"
            />
          </div>
          <div className="w-32">
            <Label htmlFor={`amount-${index}`}>Amount ($)</Label>
            <Input
              id={`amount-${index}`}
              type="number"
              min="1"
              value={lender.amount || ''}
              onChange={(e) => updateLender(index, 'amount', Number(e.target.value))}
              placeholder="10000"
            />
          </div>
          {lenders.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeLenderRow(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLenderRow}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Another
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          size="sm"
        >
          {isSubmitting ? 'Adding...' : `Add ${lenders.length} Holder${lenders.length !== 1 ? 's' : ''}`}
        </Button>
      </div>

      {totalNew > remaining && (
        <p className="text-sm text-destructive">
          Total amount (${totalNew.toLocaleString()}) exceeds remaining (${remaining.toLocaleString()})
        </p>
      )}
    </div>
  )
}

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

  // Check for hash in URL to auto-open add lenders form
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#add-lenders') {
      setTimeout(() => {
        const addLendersSection = document.getElementById('add-lenders-section')
        if (addLendersSection) {
          addLendersSection.classList.remove('hidden')
          addLendersSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 500)
    }
  }, [loan])

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
            <h1 className="text-2xl font-bold mb-2">Note Not Found</h1>
            <p className="text-muted-foreground mb-4">
              {error || "The note you're looking for doesn't exist or you don't have access to it."}
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

  // Get participants for this loan (borrowers see full list, lenders see empty array)
  const participants = loan.participants || []
  
  // Check if current user is a participant
  const isBorrower = loan.borrower_id === user.user_id
  const userParticipation = isBorrower ? null : loan.user_participation
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
              <h1 className="text-3xl font-bold text-balance">{loan.loan_name}</h1>
              <p className="text-muted-foreground">{loan.purpose} • Note ID: {loan.loan_id}</p>
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
                <CardTitle>Note Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Principal Amount</span>
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
                    <p className="text-xl font-semibold">
                      {loan.maturity_terms ? 
                        `${loan.maturity_terms.payment_frequency} for ${loan.maturity_terms.term_length} months` : 
                        'N/A'
                      }
                    </p>
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

                {/* Business Entity Information */}
                {loan.purpose === "Business" && loan.entity_name && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        🏢 Business Entity Information
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Entity Name</div>
                          <p className="font-medium">{loan.entity_name}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Entity Type</div>
                          <p>{loan.entity_type}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Tax ID / EIN</div>
                          <p>{loan.entity_tax_id || 'Not provided'}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Borrower's Role</div>
                          <p>{loan.borrower_relationship}</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div className="text-sm text-blue-700">
                            <p className="font-medium">Business Loan</p>
                            <p>This loan is for business purposes. The individual borrower remains personally liable for repayment.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

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
                  
                  {loan.funding_progress && isBorrower && (
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Accepted Participants:</span>
                        <p className="font-medium">{loan.funding_progress.accepted_participants || 0}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pending Participants:</span>
                        <p className="font-medium">{loan.funding_progress.pending_participants || 0}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Maturity Terms */}
            {loan.maturity_terms && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Maturity Terms
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Start Date</span>
                      <p className="font-semibold">{new Date(loan.maturity_terms.start_date).toLocaleDateString()}</p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Maturity Date</span>
                      <p className="font-semibold">{new Date(loan.maturity_terms.maturity_date).toLocaleDateString()}</p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Payment Frequency</span>
                      <p className="font-semibold">{loan.maturity_terms.payment_frequency}</p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Total Payments</span>
                      <p className="font-semibold">{loan.maturity_terms.total_payments} payments</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lenders - Only shown to borrowers for privacy */}
            {isBorrower && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Note Holders ({participants.length})
                    </CardTitle>
                    {loan.status === "PENDING" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Toggle add lenders form
                          const addLendersSection = document.getElementById('add-lenders-section')
                          if (addLendersSection) {
                            addLendersSection.classList.toggle('hidden')
                          }
                        }}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Add Holders
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Add Lenders Form - Only for PENDING loans */}
                  {loan.status === "PENDING" && (
                    <div id="add-lenders-section" className="hidden mb-6 p-4 border rounded-lg bg-muted/30">
                      <AddLendersForm
                        loanId={loan.loan_id}
                        loanAmount={loan.amount}
                        currentInvited={participants.reduce((sum, p) => sum + p.contribution_amount, 0)}
                        onSuccess={fetchLoanDetails}
                      />
                    </div>
                  )}

                  {participants.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No note holders yet</p>
                      {loan.status === "PENDING" && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Click "Add Holders" to invite note holders to fund this note
                        </p>
                      )}
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
                              <p className="font-medium">{participation.lender_name || 'Unknown Note Holder'}</p>
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
                              {participation.status === "ACCEPTED" ? "✓ Funded" : "⏳ Pending"}
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
            )}

            {/* Payment Schedule - Only shown to borrowers */}
            {isBorrower && loan.borrower_payment_details && loan.borrower_payment_details.payment_dates && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Payment Schedule & Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <span className="text-sm text-muted-foreground">Payment Per Period</span>
                        <p className="font-bold text-lg">${loan.borrower_payment_details.total_payment_amount.toLocaleString()}</p>
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm text-muted-foreground">Payment Frequency</span>
                        <p className="font-semibold">{loan.borrower_payment_details.payment_frequency}</p>
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm text-muted-foreground">Total Payments</span>
                        <p className="font-semibold">{loan.borrower_payment_details.total_payments} payments</p>
                      </div>
                    </div>

                    {/* Lender Payment Breakdown */}
                    {loan.borrower_payment_details.lender_payments && loan.borrower_payment_details.lender_payments.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold">Payment Distribution per {loan.borrower_payment_details.payment_frequency}:</h4>
                        <div className="space-y-2">
                          {loan.borrower_payment_details.lender_payments.map((lender, index) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded">
                              <div>
                                <p className="font-medium">{lender.lender_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Funded: ${lender.contribution_amount.toLocaleString()} • Status: {lender.status}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-lg">${lender.payment_amount.toLocaleString()}</p>
                                <p className="text-sm text-muted-foreground">per payment</p>
                              </div>
                            </div>
                          ))}
                          <div className="border-t pt-2 flex justify-between items-center font-semibold">
                            <span>Total Per Payment:</span>
                            <span className="text-lg">${loan.borrower_payment_details.total_payment_amount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Payment Schedule */}
                    <div className="space-y-3">
                      <h4 className="font-semibold">Payment Schedule:</h4>
                      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                        {loan.borrower_payment_details?.payment_dates.map((date, index) => (
                          <div key={index} className="p-3 bg-muted rounded text-center">
                            <p className="text-sm text-muted-foreground">Payment {index + 1}</p>
                            <p className="font-medium">{new Date(date).toLocaleDateString()}</p>
                            <p className="font-semibold text-primary">${loan.borrower_payment_details?.total_payment_amount.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Disclaimer */}
                    {loan.borrower_payment_details?.disclaimer && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          {loan.borrower_payment_details.disclaimer}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Borrower Info */}
            <Card>
              <CardHeader>
                <CardTitle>Issuer Information</CardTitle>
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
                      <p className="font-medium">{loan.borrower_name || 'Unknown Issuer'}</p>
                      <p className="text-sm text-muted-foreground">Issuer ID: {loan.borrower_id}</p>
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
                  
                  {userParticipation.payment_amount && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Monthly Payment</span>
                      <span className="font-semibold text-blue-600">
                        ${userParticipation.payment_amount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {userParticipation.total_interest && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Interest</span>
                      <span className="font-semibold text-green-600">
                        ${userParticipation.total_interest.toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {userParticipation.total_repayment && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Repayment</span>
                      <span className="font-bold text-lg">
                        ${userParticipation.total_repayment.toLocaleString()}
                      </span>
                    </div>
                  )}
                  
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
                  
                  {loan.maturity_terms && (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Your Payment Schedule</span>
                      <p className="text-sm">
                        {userParticipation.payment_amount ? `$${userParticipation.payment_amount.toLocaleString()}` : 'TBD'} per {loan.maturity_terms.payment_frequency.toLowerCase()} payment
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {loan.maturity_terms.total_payments} payments from {new Date(loan.maturity_terms.start_date).toLocaleDateString()} to {new Date(loan.maturity_terms.maturity_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  
                  {userParticipation.disclaimer && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {userParticipation.disclaimer}
                      </AlertDescription>
                    </Alert>
                  )}
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
                      <p className="font-medium">Note Created</p>
                      <p className="text-sm text-muted-foreground">{new Date(loan.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {loan.status === "ACTIVE" && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                      <div>
                        <p className="font-medium">Note Activated</p>
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
