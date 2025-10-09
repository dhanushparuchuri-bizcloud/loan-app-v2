"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search, X, AlertCircle } from "lucide-react"
import { apiClient, Lender } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface Loan {
  loan_id: string
  loan_name: string
  amount: number
  total_funded: number
  interest_rate: number
  funding_progress?: {
    total_invited?: number
  }
}

interface AddHoldersModalProps {
  loan: Loan
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface NewLender {
  email: string
  amount: number
}

export function AddHoldersModal({ loan, isOpen, onClose, onSuccess }: AddHoldersModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [lenders, setLenders] = useState<Lender[]>([])
  const [selectedLenders, setSelectedLenders] = useState<Map<string, number>>(new Map())
  const [newLenders, setNewLenders] = useState<NewLender[]>([{ email: "", amount: 0 }])
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Use total_invited if available (includes pending), otherwise fall back to total_funded
  const totalInvited = loan.funding_progress?.total_invited ?? loan.total_funded
  const remaining = loan.amount - totalInvited
  const totalSelected = Array.from(selectedLenders.values()).reduce((sum, amt) => sum + amt, 0)
  const totalNew = newLenders.reduce((sum, l) => sum + (l.amount || 0), 0)
  const totalAll = totalSelected + totalNew

  // Search previous lenders
  useEffect(() => {
    const searchLenders = async () => {
      setIsSearching(true)
      try {
        const response = await apiClient.searchLenders(searchQuery)
        if (response.success && response.data) {
          setLenders(response.data.lenders)
        }
      } catch (error) {
        console.error("Failed to search lenders:", error)
      } finally {
        setIsSearching(false)
      }
    }

    // Debounce search
    const timer = setTimeout(() => {
      searchLenders()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const toggleLender = (lenderId: string, defaultAmount: number) => {
    const newSelected = new Map(selectedLenders)
    if (newSelected.has(lenderId)) {
      newSelected.delete(lenderId)
    } else {
      newSelected.set(lenderId, defaultAmount)
    }
    setSelectedLenders(newSelected)
  }

  const updateLenderAmount = (lenderId: string, amount: number) => {
    const newSelected = new Map(selectedLenders)
    newSelected.set(lenderId, amount)
    setSelectedLenders(newSelected)
  }

  const addNewLenderRow = () => {
    setNewLenders([...newLenders, { email: "", amount: 0 }])
  }

  const removeNewLenderRow = (index: number) => {
    setNewLenders(newLenders.filter((_, i) => i !== index))
  }

  const updateNewLender = (index: number, field: keyof NewLender, value: string | number) => {
    const updated = [...newLenders]
    updated[index] = { ...updated[index], [field]: value }
    setNewLenders(updated)
  }

  const handleSubmit = async () => {
    // Combine selected previous lenders + new lenders
    const allLenders = [
      ...Array.from(selectedLenders.entries()).map(([id, amount]) => {
        const lender = lenders.find((l) => l.lender_id === id)
        return { email: lender!.email, contribution_amount: amount }
      }),
      ...newLenders
        .filter((l) => l.email && l.amount > 0)
        .map((l) => ({ email: l.email, contribution_amount: l.amount })),
    ]

    if (allLenders.length === 0) {
      return
    }

    setIsSubmitting(true)
    try {
      await apiClient.addLendersToLoan(loan.loan_id, { lenders: allLenders })
      onSuccess()
      onClose()
      // Reset state
      setSelectedLenders(new Map())
      setNewLenders([{ email: "", amount: 0 }])
      setSearchQuery("")
    } catch (error) {
      alert(`Failed to add holders: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
      // Reset state
      setSelectedLenders(new Map())
      setNewLenders([{ email: "", amount: 0 }])
      setSearchQuery("")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Note Holders</DialogTitle>
          <DialogDescription>
            {loan.loan_name} • ${loan.amount.toLocaleString()} @ {loan.interest_rate}% APR
            <br />
            Remaining: ${remaining.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="previous" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="previous">Previous Holders ({lenders.length})</TabsTrigger>
            <TabsTrigger value="new">New Holders</TabsTrigger>
          </TabsList>

          {/* Previous Lenders Tab */}
          <TabsContent value="previous" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {isSearching ? (
              <div className="text-center py-8 text-muted-foreground">Searching...</div>
            ) : lenders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? "No holders found matching your search."
                  : 'No previous holders found. Use the "New Holders" tab to invite someone new.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lenders.map((lender) => {
                  const isSelected = selectedLenders.has(lender.lender_id)
                  const amount =
                    selectedLenders.get(lender.lender_id) ||
                    Math.min(
                      remaining / 2,
                      lender.stats.total_invested / lender.stats.investment_count
                    )

                  return (
                    <div
                      key={lender.lender_id}
                      className={cn(
                        "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      )}
                      onClick={() => toggleLender(lender.lender_id, amount)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={isSelected} />
                        <div>
                          <div className="font-medium">{lender.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {lender.email} • Invested {lender.stats.investment_count} time
                            {lender.stats.investment_count !== 1 ? "s" : ""} • Avg: $
                            {lender.stats.average_investment.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => {
                            e.stopPropagation()
                            updateLenderAmount(lender.lender_id, Number(e.target.value))
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-32"
                          placeholder="Amount"
                          min="0"
                          max={remaining}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* New Lenders Tab */}
          <TabsContent value="new" className="space-y-4">
            <div className="space-y-2">
              {newLenders.map((lender, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="noteholder@example.com"
                    value={lender.email}
                    onChange={(e) => updateNewLender(index, "email", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={lender.amount || ""}
                    onChange={(e) => updateNewLender(index, "amount", Number(e.target.value))}
                    className="w-32"
                    min="0"
                    max={remaining}
                  />
                  {newLenders.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeNewLenderRow(index)}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addNewLenderRow} type="button">
              + Add Another
            </Button>
          </TabsContent>
        </Tabs>

        {/* Summary */}
        <div className="space-y-2 p-3 bg-muted rounded-lg">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Loan Amount:</span>
            <span className="font-medium">${loan.amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Already Invited:</span>
            <span className="font-medium">${totalInvited.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Already Funded:</span>
            <span className="font-medium text-green-600">${loan.total_funded.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Available to Invite:</span>
            <span className="font-medium">${remaining.toLocaleString()}</span>
          </div>
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Adding Now:</span>
              <span className="font-medium">${totalAll.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-muted-foreground">Remaining After:</span>
              <span
                className={cn("font-medium", totalAll > remaining && "text-destructive")}
              >
                ${(remaining - totalAll).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {totalAll > remaining && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Total amount exceeds remaining balance</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={totalAll === 0 || totalAll > remaining || isSubmitting}
          >
            {isSubmitting
              ? "Adding..."
              : `Invite ${selectedLenders.size + newLenders.filter((l) => l.email && l.amount > 0).length} Holder(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
