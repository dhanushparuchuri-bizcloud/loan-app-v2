"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useUser } from "@/lib/user-context"
import { fetchCurrentAllocation, checkExistingInvitation, inviteLender } from "@/lib/api"
import type { InviteLenderRequest } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface InviteLenderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanId: string
  loanPrincipal: number
  onSuccess?: () => void
}

export function InviteLenderModal({ open, onOpenChange, loanId, loanPrincipal, onSuccess }: InviteLenderModalProps) {
  const { user, activeRole } = useUser()
  const { toast } = useToast()

  const [lenderEmail, setLenderEmail] = useState("")
  const [allocatedAmount, setAllocatedAmount] = useState("")
  const [personalMessage, setPersonalMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingAllocation, setIsLoadingAllocation] = useState(false)

  const [totalAllocated, setTotalAllocated] = useState(0)
  const [remainingToAllocate, setRemainingToAllocate] = useState(0)
  const [remainingAfterThis, setRemainingAfterThis] = useState<number | null>(null)

  const [emailError, setEmailError] = useState("")
  const [amountError, setAmountError] = useState("")

  // Fetch current allocation when modal opens
  useEffect(() => {
    if (open && user?.email) {
      loadCurrentAllocation()
    }
  }, [open, loanId, user?.email])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setLenderEmail("")
      setAllocatedAmount("")
      setPersonalMessage("")
      setEmailError("")
      setAmountError("")
      setRemainingAfterThis(null)
    }
  }, [open])

  async function loadCurrentAllocation() {
    if (!user?.email) return

    setIsLoadingAllocation(true)
    const result = await fetchCurrentAllocation(loanId, user.email, activeRole)
    setIsLoadingAllocation(false)

    if (result.data !== null) {
      setTotalAllocated(result.data)
      setRemainingToAllocate(loanPrincipal - result.data)
    }
  }

  async function handleEmailBlur() {
    if (!lenderEmail || !lenderEmail.includes("@") || !user?.email) return

    setEmailError("")

    // Check if trying to invite self
    if (lenderEmail.toLowerCase() === user.email.toLowerCase()) {
      setEmailError("You cannot invite yourself to your own loan")
      return
    }

    // Check if already invited
    const result = await checkExistingInvitation(loanId, lenderEmail, user.email, activeRole)
    if (result.data) {
      setEmailError("This lender is already invited to this loan")
    }
  }

  function handleAmountChange(value: string) {
    setAllocatedAmount(value)
    setAmountError("")

    const amount = Number.parseFloat(value || "0")
    if (amount > 0) {
      setRemainingAfterThis(remainingToAllocate - amount)
    } else {
      setRemainingAfterThis(null)
    }
  }

  function validateForm(): boolean {
    let isValid = true

    // Validate email
    if (!lenderEmail) {
      setEmailError("Email is required")
      isValid = false
    } else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(lenderEmail)) {
      setEmailError("Invalid email format")
      isValid = false
    } else if (user?.email && lenderEmail.toLowerCase() === user.email.toLowerCase()) {
      setEmailError("You cannot invite yourself to your own loan")
      isValid = false
    }

    // Validate amount
    if (!allocatedAmount) {
      setAmountError("Amount is required")
      isValid = false
    } else {
      const amount = Number.parseFloat(allocatedAmount)
      if (isNaN(amount) || amount <= 0) {
        setAmountError("Amount must be greater than $0")
        isValid = false
      } else if (amount > remainingToAllocate) {
        setAmountError(`Amount cannot exceed ${formatCurrency(remainingToAllocate)} (remaining allocation)`)
        isValid = false
      }
    }

    return isValid
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!user?.email) return

    // Validate form
    if (!validateForm()) return

    setIsSubmitting(true)

    const inviteData: InviteLenderRequest = {
      loan_id: loanId,
      lender_email: lenderEmail.trim(),
      allocated_amount: Number.parseFloat(allocatedAmount),
      invitation_status: "pending",
    }

    const result = await inviteLender(inviteData, user.email, activeRole)
    setIsSubmitting(false)

    if (result.error) {
      // Handle specific database errors
      const errorMessage = result.error.toLowerCase()

      if (errorMessage.includes("cannot allocate") || errorMessage.includes("exceed")) {
        toast({
          title: "Over-Allocation Error",
          description: `Cannot allocate this amount. The total invited amount would exceed the loan principal. Current allocated: ${formatCurrency(totalAllocated)}. You can only allocate up to ${formatCurrency(remainingToAllocate)}.`,
          variant: "destructive",
        })
      } else if (errorMessage.includes("duplicate") || errorMessage.includes("already exists")) {
        toast({
          title: "Duplicate Invitation",
          description:
            "This lender is already invited to this loan. Check the Lenders tab to see existing invitations.",
          variant: "destructive",
        })
      } else if (errorMessage.includes("invite yourself")) {
        toast({
          title: "Invalid Invitation",
          description: "You cannot invite yourself to your own loan",
          variant: "destructive",
        })
      } else if (result.data === null) {
        toast({
          title: "Permission Denied",
          description: "You can only invite lenders to your own loans.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to send invitation. Please try again.",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${lenderEmail}. Allocated amount: ${formatCurrency(Number.parseFloat(allocatedAmount))}`,
      })

      onOpenChange(false)
      onSuccess?.()
    }
  }

  const allocationPercentage = (totalAllocated / loanPrincipal) * 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="invite-lender-description">
        <DialogHeader>
          <DialogTitle>Invite Lender</DialogTitle>
          <DialogDescription id="invite-lender-description">
            Invite a lender to participate in this loan by allocating a portion of the principal amount.
          </DialogDescription>
        </DialogHeader>

        {isLoadingAllocation ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Allocation Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                  <p className="text-gray-600">Loan Amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(loanPrincipal)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Currently Allocated</p>
                  <p className="text-lg font-semibold">{formatCurrency(totalAllocated)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Available to Allocate</p>
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(remainingToAllocate)}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(allocationPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">{allocationPercentage.toFixed(1)}% allocated</p>
              </div>

              {remainingToAllocate === 0 && (
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Loan is fully allocated. You cannot invite more lenders unless an invitation is declined or revoked.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Lender Email */}
              <div className="space-y-2">
                <Label htmlFor="lenderEmail">
                  Lender Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lenderEmail"
                  type="email"
                  placeholder="lender@example.com"
                  value={lenderEmail}
                  onChange={(e) => {
                    setLenderEmail(e.target.value)
                    setEmailError("")
                  }}
                  onBlur={handleEmailBlur}
                  disabled={isSubmitting}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                />
                {emailError && (
                  <p id="email-error" className="text-sm text-red-600" role="alert">
                    {emailError}
                  </p>
                )}
              </div>

              {/* Allocated Amount */}
              <div className="space-y-2">
                <Label htmlFor="allocatedAmount">
                  Amount to Allocate <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    id="allocatedAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={remainingToAllocate}
                    placeholder="15,000.00"
                    className="pl-6"
                    value={allocatedAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    disabled={isSubmitting || remainingToAllocate <= 0}
                    aria-invalid={!!amountError}
                    aria-describedby="amount-description amount-error"
                  />
                </div>
                <div id="amount-description" className="text-sm text-muted-foreground">
                  Available to allocate: <strong>{formatCurrency(remainingToAllocate)}</strong>
                  {remainingAfterThis !== null && remainingAfterThis >= 0 && (
                    <span className="block text-green-600 mt-1">
                      After this invitation: {formatCurrency(remainingAfterThis)} remaining
                    </span>
                  )}
                  {remainingAfterThis !== null && remainingAfterThis < 0 && (
                    <span className="block text-red-600 mt-1">
                      ⚠️ This would over-allocate by {formatCurrency(Math.abs(remainingAfterThis))}
                    </span>
                  )}
                </div>
                {amountError && (
                  <p id="amount-error" className="text-sm text-red-600" role="alert">
                    {amountError}
                  </p>
                )}
              </div>

              {/* Personal Message (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="personalMessage">Personal Message (Optional)</Label>
                <Textarea
                  id="personalMessage"
                  rows={3}
                  placeholder="Add a message for the lender..."
                  maxLength={500}
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  disabled={isSubmitting}
                  aria-describedby="message-description"
                />
                <div id="message-description" className="text-sm text-muted-foreground">
                  {personalMessage.length} / 500 characters
                  <span className="block text-xs text-gray-500 mt-1">
                    Note: Message functionality will be added in a future release
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || remainingToAllocate <= 0}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
