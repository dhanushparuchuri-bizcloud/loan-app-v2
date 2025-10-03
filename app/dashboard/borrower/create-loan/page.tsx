"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAuth } from "@/lib/auth-context"
import { apiClient } from "@/lib/api-client"
import { ArrowLeft, ArrowRight, Check, X, Plus } from "lucide-react"

interface EntityDetails {
  entity_name: string
  entity_type: string
  entity_tax_id: string
  borrower_relationship: string
}

interface LoanDetails {
  amount: number
  interestRate: number
  maturityTerms: {
    start_date: string
    payment_frequency: string
    term_length: number
  }
  purpose: string
  description: string
  entityDetails: EntityDetails
}

interface SelectedLender {
  id: string
  name: string
  email: string
  amount: number
}

export default function CreateLoanPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [loanDetails, setLoanDetails] = useState<LoanDetails>({
    amount: 0,
    interestRate: 5,
    maturityTerms: {
      start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      payment_frequency: "Monthly",
      term_length: 12
    },
    purpose: "",
    description: "",
    entityDetails: {
      entity_name: "",
      entity_type: "",
      entity_tax_id: "",
      borrower_relationship: ""
    }
  })
  const [selectedLenders, setSelectedLenders] = useState<SelectedLender[]>([])
  const [newLenderName, setNewLenderName] = useState("")
  const [newLenderEmail, setNewLenderEmail] = useState("")
  const [showNewLenderForm, setShowNewLenderForm] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  const handleRoleSwitch = () => {
    router.push("/dashboard/lender")
  }

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleAddLender = () => {
    if (newLenderName && newLenderEmail) {
      const newLender: SelectedLender = {
        id: Date.now().toString(),
        name: newLenderName,
        email: newLenderEmail,
        amount: 0,
      }
      setSelectedLenders([...selectedLenders, newLender])
      setNewLenderName("")
      setNewLenderEmail("")
      setShowNewLenderForm(false)
    }
  }

  const handleRemoveLender = (id: string) => {
    setSelectedLenders(selectedLenders.filter((lender) => lender.id !== id))
  }

  const handleLenderAmountChange = (id: string, amount: number) => {
    setSelectedLenders(selectedLenders.map((lender) => (lender.id === id ? { ...lender, amount } : lender)))
  }

  const totalAssigned = selectedLenders.reduce((sum, lender) => sum + lender.amount, 0)
  const isAmountValid = totalAssigned === loanDetails.amount && loanDetails.amount > 0

  const handleSubmit = async () => {
    console.log('[CreateLoan] Starting loan creation...', {
      amount: loanDetails.amount,
      lendersCount: selectedLenders.length,
      totalAssigned: totalAssigned
    })

    // Validate description length
    if (!loanDetails.description || loanDetails.description.trim().length < 10) {
      alert('Description must be at least 10 characters long')
      return
    }

    // Validate business entity details if needed
    if (loanDetails.purpose === "Business" && (!loanDetails.entityDetails.entity_name || !loanDetails.entityDetails.entity_type || !loanDetails.entityDetails.borrower_relationship)) {
      alert('Please fill in all required business entity information')
      return
    }

    try {
      const loanData = {
        amount: loanDetails.amount,
        purpose: loanDetails.purpose,
        description: loanDetails.description,
        interest_rate: loanDetails.interestRate,
        maturity_terms: loanDetails.maturityTerms,
        lenders: selectedLenders.map(lender => ({
          email: lender.email,
          contribution_amount: lender.amount
        })),
        ...(loanDetails.purpose === "Business" && loanDetails.entityDetails.entity_name && {
          entity_details: {
            entity_name: loanDetails.entityDetails.entity_name,
            entity_type: loanDetails.entityDetails.entity_type,
            entity_tax_id: loanDetails.entityDetails.entity_tax_id || null,
            borrower_relationship: loanDetails.entityDetails.borrower_relationship
          }
        })
      }

      console.log('[CreateLoan] Sending loan data:', loanData)
      const response = await apiClient.createLoan(loanData)
      console.log('[CreateLoan] Response received:', response)
      
      if (response.success && response.loan) {
        console.log('[CreateLoan] Loan created successfully:', response.loan.loan_id)
        router.push("/dashboard/borrower")
      } else {
        console.error('[CreateLoan] Loan creation failed:', response.message)
        alert(`Loan creation failed: ${response.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[CreateLoan] Error creating loan:', error)
      alert(`Error creating loan: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (!user) return null

  const progressPercentage = (currentStep / 3) * 100

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader currentRole="borrower" onRoleSwitch={user.is_lender ? handleRoleSwitch : undefined} />

      <main className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/dashboard/borrower")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-balance">Create New Note</h1>
          <p className="text-muted-foreground">Follow the steps to create your promissory note</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of 3</span>
            <span className="text-sm text-muted-foreground">{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="mb-4" />
          <div className="flex justify-between text-sm">
            <span className={currentStep >= 1 ? "text-primary font-medium" : "text-muted-foreground"}>
              Note Terms
            </span>
            <span className={currentStep >= 2 ? "text-primary font-medium" : "text-muted-foreground"}>
              Select Note Holders
            </span>
            <span className={currentStep >= 3 ? "text-primary font-medium" : "text-muted-foreground"}>
              Review & Submit
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && "Note Terms"}
              {currentStep === 2 && "Select Note Holders"}
              {currentStep === 3 && "Review & Submit"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Step 1: Loan Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Principal Amount ($)</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="1"
                      max="1000000"
                      value={loanDetails.amount || ""}
                      onChange={(e) =>
                        setLoanDetails({
                          ...loanDetails,
                          amount: Number(e.target.value),
                        })
                      }
                      placeholder="50000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Payment Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={loanDetails.maturityTerms.start_date}
                      onChange={(e) =>
                        setLoanDetails({
                          ...loanDetails,
                          maturityTerms: { ...loanDetails.maturityTerms, start_date: e.target.value }
                        })
                      }
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="payment-frequency">Payment Frequency</Label>
                    <Select
                      value={loanDetails.maturityTerms.payment_frequency}
                      onValueChange={(value) => 
                        setLoanDetails({
                          ...loanDetails,
                          maturityTerms: { ...loanDetails.maturityTerms, payment_frequency: value }
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                        <SelectItem value="Annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="term-length">Term Length (months)</Label>
                    <Input
                      id="term-length"
                      type="number"
                      min="1"
                      max="60"
                      value={loanDetails.maturityTerms.term_length || ""}
                      onChange={(e) =>
                        setLoanDetails({
                          ...loanDetails,
                          maturityTerms: { ...loanDetails.maturityTerms, term_length: Number(e.target.value) }
                        })
                      }
                      placeholder="12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Interest Rate: {loanDetails.interestRate}%</Label>
                  <Slider
                    value={[loanDetails.interestRate]}
                    onValueChange={(value) =>
                      setLoanDetails({
                        ...loanDetails,
                        interestRate: value[0],
                      })
                    }
                    max={50}
                    min={0.1}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>0.1%</span>
                    <span>50%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose</Label>
                  <Select
                    value={loanDetails.purpose}
                    onValueChange={(value) => setLoanDetails({ ...loanDetails, purpose: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Personal">Personal</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={loanDetails.description}
                    onChange={(e) =>
                      setLoanDetails({
                        ...loanDetails,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe how you plan to use these funds (minimum 10 characters)..."
                    maxLength={1000}
                    rows={4}
                    className={loanDetails.description.length > 0 && loanDetails.description.length < 10 ? "border-red-500" : ""}
                  />
                  <div className="flex justify-between items-center">
                    <div className="text-sm">
                      {loanDetails.description.length < 10 && loanDetails.description.length > 0 ? (
                        <span className="text-red-500">
                          Need {10 - loanDetails.description.length} more characters (minimum 10)
                        </span>
                      ) : loanDetails.description.length >= 10 ? (
                        <span className="text-green-600">✓ Valid description</span>
                      ) : (
                        <span className="text-muted-foreground">Minimum 10 characters required</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">{loanDetails.description.length}/1000 characters</span>
                  </div>
                </div>

                {/* Business Entity Details */}
                {loanDetails.purpose === "Business" && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                    <h4 className="font-semibold text-lg">🏢 Business Entity Information</h4>
                    <p className="text-sm text-muted-foreground">
                      Required for business loans. You remain personally liable for repayment.
                    </p>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="entity-name">Entity Name *</Label>
                        <Input
                          id="entity-name"
                          value={loanDetails.entityDetails.entity_name}
                          onChange={(e) =>
                            setLoanDetails({
                              ...loanDetails,
                              entityDetails: {
                                ...loanDetails.entityDetails,
                                entity_name: e.target.value,
                              }
                            })
                          }
                          placeholder="ABC Manufacturing LLC"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="entity-type">Entity Type *</Label>
                        <Select
                          value={loanDetails.entityDetails.entity_type}
                          onValueChange={(value) => 
                            setLoanDetails({
                              ...loanDetails,
                              entityDetails: {
                                ...loanDetails.entityDetails,
                                entity_type: value,
                              }
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select entity type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LLC">LLC</SelectItem>
                            <SelectItem value="Corporation">Corporation</SelectItem>
                            <SelectItem value="Partnership">Partnership</SelectItem>
                            <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="entity-tax-id">Entity Tax ID / EIN</Label>
                        <Input
                          id="entity-tax-id"
                          value={loanDetails.entityDetails.entity_tax_id}
                          onChange={(e) =>
                            setLoanDetails({
                              ...loanDetails,
                              entityDetails: {
                                ...loanDetails.entityDetails,
                                entity_tax_id: e.target.value,
                              }
                            })
                          }
                          placeholder="12-3456789 (optional)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="borrower-relationship">Your Role in Entity *</Label>
                        <Select
                          value={loanDetails.entityDetails.borrower_relationship}
                          onValueChange={(value) => 
                            setLoanDetails({
                              ...loanDetails,
                              entityDetails: {
                                ...loanDetails.entityDetails,
                                borrower_relationship: value,
                              }
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Owner">Owner</SelectItem>
                            <SelectItem value="Officer">Officer</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Partner">Partner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Select Lenders */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Add Note Holders</h3>
                  <Button variant="outline" onClick={() => setShowNewLenderForm(!showNewLenderForm)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Invite New Note Holder
                  </Button>
                </div>

                {showNewLenderForm && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="lender-name">Name</Label>
                          <Input
                            id="lender-name"
                            value={newLenderName}
                            onChange={(e) => setNewLenderName(e.target.value)}
                            placeholder="Note holder's name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lender-email">Email</Label>
                          <Input
                            id="lender-email"
                            type="email"
                            value={newLenderEmail}
                            onChange={(e) => setNewLenderEmail(e.target.value)}
                            placeholder="noteholder@example.com"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleAddLender}>Add Note Holder</Button>
                        <Button variant="outline" onClick={() => setShowNewLenderForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Selected Lenders */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Selected Note Holders</h3>
                  {selectedLenders.length === 0 ? (
                    <p className="text-muted-foreground">No note holders selected yet. Add note holders above.</p>
                  ) : (
                    selectedLenders.map((lender) => (
                      <Card key={lender.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{lender.name}</h4>
                              <p className="text-sm text-muted-foreground">{lender.email}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="space-y-2">
                                <Label htmlFor={`amount-${lender.id}`}>Amount ($)</Label>
                                <Input
                                  id={`amount-${lender.id}`}
                                  type="number"
                                  value={lender.amount || ""}
                                  onChange={(e) => handleLenderAmountChange(lender.id, Number(e.target.value))}
                                  className="w-32"
                                />
                              </div>
                              <Button variant="outline" size="sm" onClick={() => handleRemoveLender(lender.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Amount Summary */}
                {selectedLenders.length > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Principal Amount:</span>
                          <span className="font-medium">${loanDetails.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Assigned:</span>
                          <span
                            className={
                              totalAssigned === loanDetails.amount
                                ? "text-green-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            ${totalAssigned.toLocaleString()}
                          </span>
                        </div>
                        {!isAmountValid && (
                          <p className="text-sm text-red-600">Total assigned amount must equal the principal amount</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Note Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Principal Amount</Label>
                        <p className="text-2xl font-bold">${loanDetails.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label>Interest Rate</Label>
                        <p className="text-2xl font-bold">{loanDetails.interestRate}%</p>
                      </div>
                      <div>
                        <Label>Payment Terms</Label>
                        <p className="text-lg">{loanDetails.maturityTerms.payment_frequency} for {loanDetails.maturityTerms.term_length} months</p>
                      </div>
                      <div>
                        <Label>Purpose</Label>
                        <p className="text-lg">{loanDetails.purpose}</p>
                      </div>
                    </div>
                    <div>
                      <Label>Payment Start Date</Label>
                      <p className="text-lg">{new Date(loanDetails.maturityTerms.start_date).toLocaleDateString()}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Description</Label>
                      <p className="text-muted-foreground">{loanDetails.description}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Entity Details Review */}
                {loanDetails.purpose === "Business" && loanDetails.entityDetails.entity_name && (
                  <Card>
                    <CardHeader>
                      <CardTitle>🏢 Business Entity Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>Entity Name</Label>
                          <p className="font-medium">{loanDetails.entityDetails.entity_name}</p>
                        </div>
                        <div>
                          <Label>Entity Type</Label>
                          <p>{loanDetails.entityDetails.entity_type}</p>
                        </div>
                        <div>
                          <Label>Tax ID / EIN</Label>
                          <p>{loanDetails.entityDetails.entity_tax_id || 'Not provided'}</p>
                        </div>
                        <div>
                          <Label>Your Role</Label>
                          <p>{loanDetails.entityDetails.borrower_relationship}</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 rounded">
                        <p className="text-sm text-blue-700">
                          ℹ️ This loan is for business purposes. You remain personally liable for repayment.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Note Holders ({selectedLenders.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedLenders.map((lender) => (
                        <div key={lender.id} className="flex justify-between items-center p-3 border rounded">
                          <div>
                            <p className="font-medium">{lender.name}</p>
                            <p className="text-sm text-muted-foreground">{lender.email}</p>
                          </div>
                          <p className="font-bold">${lender.amount.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {currentStep < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={
                    (currentStep === 1 && (
                      !loanDetails.amount || 
                      !loanDetails.maturityTerms.payment_frequency || 
                      !loanDetails.maturityTerms.term_length || 
                      !loanDetails.purpose ||
                      !loanDetails.description ||
                      loanDetails.description.length < 10 ||
                      (loanDetails.purpose === "Business" && (
                        !loanDetails.entityDetails.entity_name ||
                        !loanDetails.entityDetails.entity_type ||
                        !loanDetails.entityDetails.borrower_relationship
                      ))
                    )) ||
                    (currentStep === 2 && !isAmountValid)
                  }
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit}>
                  <Check className="mr-2 h-4 w-4" />
                  Create Note
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
