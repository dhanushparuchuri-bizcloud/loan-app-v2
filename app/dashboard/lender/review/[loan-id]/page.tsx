"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAuth } from "@/lib/auth-context"
import { apiClient } from "@/lib/api-client"
import { ArrowLeft, Check, X, DollarSign, Calendar, Target, User, TrendingUp, CreditCard } from "lucide-react"

interface ACHDetails {
  bank_name: string
  account_type: string
  routing_number: string
  account_number: string
  special_instructions: string
}

export default function LoanReviewPage() {
  const [showACHForm, setShowACHForm] = useState(false)
  const [achDetails, setACHDetails] = useState<ACHDetails>({
    bank_name: "",
    account_type: "",
    routing_number: "",
    account_number: "",
    special_instructions: "",
  })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loan, setLoan] = useState<any>(null)
  const [userParticipation, setUserParticipation] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const loanId = params["loan-id"] as string

  useEffect(() => {
    if (!user || !user.is_lender) {
      router.push("/login")
      return
    }

    const fetchLoanDetails = async () => {
      try {
        setIsLoading(true)
        setError(null)

        console.log('[LoanReview] Fetching loan details for ID:', loanId)

        const response = await apiClient.getLoanDetails(loanId)
        console.log('[LoanReview] API response:', response)

        if (response.success && response.data) {
          const loanData = response.data
          setLoan(loanData)

          // With privacy protection, lenders get their participation in user_participation field
          if (loanData.user_participation) {
            setUserParticipation(loanData.user_participation)
          } else {
            setError('You are not invited to this note')
          }
        } else {
          setError('Failed to load note details')
        }
      } catch (err) {
        console.error('[LoanReview] Error fetching loan details:', err)
        setError(err instanceof Error ? err.message : 'Failed to load loan details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLoanDetails()
  }, [user, router, loanId])

  const handleRoleSwitch = () => {
    router.push("/dashboard/borrower")
  }

  const handleAcceptLoan = () => {
    setShowACHForm(true)
  }

  const handleDeclineLoan = () => {
    // Mock decline logic
    console.log("Declining loan:", loanId)
    router.push("/dashboard/lender")
  }

  const handleSubmitACH = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms) return

    // Validate form data before submission
    if (!achDetails.bank_name) {
      setError('Please select a bank name')
      return
    }
    if (!achDetails.account_type) {
      setError('Please select an account type')
      return
    }
    if (achDetails.routing_number.length !== 9) {
      setError('Routing number must be exactly 9 digits')
      return
    }
    if (achDetails.account_number.length < 4) {
      setError('Account number must be at least 4 digits')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      console.log("Accepting loan with ACH details:", { loanId, achDetails })

      const response = await apiClient.acceptLoanInvitation(loanId, {
        bank_name: achDetails.bank_name,
        account_type: achDetails.account_type.toLowerCase() as 'checking' | 'savings',
        routing_number: achDetails.routing_number,
        account_number: achDetails.account_number,
        special_instructions: achDetails.special_instructions || undefined
      })

      if (response.success) {
        console.log('Loan accepted successfully:', response.data)
        router.push("/dashboard/lender")
      } else {
        setError('Failed to accept loan invitation')
      }
    } catch (err) {
      console.error('Error accepting loan:', err)
      setError(err instanceof Error ? err.message : 'Failed to accept loan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatRoutingNumber = (value: string) => {
    // Remove non-digits and limit to 9 characters
    const digits = value.replace(/\D/g, "").slice(0, 9)
    return digits
  }

  const formatAccountNumber = (value: string) => {
    // Remove non-digits only (don't mask for backend submission)
    const digits = value.replace(/\D/g, "")
    return digits
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader currentRole="lender" onRoleSwitch={handleRoleSwitch} />
        <main className="p-6">
          <div className="text-center py-12">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto mb-6"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !loan || !userParticipation) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader currentRole="lender" onRoleSwitch={handleRoleSwitch} />
        <main className="p-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">
              {error || 'Note Not Found'}
            </h1>
            <p className="text-muted-foreground mb-6">
              {error || 'The note you are looking for does not exist or you do not have access to it.'}
            </p>
            <Button onClick={() => router.push("/dashboard/lender")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const expectedMonthlyReturn = userParticipation && loan ? (userParticipation.contribution_amount * loan.interest_rate) / 100 / 12 : 0
  const expectedAnnualReturn = userParticipation && loan ? (userParticipation.contribution_amount * loan.interest_rate) / 100 : 0

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader currentRole="lender" onRoleSwitch={user?.is_lender ? handleRoleSwitch : undefined} />

      <main className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/dashboard/lender")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-balance">Note Review</h1>
          <p className="text-muted-foreground">Review the note terms and provide your decision</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loan Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Note Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Principal Amount</Label>
                    <p className="text-2xl font-bold">${loan.amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label>Interest Rate</Label>
                    <p className="text-2xl font-bold text-green-600">{loan.interest_rate}%</p>
                  </div>
                  <div>
                    <Label>Maturity Date</Label>
                    <p className="text-lg">{loan.term}</p>
                  </div>
                  <div>
                    <Label>Purpose</Label>
                    <Badge variant="outline" className="text-sm">
                      {loan.purpose}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <p className="text-muted-foreground mt-1">{loan.description}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Created on {new Date(loan.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>

            {/* Borrower Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Issuer Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <p className="font-medium">{loan.borrower_name || 'Unknown Issuer'}</p>
                  </div>
                  <div>
                    <Label>Loan ID</Label>
                    <p className="text-muted-foreground font-mono text-sm">{loan.loan_id}</p>
                  </div>
                  <div>
                    <Label>Profile</Label>
                    <p className="text-muted-foreground">
                      Experienced entrepreneur with a track record of successful business ventures. Looking to expand
                      operations with additional capital.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Funding Status - Privacy Protected */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Funding Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>
                        ${loan?.funding_progress?.total_funded?.toLocaleString() || '0'} / ${loan?.amount?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-primary h-3 rounded-full transition-all duration-300"
                        style={{ width: `${loan?.funding_progress?.funding_percentage || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      {Math.round(loan?.funding_progress?.funding_percentage || 0)}% funded
                    </p>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Remaining Amount</span>
                      <span className="font-medium">
                        ${loan?.funding_progress?.remaining_amount?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={loan?.funding_progress?.is_fully_funded ? "default" : "secondary"}>
                        {loan?.funding_progress?.is_fully_funded ? "Fully Funded" : "Seeking Funding"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ACH Details Form */}
            {showACHForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Bank Account Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitACH} className="space-y-4">
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="bank-name">Bank Name</Label>
                        <Select
                          value={achDetails.bank_name}
                          onValueChange={(value) => setACHDetails({ ...achDetails, bank_name: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select your bank" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Chase Bank">Chase Bank</SelectItem>
                            <SelectItem value="Bank of America">Bank of America</SelectItem>
                            <SelectItem value="Wells Fargo">Wells Fargo</SelectItem>
                            <SelectItem value="Citibank">Citibank</SelectItem>
                            <SelectItem value="US Bank">US Bank</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Account Type</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="account_type"
                              value="Checking"
                              checked={achDetails.account_type === "Checking"}
                              onChange={(e) => setACHDetails({ ...achDetails, account_type: e.target.value })}
                            />
                            <span>Checking</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="account_type"
                              value="Savings"
                              checked={achDetails.account_type === "Savings"}
                              onChange={(e) => setACHDetails({ ...achDetails, account_type: e.target.value })}
                            />
                            <span>Savings</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="routing-number">Routing Number (9 digits)</Label>
                        <Input
                          id="routing-number"
                          value={achDetails.routing_number}
                          onChange={(e) =>
                            setACHDetails({
                              ...achDetails,
                              routing_number: formatRoutingNumber(e.target.value),
                            })
                          }
                          placeholder="123456789"
                          maxLength={9}
                          required
                          className={achDetails.routing_number.length > 0 && achDetails.routing_number.length !== 9 ? "border-red-500" : ""}
                        />
                        {achDetails.routing_number.length > 0 && achDetails.routing_number.length !== 9 && (
                          <p className="text-sm text-red-500">Routing number must be exactly 9 digits</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="account-number">Account Number</Label>
                        <Input
                          id="account-number"
                          value={achDetails.account_number}
                          onChange={(e) => setACHDetails({ ...achDetails, account_number: formatAccountNumber(e.target.value) })}
                          placeholder="Account number"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="special-instructions">Special Instructions (Optional)</Label>
                      <Textarea
                        id="special-instructions"
                        value={achDetails.special_instructions}
                        onChange={(e) => setACHDetails({ ...achDetails, special_instructions: e.target.value })}
                        placeholder="Any special processing instructions..."
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="terms"
                        checked={agreedToTerms}
                        onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                      />
                      <Label htmlFor="terms" className="text-sm">
                        I agree to the loan terms and conditions
                      </Label>
                    </div>

                    <div className="flex gap-4">
                      <Button type="submit" disabled={!agreedToTerms || isSubmitting} className="flex-1">
                        {isSubmitting ? "Processing..." : "Accept Loan"}
                        <Check className="ml-2 h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowACHForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Your Contribution */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Your Contribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Investment Amount</Label>
                  <p className="text-3xl font-bold text-primary">
                    ${userParticipation.contribution_amount?.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Expected Annual Return:</span>
                    <span className="font-medium text-green-600">${expectedAnnualReturn.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Monthly Income:</span>
                    <span className="font-medium">${expectedMonthlyReturn.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Return:</span>
                    <span className="font-medium">
                      ${((userParticipation?.contribution_amount || 0) + expectedAnnualReturn).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            {!showACHForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={handleAcceptLoan} className="w-full" size="lg">
                    <Check className="mr-2 h-4 w-4" />
                    Accept Loan
                  </Button>
                  <Button onClick={handleDeclineLoan} variant="outline" className="w-full bg-transparent">
                    <X className="mr-2 h-4 w-4" />
                    Decline
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Loan Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Funding Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Funded</span>
                    <span>
                      ${loan?.funding_progress?.total_funded?.toLocaleString() || '0'} / ${loan?.amount?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${loan?.funding_progress?.funding_percentage || 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(loan?.funding_progress?.funding_percentage || 0)}% funded
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
