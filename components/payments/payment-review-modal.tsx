"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { apiClient, type Payment } from "@/lib/api-client"
import { Loader2, CheckCircle, XCircle, FileText, Download, Calendar, DollarSign, User, AlertCircle } from "lucide-react"

interface PaymentReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: Payment | null
  borrowerName?: string
  onSuccess: () => void
}

export function PaymentReviewModal({
  open,
  onOpenChange,
  payment,
  borrowerName,
  onSuccess
}: PaymentReviewModalProps) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)

  const handleApprove = async () => {
    if (!payment) return

    try {
      setIsSubmitting(true)
      setError(null)

      await apiClient.approvePayment(payment.payment_id, approvalNotes.trim() || undefined)

      setAction(null)
      setApprovalNotes('')
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!payment || !rejectionReason.trim()) {
      setError('Rejection reason is required')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      await apiClient.rejectPayment(payment.payment_id, rejectionReason.trim())

      setAction(null)
      setRejectionReason('')
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleViewReceipt = async () => {
    if (!payment?.receipt_key) return

    try {
      setLoadingReceipt(true)
      const response = await apiClient.getReceiptUrl(payment.payment_id)
      setReceiptUrl(response.data.url)
      // Open in new tab
      window.open(response.data.url, '_blank')
    } catch (err) {
      setError('Failed to load receipt')
    } finally {
      setLoadingReceipt(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (!payment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Payment</DialogTitle>
          <DialogDescription>
            Review and approve or reject this payment from the borrower.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Payment Status Badge */}
          <div className="flex items-center justify-between">
            <Badge
              variant={payment.status === 'APPROVED' ? 'default' : payment.status === 'REJECTED' ? 'destructive' : 'secondary'}
              className="text-sm"
            >
              {payment.status}
            </Badge>
            {payment.receipt_key && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewReceipt}
                disabled={loadingReceipt}
              >
                {loadingReceipt ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                View Receipt
              </Button>
            )}
          </div>

          {/* Payment Details */}
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Payment Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(payment.amount)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Payment Date</p>
                <p className="font-medium">{formatDate(payment.payment_date)}</p>
              </div>
            </div>

            {borrowerName && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="font-medium">{borrowerName}</p>
                </div>
              </div>
            )}

            {payment.notes && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Borrower Notes</p>
                  <p className="text-sm">{payment.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Selection or Forms */}
          {!action && payment.status === 'PENDING' && (
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setAction('reject')}
                className="flex-1 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={() => setAction('approve')}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </div>
          )}

          {/* Approval Form */}
          {action === 'approve' && (
            <div className="space-y-3 p-4 border-2 border-green-200 dark:border-green-900 rounded-lg bg-green-50 dark:bg-green-950">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <h3 className="font-semibold">Approve Payment</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-notes" className="text-sm">
                  Approval Notes (Optional)
                </Label>
                <Textarea
                  id="approval-notes"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add any notes for the borrower..."
                  rows={3}
                  className="bg-white dark:bg-gray-950"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAction(null)
                    setApprovalNotes('')
                  }}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    'Confirm Approval'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Rejection Form */}
          {action === 'reject' && (
            <div className="space-y-3 p-4 border-2 border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-950">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <XCircle className="h-5 w-5" />
                <h3 className="font-semibold">Reject Payment</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejection-reason" className="text-sm">
                  Rejection Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  rows={3}
                  className="bg-white dark:bg-gray-950"
                />
                <p className="text-xs text-muted-foreground">
                  The borrower will see this reason
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAction(null)
                    setRejectionReason('')
                  }}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={isSubmitting || !rejectionReason.trim()}
                  variant="destructive"
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    'Confirm Rejection'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Already Approved/Rejected Info */}
          {payment.status === 'APPROVED' && (
            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                This payment was approved on {formatDate(payment.approved_at || payment.updated_at)}
                {payment.approval_notes && (
                  <p className="mt-2 text-sm">Notes: {payment.approval_notes}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {payment.status === 'REJECTED' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                This payment was rejected on {formatDate(payment.rejected_at || payment.updated_at)}
                {payment.rejection_reason && (
                  <p className="mt-2 text-sm">Reason: {payment.rejection_reason}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Close Button for non-pending payments */}
          {payment.status !== 'PENDING' && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
