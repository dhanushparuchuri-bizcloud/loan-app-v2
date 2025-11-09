"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { fetchAvailableLenders, submitPayment, fetchLoanDetail } from "@/lib/api"
import type { AvailableLender, AvailableLendersResponse, LoanDetail, SubmitPaymentRequest } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default function SubmitPaymentPage() {
  const params = useParams()
  const router = useRouter()
  const { user, activeRole } = useUser()
  const { toast } = useToast()
  const loanId = params.id as string

  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [lendersData, setLendersData] = useState<AvailableLendersResponse | null>(null)
  const [selectedLender, setSelectedLender] = useState<AvailableLender | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form fields
  const [lenderId, setLenderId] = useState("")
  const [principalPortion, setPrincipalPortion] = useState("")
  const [interestPortion, setInterestPortion] = useState("")
  const [totalAmount, setTotalAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentMethod, setPaymentMethod] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentProofUrl, setPaymentProofUrl] = useState("")

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user?.email) {
      loadData()
    }
  }, [loanId, user?.email, activeRole])

  useEffect(() => {
    // Calculate total amount when principal or interest changes
    const principal = Number.parseFloat(principalPortion || "0")
    const interest = Number.parseFloat(interestPortion || "0")
    setTotalAmount(principal + interest)
  }, [principalPortion, interestPortion])

  async function loadData() {
    if (!user?.email) return

    setIsLoading(true)

    try {
      // Fetch loan details
      const loanResult = await fetchLoanDetail(loanId, user.email, activeRole)
      if (loanResult.data) {
        setLoan(loanResult.data)
      }

      // Fetch available lenders
      const lendersResult = await fetchAvailableLenders(loanId, user.email, activeRole)
      if (lendersResult.data) {
        setLendersData(lendersResult.data)
      }
    } catch (err) {
      console.error("[v0] Error loading data:", err)
      toast({
        title: "Error",
        description: "Failed to load payment form data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  function handleLenderChange(value: string) {
    setLenderId(value)
    const lender = lendersData?.lenders.find((l) => l.id === value)
    setSelectedLender(lender || null)
    // Clear errors when lender changes
    setErrors({})
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {}

    // Validate lender selection
    if (!lenderId) {
      newErrors.lenderId = "Please select a lender"
    }

    // Validate principal portion
    const principal = Number.parseFloat(principalPortion)
    if (!principalPortion) {
      newErrors.principalPortion = "Principal amount is required"
    } else if (principal <= 0) {
      newErrors.principalPortion = "Principal must be greater than $0"
    } else if (selectedLender && principal > Number.parseFloat(selectedLender.remaining_balance)) {
      newErrors.principalPortion = `Principal cannot exceed ${formatCurrency(Number.parseFloat(selectedLender.remaining_balance))} (remaining balance)`
    }

    // Validate interest portion
    const interest = Number.parseFloat(interestPortion)
    if (interestPortion === "") {
      newErrors.interestPortion = "Interest amount is required"
    } else if (interest < 0) {
      newErrors.interestPortion = "Interest cannot be negative"
    }

    // Validate payment date
    if (!paymentDate) {
      newErrors.paymentDate = "Payment date is required"
    } else {
      const selectedDate = new Date(paymentDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (selectedDate > today) {
        newErrors.paymentDate = "Payment date cannot be in the future"
      }
    }

    // Validate payment reference length
    if (paymentReference && paymentReference.length > 100) {
      newErrors.paymentReference = "Payment reference cannot exceed 100 characters"
    }

    // Validate payment proof URL
    if (paymentProofUrl) {
      try {
        const url = new URL(paymentProofUrl)
        if (!["http:", "https:"].includes(url.protocol)) {
          newErrors.paymentProofUrl = "URL must start with http:// or https://"
        }
      } catch {
        newErrors.paymentProofUrl = "Invalid URL format (e.g., https://example.com/receipt.pdf)"
      }
    }

    // Validate principal + interest = total
    const calculatedTotal = principal + interest
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      newErrors.root = "Principal + Interest must equal Total Amount"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!validateForm() || !user?.email || !selectedLender) {
      return
    }

    setIsSubmitting(true)

    const principal = Number.parseFloat(principalPortion)
    const interest = Number.parseFloat(interestPortion)

    const requestBody: SubmitPaymentRequest = {
      loan_lender_id: lenderId,
      loan_id: loanId,
      amount: totalAmount,
      principal_portion: principal,
      interest_portion: interest,
      payment_date: paymentDate,
      status: "pending",
    }

    // Add optional fields only if provided
    if (paymentMethod) {
      requestBody.payment_method = paymentMethod
    }
    if (paymentReference?.trim()) {
      requestBody.payment_reference = paymentReference.trim()
    }
    if (paymentProofUrl?.trim()) {
      requestBody.payment_proof_url = paymentProofUrl.trim()
    }

    const result = await submitPayment(requestBody, user.email, activeRole)
    setIsSubmitting(false)

    if (result.error) {
      // Handle specific database errors
      if (result.error.includes("exceeds remaining balance")) {
        toast({
          title: "Payment Exceeds Balance",
          description: "The principal amount exceeds the lender's remaining balance.",
          variant: "destructive",
        })
      } else if (result.error.includes("valid_payment_portions")) {
        toast({
          title: "Invalid Payment Portions",
          description: "Principal + Interest must equal Total Amount. Please check your calculations.",
          variant: "destructive",
        })
      } else if (result.error.includes("payment_reference")) {
        toast({
          title: "Duplicate Payment Reference",
          description: "This payment reference already exists. Please use a unique transaction ID.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to submit payment. Please try again.",
          variant: "destructive",
        })
      }
      return
    }

    if (!result.data) {
      toast({
        title: "Permission Denied",
        description: "You can only submit payments for your own loans.",
        variant: "destructive",
      })
      return
    }

    // SUCCESS!
    toast({
      title: "Payment Submitted",
      description: `Payment of ${formatCurrency(result.data.amount)} submitted for review. Lender ${result.data.lender_email} will be notified.`,
    })

    // Navigate back to loan detail page, Repayments tab
    router.push(`/loans/${loanId}?tab=repayments`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Empty state - no lenders available
  if (!lendersData?.available) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
          <h1 className="text-2xl font-bold">All Lenders Fully Repaid</h1>
          <p className="text-muted-foreground text-center">
            All accepted lenders have been fully repaid for this loan.
          </p>
          <Button onClick={() => router.push(`/loans/${loanId}`)}>Back to Loan Details</Button>
        </div>
      </div>
    )
  }

  // Sort lenders by remaining balance descending
  const sortedLenders = [...lendersData.lenders].sort(
    (a, b) => Number.parseFloat(b.remaining_balance) - Number.parseFloat(a.remaining_balance),
  )

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/loans/${loanId}`)}
          aria-label="Back to loan details"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">Submit Payment</h1>
          <p className="text-muted-foreground">Record a payment made to a lender for approval</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>Enter the details of the payment you made to a lender</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Select Lender */}
            <div className="space-y-2">
              <Label htmlFor="lender">
                Lender <span className="text-destructive">*</span>
              </Label>
              <Select value={lenderId} onValueChange={handleLenderChange}>
                <SelectTrigger id="lender" className={errors.lenderId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select a lender..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedLenders.map((lender) => (
                    <SelectItem key={lender.id} value={lender.id}>
                      {lender.lender_email} - {formatCurrency(Number.parseFloat(lender.remaining_balance))} remaining
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lenderId && <p className="text-sm text-destructive">{errors.lenderId}</p>}
            </div>

            {/* Lender Info Card */}
            {selectedLender && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-600">Lender Email</Label>
                      <p className="font-semibold text-sm">{selectedLender.lender_email}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Original Allocation</Label>
                      <p className="font-semibold text-sm">
                        {formatCurrency(Number.parseFloat(selectedLender.allocated_amount))}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Remaining Balance</Label>
                      <p className="font-semibold text-sm text-blue-600">
                        {formatCurrency(Number.parseFloat(selectedLender.remaining_balance))}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Already Repaid</Label>
                      <p className="font-semibold text-sm text-green-600">
                        {formatCurrency(
                          Number.parseFloat(selectedLender.allocated_amount) -
                            Number.parseFloat(selectedLender.remaining_balance),
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Principal Portion */}
            <div className="space-y-2">
              <Label htmlFor="principal">
                Principal Portion <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="principal"
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedLender?.remaining_balance}
                  placeholder="1,400.00"
                  className={`pl-6 ${errors.principalPortion ? "border-destructive" : ""}`}
                  value={principalPortion}
                  onChange={(e) => setPrincipalPortion(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Maximum: <strong>{formatCurrency(Number.parseFloat(selectedLender?.remaining_balance || "0"))}</strong>
                {principalPortion && selectedLender && Number.parseFloat(principalPortion) > 0 && (
                  <span className="block mt-1 text-blue-600">
                    After this payment:{" "}
                    {formatCurrency(
                      Number.parseFloat(selectedLender.remaining_balance) - Number.parseFloat(principalPortion),
                    )}{" "}
                    remaining
                  </span>
                )}
              </p>
              {errors.principalPortion && <p className="text-sm text-destructive">{errors.principalPortion}</p>}
            </div>

            {/* Interest Portion */}
            <div className="space-y-2">
              <Label htmlFor="interest">
                Interest Portion <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="interest"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="100.00"
                  className={`pl-6 ${errors.interestPortion ? "border-destructive" : ""}`}
                  value={interestPortion}
                  onChange={(e) => setInterestPortion(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">Can be $0 if no interest charged</p>
              {errors.interestPortion && <p className="text-sm text-destructive">{errors.interestPortion}</p>}
            </div>

            {/* Total Payment Amount */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <Label className="text-sm text-gray-600">Total Payment Amount</Label>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Principal ({formatCurrency(Number.parseFloat(principalPortion || "0"))}) + Interest (
                {formatCurrency(Number.parseFloat(interestPortion || "0"))})
              </p>
            </div>

            {/* Running Balance Calculation */}
            {selectedLender && principalPortion && Number.parseFloat(principalPortion) > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  After this payment, lender's remaining balance will be:{" "}
                  <strong className="text-blue-600">
                    {formatCurrency(
                      Number.parseFloat(selectedLender.remaining_balance) - Number.parseFloat(principalPortion),
                    )}
                  </strong>
                  {Number.parseFloat(selectedLender.remaining_balance) - Number.parseFloat(principalPortion) === 0 && (
                    <span className="block text-green-600 mt-1">✓ This payment will fully repay this lender</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Overpayment Warning */}
            {principalPortion &&
              selectedLender &&
              Number.parseFloat(principalPortion) > Number.parseFloat(selectedLender.remaining_balance) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Exceeds remaining balance by{" "}
                    {formatCurrency(
                      Number.parseFloat(principalPortion) - Number.parseFloat(selectedLender.remaining_balance),
                    )}
                  </AlertDescription>
                </Alert>
              )}

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="paymentDate">
                Payment Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="paymentDate"
                type="date"
                max={new Date().toISOString().split("T")[0]}
                className={errors.paymentDate ? "border-destructive" : ""}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">Date when payment was made (cannot be future date)</p>
              {errors.paymentDate && <p className="text-sm text-destructive">{errors.paymentDate}</p>}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method (Optional)</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select payment method..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">How payment was made (stored as free text)</p>
            </div>

            {/* Payment Reference */}
            <div className="space-y-2">
              <Label htmlFor="paymentReference">Payment Reference / Transaction ID (Optional)</Label>
              <Input
                id="paymentReference"
                type="text"
                placeholder="TXN-20241030-001"
                maxLength={100}
                className={errors.paymentReference ? "border-destructive" : ""}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Transaction ID, check number, or reference (must be unique across all payments)
              </p>
              {errors.paymentReference && <p className="text-sm text-destructive">{errors.paymentReference}</p>}
            </div>

            {/* Payment Proof URL */}
            <div className="space-y-2">
              <Label htmlFor="paymentProofUrl">Payment Receipt URL (Optional)</Label>
              <Input
                id="paymentProofUrl"
                type="url"
                placeholder="https://drive.google.com/file/..."
                className={errors.paymentProofUrl ? "border-destructive" : ""}
                value={paymentProofUrl}
                onChange={(e) => setPaymentProofUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Upload receipt to cloud storage (Google Drive, Dropbox) and paste URL here.
                <span className="block text-xs mt-1">Direct file upload coming in future version</span>
              </p>
              {errors.paymentProofUrl && <p className="text-sm text-destructive">{errors.paymentProofUrl}</p>}
            </div>

            {/* Root Error */}
            {errors.root && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.root}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/loans/${loanId}`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !selectedLender}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit for Review"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
