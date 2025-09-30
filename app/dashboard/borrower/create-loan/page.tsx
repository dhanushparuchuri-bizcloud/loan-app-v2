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

interface LoanDetails {
  amount: number
  interestRate: number
  term: string
  purpose: string
  description: string
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
    term: "",
    purpose: "",
    description: "",
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

    try {
      const loanData = {
        amount: loanDetails.amount,
        purpose: loanDetails.purpose,
        description: loanDetails.description,
        interest_rate: loanDetails.interestRate,
        term: loanDetails.term,
        lenders: selectedLenders.map(lender => ({
          email: lender.email,
          contribution_amount: lender.amount
        }))
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
          <h1 className="text-3xl font-bold text-balance">Create New Loan</h1>
          <p className="text-muted-foreground">Follow the steps to create your loan request</p>
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
              Loan Details
            </span>
            <span className={currentStep >= 2 ? "text-primary font-medium" : "text-muted-foreground"}>
              Select Lenders
            </span>
            <span className={currentStep >= 3 ? "text-primary font-medium" : "text-muted-foreground"}>
              Review & Submit
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && "Loan Details"}
              {currentStep === 2 && "Select Lenders"}
              {currentStep === 3 && "Review & Submit"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Step 1: Loan Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Loan Amount ($)</Label>
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
                    <Label htmlFor="term">Repayment Term</Label>
                    <Select
                      value={loanDetails.term}
                      onValueChange={(value) => setLoanDetails({ ...loanDetails, term: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                        <SelectItem value="Annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={loanDetails.description}
                    onChange={(e) =>
                      setLoanDetails({
                        ...loanDetails,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe how you plan to use this loan..."
                    maxLength={500}
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">{loanDetails.description.length}/500 characters</p>
                </div>
              </div>
            )}

            {/* Step 2: Select Lenders */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Add Lenders</h3>
                  <Button variant="outline" onClick={() => setShowNewLenderForm(!showNewLenderForm)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Invite New Lender
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
                            placeholder="Lender's name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lender-email">Email</Label>
                          <Input
                            id="lender-email"
                            type="email"
                            value={newLenderEmail}
                            onChange={(e) => setNewLenderEmail(e.target.value)}
                            placeholder="lender@example.com"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleAddLender}>Add Lender</Button>
                        <Button variant="outline" onClick={() => setShowNewLenderForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Selected Lenders */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Selected Lenders</h3>
                  {selectedLenders.length === 0 ? (
                    <p className="text-muted-foreground">No lenders selected yet. Add lenders above.</p>
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
                          <span>Total Loan Amount:</span>
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
                          <p className="text-sm text-red-600">Total assigned amount must equal the loan amount</p>
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
                    <CardTitle>Loan Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Loan Amount</Label>
                        <p className="text-2xl font-bold">${loanDetails.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label>Interest Rate</Label>
                        <p className="text-2xl font-bold">{loanDetails.interestRate}%</p>
                      </div>
                      <div>
                        <Label>Repayment Term</Label>
                        <p className="text-lg">{loanDetails.term}</p>
                      </div>
                      <div>
                        <Label>Purpose</Label>
                        <p className="text-lg">{loanDetails.purpose}</p>
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <p className="text-muted-foreground">{loanDetails.description}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Lenders ({selectedLenders.length})</CardTitle>
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
                    (currentStep === 1 && (!loanDetails.amount || !loanDetails.term || !loanDetails.purpose)) ||
                    (currentStep === 2 && !isAmountValid)
                  }
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit}>
                  <Check className="mr-2 h-4 w-4" />
                  Submit Loan Request
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
