"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import {
  fetchPendingRepayments,
  fetchLoanDetailsForRepayment,
  fetchBorrowerDetailsForRepayment,
  reviewRepayment,
} from "@/lib/api"
import type { EnrichedRepayment, Repayment } from "@/lib/types"
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, CheckCircle2, Loader2, ExternalLink, ImageIcon, Check, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const methodColors = {
  bank_transfer: "bg-blue-100 text-blue-800 border-blue-200",
  check: "bg-purple-100 text-purple-800 border-purple-200",
  ach: "bg-green-100 text-green-800 border-green-200",
  cash: "bg-yellow-100 text-yellow-800 border-yellow-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
}

export default function ReviewRepaymentsPage() {
  const router = useRouter()
  const { user, activeRole } = useUser()
  const { toast } = useToast()

  const [repayments, setRepayments] = useState<EnrichedRepayment[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showEmptyState, setShowEmptyState] = useState(false)

  // Approve dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [selectedRepayment, setSelectedRepayment] = useState<EnrichedRepayment | null>(null)
  const [approveNotes, setApproveNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")

  // Proof modal state
  const [proofModalOpen, setProofModalOpen] = useState(false)
  const [selectedProof, setSelectedProof] = useState("")

  useEffect(() => {
    if (user?.email) {
      loadData()
    }
  }, [user?.email])

  async function loadData() {
    if (!user?.email) return

    setIsLoading(true)

    try {
      // Fetch pending repayments
      const repaymentsResult = await fetchPendingRepayments(user.email, user.email, activeRole)

      if (repaymentsResult.error) {
        throw new Error(repaymentsResult.error)
      }

      const repaymentsData = repaymentsResult.data || []

      if (repaymentsData.length === 0) {
        setShowEmptyState(true)
        setIsLoading(false)
        return
      }

      // Enrich with loan and borrower data
      const enrichedData = await enrichRepaymentData(repaymentsData)

      setRepayments(enrichedData)
      setPendingCount(enrichedData.length)
    } catch (error) {
      console.error("[v0] Failed to load repayments:", error)
      toast({
        title: "Error",
        description: "Failed to load repayments. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function enrichRepaymentData(repayments: Repayment[]): Promise<EnrichedRepayment[]> {
    if (!user?.email) return []

    // Extract unique IDs
    const loanIds = [...new Set(repayments.map((r) => r.loan_id))]
    const borrowerIds = [...new Set(repayments.map((r) => r.borrower_id))]

    // Fetch data in parallel
    const [loansResults, borrowersResults] = await Promise.all([
      Promise.all(loanIds.map((loanId) => fetchLoanDetailsForRepayment(loanId, user.email, activeRole))),
      Promise.all(
        borrowerIds.map((borrowerId) => fetchBorrowerDetailsForRepayment(borrowerId, user.email, activeRole)),
      ),
    ])

    // Create lookup maps
    const loansMap: Record<string, { loan_name: string }> = {}
    loansResults.forEach((result) => {
      if (result.data) {
        loansMap[result.data.id] = { loan_name: result.data.loan_name }
      }
    })

    const borrowersMap: Record<string, { full_name: string; email: string }> = {}
    borrowersResults.forEach((result) => {
      if (result.data) {
        borrowersMap[result.data.id] = {
          full_name: result.data.full_name,
          email: result.data.email,
        }
      }
    })

    // Enrich repayments
    return repayments.map((repayment) => ({
      ...repayment,
      loan_name: loansMap[repayment.loan_id]?.loan_name || "Unknown Loan",
      borrower_name: borrowersMap[repayment.borrower_id]?.full_name || "Unknown Borrower",
      borrower_email: borrowersMap[repayment.borrower_id]?.email || "",
    }))
  }

  function handleApprove(repayment: EnrichedRepayment) {
    setSelectedRepayment(repayment)
    setApproveNotes("")
    setApproveDialogOpen(true)
  }

  async function confirmApprove() {
    if (!selectedRepayment || !user?.id || !user?.email) return

    try {
      setIsSubmitting(true)

      const result = await reviewRepayment(
        selectedRepayment.id,
        {
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: approveNotes.trim() || undefined,
        },
        user.email,
        activeRole,
      )

      if (result.error) {
        throw new Error(result.error)
      }

      if (!result.data) {
        throw new Error("Unable to approve payment. It may have already been reviewed.")
      }

      toast({
        title: "Payment Approved",
        description: `Payment of ${formatCurrency(Number.parseFloat(selectedRepayment.amount))} approved. Remaining balance has been updated automatically.`,
      })

      // Remove from list
      setRepayments((prev) => prev.filter((r) => r.id !== selectedRepayment.id))
      setPendingCount((prev) => prev - 1)

      // Close dialog
      setApproveDialogOpen(false)
      setSelectedRepayment(null)
      setApproveNotes("")
    } catch (error) {
      console.error("[v0] Failed to approve payment:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve payment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleReject(repayment: EnrichedRepayment) {
    setSelectedRepayment(repayment)
    setRejectNotes("")
    setRejectDialogOpen(true)
  }

  async function confirmReject() {
    if (!selectedRepayment || !user?.id || !user?.email) return

    // Validate review notes
    if (!rejectNotes || rejectNotes.trim().length < 10) {
      toast({
        title: "Validation Error",
        description: "Please provide detailed rejection reason (minimum 10 characters)",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const result = await reviewRepayment(
        selectedRepayment.id,
        {
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: rejectNotes.trim(),
        },
        user.email,
        activeRole,
      )

      if (result.error) {
        throw new Error(result.error)
      }

      if (!result.data) {
        throw new Error("Unable to reject payment. It may have already been reviewed.")
      }

      toast({
        title: "Payment Rejected",
        description: `Payment of ${formatCurrency(Number.parseFloat(selectedRepayment.amount))} rejected. Borrower will be notified.`,
        variant: "destructive",
      })

      // Remove from list
      setRepayments((prev) => prev.filter((r) => r.id !== selectedRepayment.id))
      setPendingCount((prev) => prev - 1)

      // Close dialog
      setRejectDialogOpen(false)
      setSelectedRepayment(null)
      setRejectNotes("")
    } catch (error) {
      console.error("[v0] Failed to reject payment:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject payment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function renderPaymentProof(paymentProofUrl?: string) {
    if (!paymentProofUrl) {
      return <span className="text-gray-400 text-sm">No proof</span>
    }

    // Check if image file
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    const isImage = imageExtensions.some((ext) => paymentProofUrl.toLowerCase().endsWith(ext))

    if (isImage) {
      return (
        <button
          onClick={() => {
            setSelectedProof(paymentProofUrl)
            setProofModalOpen(true)
          }}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
          type="button"
        >
          <ImageIcon className="h-4 w-4" />
          <span className="text-sm">View Image</span>
        </button>
      )
    }

    // Generic URL (PDF or other)
    return (
      <a
        href={paymentProofUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
        <span className="text-sm">View Proof</span>
      </a>
    )
  }

  function renderMethodBadge(method?: string) {
    if (!method) return null

    const colorClass = methodColors[method as keyof typeof methodColors] || methodColors.other

    return (
      <Badge variant="outline" className={`${colorClass} border`}>
        {method.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="border-b pb-4 mb-6">
          <Skeleton className="h-10 w-10 mb-2" />
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (showEmptyState) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="border-b pb-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Review Repayments</h1>
          <p className="text-gray-600 mt-1">Approve or reject borrower payment submissions</p>
        </div>

        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900">No Pending Repayments</h3>
          <p className="text-gray-600 mt-2 text-center max-w-md">
            All submitted payments have been reviewed. New submissions will appear here.
          </p>
          <Button variant="outline" onClick={() => router.push("/dashboard")} className="mt-6">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="border-b pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Review Repayments</h1>
            <p className="text-gray-600 mt-1">Approve or reject borrower payment submissions</p>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="h-8 px-3 text-lg">
              {pendingCount} Pending
            </Badge>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loan Name</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead className="text-right">Interest</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Proof</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repayments.map((repayment) => (
              <TableRow key={repayment.id}>
                <TableCell>
                  <button
                    onClick={() => router.push(`/loans/${repayment.loan_id}`)}
                    className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    type="button"
                  >
                    {repayment.loan_name}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{repayment.borrower_name}</span>
                    <span className="text-xs text-gray-500">{repayment.borrower_email}</span>
                  </div>
                </TableCell>
                <TableCell>{formatDate(repayment.payment_date)}</TableCell>
                <TableCell className="text-right font-bold text-lg">
                  {formatCurrency(Number.parseFloat(repayment.amount))}
                </TableCell>
                <TableCell className="text-right text-gray-600 text-sm">
                  {formatCurrency(Number.parseFloat(repayment.principal_portion))}
                </TableCell>
                <TableCell className="text-right text-gray-600 text-sm">
                  {formatCurrency(Number.parseFloat(repayment.interest_portion))}
                </TableCell>
                <TableCell>{renderMethodBadge(repayment.payment_method)}</TableCell>
                <TableCell>{renderPaymentProof(repayment.payment_proof_url)}</TableCell>
                <TableCell className="text-sm text-gray-600">{formatRelativeTime(repayment.submitted_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(repayment)}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                      aria-label={`Approve payment of ${formatCurrency(Number.parseFloat(repayment.amount))}`}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(repayment)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      aria-label={`Reject payment of ${formatCurrency(Number.parseFloat(repayment.amount))}`}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this payment of{" "}
              <strong>{selectedRepayment && formatCurrency(Number.parseFloat(selectedRepayment.amount))}</strong>?
            </AlertDialogDescription>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <div className="text-gray-700">
                <strong>Principal:</strong>{" "}
                {selectedRepayment && formatCurrency(Number.parseFloat(selectedRepayment.principal_portion))}
              </div>
              <div className="text-gray-700">
                <strong>Interest:</strong>{" "}
                {selectedRepayment && formatCurrency(Number.parseFloat(selectedRepayment.interest_portion))}
              </div>
              <div className="text-blue-600 mt-2">Your remaining balance will be automatically decreased.</div>
            </div>
          </AlertDialogHeader>

          <div className="mt-4">
            <Label htmlFor="approve-notes">Review Notes (Optional)</Label>
            <Textarea
              id="approve-notes"
              placeholder="Add any notes about this approval..."
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApprove}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                "Approve Payment"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reject this payment of{" "}
              <strong>{selectedRepayment && formatCurrency(Number.parseFloat(selectedRepayment.amount))}</strong>. The
              borrower will be able to resubmit.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-4">
            <Label htmlFor="reject-notes">
              Rejection Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reject-notes"
              placeholder="Please explain why this payment is rejected (e.g., 'Payment proof unclear', 'Amount mismatch')..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
              required
              className={`mt-1 ${rejectNotes.length < 10 ? "border-red-300" : ""}`}
            />
            <p className="text-xs text-gray-500 mt-1">{rejectNotes.length} / 500 characters (minimum 10 required)</p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReject}
              disabled={isSubmitting || rejectNotes.length < 10}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject Payment"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Proof Modal */}
      <Dialog open={proofModalOpen} onOpenChange={setProofModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center bg-gray-100 rounded-lg p-4">
            <img
              src={selectedProof || "/placeholder.svg"}
              alt="Payment proof"
              className="max-h-[70vh] max-w-full object-contain"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProofModalOpen(false)}>
              Close
            </Button>
            <Button asChild>
              <a href={selectedProof} target="_blank" rel="noopener noreferrer">
                Open in New Tab
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
