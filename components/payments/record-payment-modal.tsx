"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ReceiptUpload } from "./receipt-upload"
import { apiClient, type LoanParticipant } from "@/lib/api-client"
import { Loader2, DollarSign, Calendar, FileText, AlertCircle } from "lucide-react"

interface RecordPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanId: string
  lenders: LoanParticipant[]
  onSuccess: () => void
}

export function RecordPaymentModal({
  open,
  onOpenChange,
  loanId,
  lenders,
  onSuccess
}: RecordPaymentModalProps) {
  const [selectedLenderId, setSelectedLenderId] = useState<string>(lenders[0]?.lender_id || '')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedLender = lenders.find(l => l.lender_id === selectedLenderId)
  const remaining_balance = selectedLender?.remaining_balance ?? selectedLender?.contribution_amount ?? 0

  const isValid = selectedLenderId && amount && Number(amount) > 0 && paymentDate

  const handleSubmit = async () => {
    if (!isValid) return

    try {
      setIsSubmitting(true)
      setError(null)

      let receiptKey: string | undefined

      // If file selected, upload to S3 first
      if (selectedFile && selectedLenderId) {
        // Get upload URL
        const uploadResponse = await apiClient.getPaymentUploadUrl(
          loanId,
          selectedLenderId,
          selectedFile.name,
          selectedFile.type
        )

        // Upload file to S3
        await apiClient.uploadReceipt(uploadResponse.data.upload_url, selectedFile)

        // Store the receipt key for payment submission
        receiptKey = uploadResponse.data.file_key
      }

      // Submit payment
      await apiClient.submitPayment({
        loan_id: loanId,
        lender_id: selectedLenderId,
        amount: Number(amount),
        payment_date: paymentDate,
        notes: notes.trim() || undefined,
        receipt_key: receiptKey
      })

      // Success! Reset and close
      setAmount('')
      setNotes('')
      setSelectedFile(null)
      setPaymentDate(new Date().toISOString().split('T')[0])
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const newBalance = remaining_balance - Number(amount || 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment made to your lender. They will review and approve it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Lender Selection */}
          {lenders.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="lender">Lender</Label>
              <select
                id="lender"
                value={selectedLenderId}
                onChange={(e) => setSelectedLenderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {lenders.map((lender) => (
                  <option key={lender.lender_id} value={lender.lender_id}>
                    {lender.lender_name} ({lender.lender_email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {lenders.length === 1 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm font-medium">{lenders[0].lender_name}</p>
              <p className="text-xs text-muted-foreground">{lenders[0].lender_email}</p>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Payment Amount <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="pl-9"
              />
            </div>
            {amount && Number(amount) > remaining_balance && (
              <p className="text-xs text-amber-600">
                ⚠️ Amount exceeds remaining balance (${remaining_balance.toLocaleString()})
              </p>
            )}
            {amount && Number(amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                New balance: ${newBalance.toLocaleString()}
              </p>
            )}
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="payment-date">
              Payment Date <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="pl-9"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              <FileText className="inline h-4 w-4 mr-1" />
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this payment..."
              rows={3}
            />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label>Payment Receipt (Optional)</Label>
            <ReceiptUpload
              selectedFile={selectedFile}
              onFileSelected={setSelectedFile}
              onFileRemoved={() => setSelectedFile(null)}
            />
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Payment'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
