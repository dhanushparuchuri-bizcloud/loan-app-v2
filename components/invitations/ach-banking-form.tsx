"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"

interface ACHBankingFormProps {
  onSubmit: (data: {
    ach_routing_number: string
    ach_account_number_encrypted: string
    ach_account_type: "checking" | "savings"
  }) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function ACHBankingForm({ onSubmit, onCancel, isSubmitting = false }: ACHBankingFormProps) {
  const [routingNumber, setRoutingNumber] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking")
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Validate routing number (exactly 9 digits)
    if (!routingNumber) {
      newErrors.routingNumber = "Routing number is required"
    } else if (!/^\d{9}$/.test(routingNumber)) {
      newErrors.routingNumber = "Routing number must be exactly 9 digits"
    }

    // Validate account number
    if (!accountNumber) {
      newErrors.accountNumber = "Account number is required"
    } else if (accountNumber.length < 4) {
      newErrors.accountNumber = "Account number must be at least 4 characters"
    }

    // Validate confirmation
    if (!confirmed) {
      newErrors.confirmed = "Please confirm your banking details are correct"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    await onSubmit({
      ach_routing_number: routingNumber,
      ach_account_number_encrypted: accountNumber,
      ach_account_type: accountType,
    })
  }

  const handleRoutingNumberChange = (value: string) => {
    // Only allow digits
    const cleaned = value.replace(/\D/g, "")
    if (cleaned.length <= 9) {
      setRoutingNumber(cleaned)
      if (errors.routingNumber) {
        setErrors({ ...errors, routingNumber: "" })
      }
    }
  }

  const handleAccountNumberChange = (value: string) => {
    setAccountNumber(value)
    if (errors.accountNumber) {
      setErrors({ ...errors, accountNumber: "" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="routing-number" className="text-sm font-medium">
            Routing Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="routing-number"
            type="text"
            inputMode="numeric"
            placeholder="123456789"
            value={routingNumber}
            onChange={(e) => handleRoutingNumberChange(e.target.value)}
            disabled={isSubmitting}
            className={errors.routingNumber ? "border-red-500" : ""}
            aria-invalid={!!errors.routingNumber}
            aria-describedby={errors.routingNumber ? "routing-error" : undefined}
          />
          <p className="text-xs text-muted-foreground">9 digits</p>
          {errors.routingNumber && (
            <p id="routing-error" className="text-xs text-red-500">
              {errors.routingNumber}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-number" className="text-sm font-medium">
            Account Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="account-number"
            type="text"
            placeholder="Enter your account number"
            value={accountNumber}
            onChange={(e) => handleAccountNumberChange(e.target.value)}
            disabled={isSubmitting}
            className={errors.accountNumber ? "border-red-500" : ""}
            aria-invalid={!!errors.accountNumber}
            aria-describedby={errors.accountNumber ? "account-error" : undefined}
          />
          {errors.accountNumber && (
            <p id="account-error" className="text-xs text-red-500">
              {errors.accountNumber}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Account Type <span className="text-red-500">*</span>
          </Label>
          <RadioGroup
            value={accountType}
            onValueChange={(value) => setAccountType(value as "checking" | "savings")}
            disabled={isSubmitting}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="checking" id="checking" />
              <Label htmlFor="checking" className="font-normal cursor-pointer">
                Checking
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="savings" id="savings" />
              <Label htmlFor="savings" className="font-normal cursor-pointer">
                Savings
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex items-start space-x-2 pt-2">
          <Checkbox
            id="confirm"
            checked={confirmed}
            onCheckedChange={(checked) => {
              setConfirmed(checked as boolean)
              if (errors.confirmed) {
                setErrors({ ...errors, confirmed: "" })
              }
            }}
            disabled={isSubmitting}
            aria-invalid={!!errors.confirmed}
          />
          <Label htmlFor="confirm" className="text-sm font-normal leading-relaxed cursor-pointer">
            I confirm that the banking details provided are correct and I authorize repayments to be deposited to this
            account.
          </Label>
        </div>
        {errors.confirmed && <p className="text-xs text-red-500 pl-6">{errors.confirmed}</p>}
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Your account information will be encrypted and securely stored. You will receive loan repayments to this
          account.
        </AlertDescription>
      </Alert>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Confirm & Accept"
          )}
        </Button>
      </div>
    </form>
  )
}
