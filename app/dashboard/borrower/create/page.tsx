"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { createLoan, parseDbError } from "@/lib/api"
import { WizardProgress } from "@/components/wizard-progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Info, Loader2 } from "lucide-react"
import type { LoanType, CreateLoanRequest } from "@/lib/types"

interface FormData {
  // Step 1: Basic Info
  loanName: string
  loanType: LoanType
  principalAmount: string
  interestRate: string
  termMonths: string

  // Step 2: Business Details
  businessEntityName: string
  businessEntityType: string
  businessTaxId: string
  businessAddress: string

  // Step 3: Additional Details
  purpose: string
  collateralDescription: string
  originationDate: string
  maturityDate: string
}

interface FormErrors {
  [key: string]: string
}

export default function CreateLoanPage() {
  const router = useRouter()
  const { user, activeRole } = useUser()
  const { toast } = useToast()

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string>("")

  const [formData, setFormData] = useState<FormData>({
    loanName: "",
    loanType: "personal",
    principalAmount: "",
    interestRate: "",
    termMonths: "",
    businessEntityName: "",
    businessEntityType: "",
    businessTaxId: "",
    businessAddress: "",
    purpose: "",
    collateralDescription: "",
    originationDate: new Date().toISOString().split("T")[0],
    maturityDate: "",
  })

  const [errors, setErrors] = useState<FormErrors>({})

  // Determine total steps based on loan type
  const totalSteps = formData.loanType === "business" ? 3 : 2
  const isPersonalLoan = formData.loanType === "personal"

  // Update form field
  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  // Validate Step 1
  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.loanName.trim()) {
      newErrors.loanName = "Loan name is required"
    } else if (formData.loanName.length > 200) {
      newErrors.loanName = "Loan name must be 200 characters or less"
    }

    const principal = Number.parseFloat(formData.principalAmount)
    if (!formData.principalAmount || isNaN(principal)) {
      newErrors.principalAmount = "Principal amount is required"
    } else if (principal <= 0 || principal > 100000000) {
      newErrors.principalAmount = "Amount must be between $0.01 and $100,000,000"
    }

    const rate = Number.parseFloat(formData.interestRate)
    if (!formData.interestRate || isNaN(rate)) {
      newErrors.interestRate = "Interest rate is required"
    } else if (rate < 0 || rate > 100) {
      newErrors.interestRate = "Interest rate must be between 0% and 100%"
    }

    const term = Number.parseInt(formData.termMonths)
    if (!formData.termMonths || isNaN(term)) {
      newErrors.termMonths = "Term is required"
    } else if (term <= 0) {
      newErrors.termMonths = "Term must be at least 1 month"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Validate Step 2 (Business Details)
  const validateStep2 = (): boolean => {
    if (formData.loanType === "personal") return true

    const newErrors: FormErrors = {}

    if (!formData.businessEntityName.trim()) {
      newErrors.businessEntityName = "Business entity name is required for business loans"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Validate Step 3 (Additional Details)
  const validateStep3 = (): boolean => {
    const newErrors: FormErrors = {}

    // Validate dates if both are provided
    if (formData.originationDate && formData.maturityDate) {
      const origDate = new Date(formData.originationDate)
      const matDate = new Date(formData.maturityDate)

      if (matDate <= origDate) {
        newErrors.maturityDate = "Maturity date must be after origination date"
      }
    }

    // Check if origination date is in the future
    if (formData.originationDate) {
      const origDate = new Date(formData.originationDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (origDate > today) {
        newErrors.originationDate = "Origination date cannot be in the future"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle Next button
  const handleNext = () => {
    let isValid = false

    if (currentStep === 1) {
      isValid = validateStep1()
    } else if (currentStep === 2 && !isPersonalLoan) {
      isValid = validateStep2()
    }

    if (isValid) {
      // Skip step 2 for personal loans
      if (currentStep === 1 && isPersonalLoan) {
        setCurrentStep(2) // This is actually step 3 for personal loans
      } else {
        setCurrentStep(currentStep + 1)
      }
    }
  }

  // Handle Back button
  const handleBack = () => {
    // Skip step 2 for personal loans when going back
    if (currentStep === 2 && isPersonalLoan) {
      setCurrentStep(1)
    } else {
      setCurrentStep(currentStep - 1)
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateStep3()) return

    if (!user?.id || !user?.email) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a loan",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    setApiError("")

    try {
      // Prepare request body
      const requestBody: CreateLoanRequest = {
        loan_name: formData.loanName.trim(),
        borrower_id: user.id,
        loan_type: formData.loanType,
        principal_amount: Number.parseFloat(formData.principalAmount),
        interest_rate: Number.parseFloat(formData.interestRate) / 100, // Convert percentage to decimal
        term_months: Number.parseInt(formData.termMonths),
        status: "draft",
      }

      // Add optional fields
      if (formData.purpose.trim()) {
        requestBody.purpose = formData.purpose.trim()
      }
      if (formData.collateralDescription.trim()) {
        requestBody.collateral_description = formData.collateralDescription.trim()
      }
      if (formData.originationDate) {
        requestBody.origination_date = formData.originationDate
      }
      if (formData.maturityDate) {
        requestBody.maturity_date = formData.maturityDate
      }

      // Add business fields if business loan
      if (formData.loanType === "business") {
        requestBody.business_entity_name = formData.businessEntityName.trim()
        if (formData.businessEntityType) {
          requestBody.business_entity_type = formData.businessEntityType
        }
        if (formData.businessTaxId.trim()) {
          requestBody.business_tax_id = formData.businessTaxId.trim()
        }
        if (formData.businessAddress.trim()) {
          requestBody.business_address = formData.businessAddress.trim()
        }
      }

      // Make API call
      const response = await createLoan(requestBody, user.email, activeRole)

      if (response.error || !response.data) {
        throw new Error(response.error || "Failed to create loan")
      }

      // Success!
      toast({
        title: "Loan created successfully!",
        description: `"${response.data.loan_name}" has been created as a draft.`,
      })

      // Navigate to loan detail page or borrower dashboard
      router.push(`/dashboard/borrower`)
    } catch (error: any) {
      console.error("[v0] Create loan error:", error)

      // Try to parse as database error
      let errorMessage = "Failed to create loan. Please try again."
      try {
        const dbError = JSON.parse(error.message)
        errorMessage = parseDbError(dbError)
      } catch {
        errorMessage = error.message || errorMessage
      }

      setApiError(errorMessage)
      toast({
        title: "Error creating loan",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    const hasData = Object.values(formData).some((value) => value !== "" && value !== "personal")

    if (hasData) {
      const confirmed = window.confirm("Are you sure? Unsaved changes will be lost.")
      if (!confirmed) return
    }

    router.push("/dashboard/borrower")
  }

  // Prepare steps for progress indicator
  const steps = isPersonalLoan
    ? [
        {
          number: 1,
          label: "Basic Info",
          isCompleted: currentStep > 1,
          isActive: currentStep === 1,
          isClickable: true,
        },
        {
          number: 2,
          label: "Additional Info",
          isCompleted: false,
          isActive: currentStep === 2,
          isClickable: currentStep > 1,
        },
      ]
    : [
        {
          number: 1,
          label: "Basic Info",
          isCompleted: currentStep > 1,
          isActive: currentStep === 1,
          isClickable: true,
        },
        {
          number: 2,
          label: "Business Details",
          isCompleted: currentStep > 2,
          isActive: currentStep === 2,
          isClickable: currentStep > 1,
        },
        {
          number: 3,
          label: "Additional Info",
          isCompleted: false,
          isActive: currentStep === 3,
          isClickable: currentStep > 2,
        },
      ]

  const handleStepClick = (stepNumber: number) => {
    if (stepNumber < currentStep) {
      setCurrentStep(stepNumber)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Loan</h1>
          <p className="text-gray-600">Fill out the information below to create a new loan request</p>
        </div>

        <WizardProgress steps={steps} onStepClick={handleStepClick} />

        {apiError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <Card>
          {/* STEP 1: Basic Loan Information */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle>Basic Loan Information</CardTitle>
                <CardDescription>Enter the core details of your loan request</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Loan Name */}
                <div className="space-y-2">
                  <Label htmlFor="loanName">
                    Loan Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="loanName"
                    placeholder="e.g., Business Expansion 2024"
                    value={formData.loanName}
                    onChange={(e) => updateField("loanName", e.target.value)}
                    maxLength={200}
                    aria-invalid={!!errors.loanName}
                    aria-describedby={errors.loanName ? "loanName-error" : "loanName-help"}
                    autoFocus
                  />
                  {errors.loanName && (
                    <p id="loanName-error" className="text-sm text-destructive" role="alert">
                      {errors.loanName}
                    </p>
                  )}
                  <p id="loanName-help" className="text-sm text-muted-foreground">
                    Choose a unique name to identify this loan
                  </p>
                </div>

                {/* Loan Type */}
                <div className="space-y-2">
                  <Label>
                    Loan Type <span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup
                    value={formData.loanType}
                    onValueChange={(value) => updateField("loanType", value as LoanType)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="personal" id="personal" />
                      <Label htmlFor="personal" className="font-normal cursor-pointer">
                        Personal Loan
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="business" id="business" />
                      <Label htmlFor="business" className="font-normal cursor-pointer">
                        Business Loan
                      </Label>
                      <Info
                        className="w-4 h-4 text-muted-foreground"
                        title="Business loans require additional entity information in the next step"
                      />
                    </div>
                  </RadioGroup>
                </div>

                {/* Principal Amount */}
                <div className="space-y-2">
                  <Label htmlFor="principalAmount">
                    Principal Amount <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="principalAmount"
                      type="number"
                      placeholder="50,000.00"
                      value={formData.principalAmount}
                      onChange={(e) => updateField("principalAmount", e.target.value)}
                      className="pl-7"
                      step="0.01"
                      min="0.01"
                      max="100000000"
                      aria-invalid={!!errors.principalAmount}
                      aria-describedby={errors.principalAmount ? "principalAmount-error" : undefined}
                    />
                  </div>
                  {errors.principalAmount && (
                    <p id="principalAmount-error" className="text-sm text-destructive" role="alert">
                      {errors.principalAmount}
                    </p>
                  )}
                </div>

                {/* Interest Rate */}
                <div className="space-y-2">
                  <Label htmlFor="interestRate">
                    Annual Interest Rate (%) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="interestRate"
                      type="number"
                      placeholder="7.5"
                      value={formData.interestRate}
                      onChange={(e) => updateField("interestRate", e.target.value)}
                      className="pr-7"
                      step="0.01"
                      min="0"
                      max="100"
                      aria-invalid={!!errors.interestRate}
                      aria-describedby={errors.interestRate ? "interestRate-error" : "interestRate-help"}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                  {errors.interestRate && (
                    <p id="interestRate-error" className="text-sm text-destructive" role="alert">
                      {errors.interestRate}
                    </p>
                  )}
                  <p id="interestRate-help" className="text-sm text-muted-foreground">
                    Enter as percentage (e.g., 8.5 for 8.5% annual rate)
                  </p>
                </div>

                {/* Loan Term */}
                <div className="space-y-2">
                  <Label htmlFor="termMonths">
                    Term (months) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="termMonths"
                    type="number"
                    placeholder="36"
                    value={formData.termMonths}
                    onChange={(e) => updateField("termMonths", e.target.value)}
                    min="1"
                    step="1"
                    aria-invalid={!!errors.termMonths}
                    aria-describedby={errors.termMonths ? "termMonths-error" : undefined}
                  />
                  {errors.termMonths && (
                    <p id="termMonths-error" className="text-sm text-destructive" role="alert">
                      {errors.termMonths}
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleNext}>Next</Button>
              </CardFooter>
            </>
          )}

          {/* STEP 2: Business Details (only for business loans) */}
          {currentStep === 2 && !isPersonalLoan && (
            <>
              <CardHeader>
                <CardTitle>Business Details</CardTitle>
                <CardDescription>Provide information about your business entity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Business Entity Name */}
                <div className="space-y-2">
                  <Label htmlFor="businessEntityName">
                    Business Entity Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="businessEntityName"
                    placeholder="TechStartup LLC"
                    value={formData.businessEntityName}
                    onChange={(e) => updateField("businessEntityName", e.target.value)}
                    aria-invalid={!!errors.businessEntityName}
                    aria-describedby={
                      errors.businessEntityName ? "businessEntityName-error" : "businessEntityName-help"
                    }
                    autoFocus
                  />
                  {errors.businessEntityName && (
                    <p id="businessEntityName-error" className="text-sm text-destructive" role="alert">
                      {errors.businessEntityName}
                    </p>
                  )}
                  <p id="businessEntityName-help" className="text-sm text-muted-foreground">
                    Legal name of the business entity
                  </p>
                </div>

                {/* Business Entity Type */}
                <div className="space-y-2">
                  <Label htmlFor="businessEntityType">Business Entity Type</Label>
                  <Select
                    value={formData.businessEntityType}
                    onValueChange={(value) => updateField("businessEntityType", value)}
                  >
                    <SelectTrigger id="businessEntityType">
                      <SelectValue placeholder="Select entity type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LLC">LLC</SelectItem>
                      <SelectItem value="Corporation">Corporation</SelectItem>
                      <SelectItem value="Partnership">Partnership</SelectItem>
                      <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Business Tax ID */}
                <div className="space-y-2">
                  <Label htmlFor="businessTaxId">Business Tax ID</Label>
                  <Input
                    id="businessTaxId"
                    placeholder="12-3456789"
                    value={formData.businessTaxId}
                    onChange={(e) => updateField("businessTaxId", e.target.value)}
                    aria-describedby="businessTaxId-help"
                  />
                  <p id="businessTaxId-help" className="text-sm text-muted-foreground">
                    Format: XX-XXXXXXX or XXX-XX-XXXX
                  </p>
                </div>

                {/* Business Address */}
                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Textarea
                    id="businessAddress"
                    placeholder="123 Main Street, City, State ZIP"
                    value={formData.businessAddress}
                    onChange={(e) => updateField("businessAddress", e.target.value)}
                    rows={3}
                    maxLength={500}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button onClick={handleNext}>Next</Button>
              </CardFooter>
            </>
          )}

          {/* STEP 3: Additional Details (or Step 2 for personal loans) */}
          {((currentStep === 3 && !isPersonalLoan) || (currentStep === 2 && isPersonalLoan)) && (
            <>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
                <CardDescription>Optional information to provide more context (all fields optional)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Purpose */}
                <div className="space-y-2">
                  <Label htmlFor="purpose">Loan Purpose</Label>
                  <Textarea
                    id="purpose"
                    placeholder="Describe how you'll use the loan funds..."
                    value={formData.purpose}
                    onChange={(e) => updateField("purpose", e.target.value)}
                    rows={4}
                    maxLength={500}
                    aria-describedby="purpose-count"
                  />
                  <p id="purpose-count" className="text-sm text-muted-foreground text-right">
                    {formData.purpose.length} / 500
                  </p>
                </div>

                {/* Collateral Description */}
                <div className="space-y-2">
                  <Label htmlFor="collateralDescription">Collateral Description</Label>
                  <Textarea
                    id="collateralDescription"
                    placeholder="Describe any collateral securing this loan..."
                    value={formData.collateralDescription}
                    onChange={(e) => updateField("collateralDescription", e.target.value)}
                    rows={3}
                    maxLength={500}
                    aria-describedby="collateral-count"
                  />
                  <p id="collateral-count" className="text-sm text-muted-foreground text-right">
                    {formData.collateralDescription.length} / 500
                  </p>
                </div>

                {/* Origination Date */}
                <div className="space-y-2">
                  <Label htmlFor="originationDate">Loan Start Date</Label>
                  <Input
                    id="originationDate"
                    type="date"
                    value={formData.originationDate}
                    onChange={(e) => updateField("originationDate", e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    aria-invalid={!!errors.originationDate}
                    aria-describedby={errors.originationDate ? "originationDate-error" : undefined}
                  />
                  {errors.originationDate && (
                    <p id="originationDate-error" className="text-sm text-destructive" role="alert">
                      {errors.originationDate}
                    </p>
                  )}
                </div>

                {/* Maturity Date */}
                <div className="space-y-2">
                  <Label htmlFor="maturityDate">Loan End Date</Label>
                  <Input
                    id="maturityDate"
                    type="date"
                    value={formData.maturityDate}
                    onChange={(e) => updateField("maturityDate", e.target.value)}
                    aria-invalid={!!errors.maturityDate}
                    aria-describedby={errors.maturityDate ? "maturityDate-error" : undefined}
                  />
                  {errors.maturityDate && (
                    <p id="maturityDate-error" className="text-sm text-destructive" role="alert">
                      {errors.maturityDate}
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} size="lg">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Loan"
                  )}
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
