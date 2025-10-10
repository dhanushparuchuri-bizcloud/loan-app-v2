"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardLoader } from "@/components/dashboard-loader"
import { DashboardHeader } from "@/components/dashboard-header"
import { StatsCard } from "@/components/stats-card"
import { AddHoldersModal } from "@/components/add-holders-modal"
import { useAuth } from "@/lib/auth-context"
import { useDashboard } from "@/hooks/use-dashboard"
import { DollarSign, TrendingUp, Clock, Plus, Eye, AlertCircle, Users, ChevronDown, ChevronUp, Receipt } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RecordPaymentModal } from "@/components/payments/record-payment-modal"
import { PaymentProgressBar } from "@/components/payments/payment-progress-bar"

export default function BorrowerDashboard() {
  const [isRoleSwitching, setIsRoleSwitching] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<any>(null)
  const [isAddHoldersModalOpen, setIsAddHoldersModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [expandedLoans, setExpandedLoans] = useState<Set<string>>(new Set())
  const { user } = useAuth()
  const { borrowerStats, loans, isLoading, error, refetch } = useDashboard()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }
  }, [user, router])

  const handleRoleSwitch = () => {
    setIsRoleSwitching(true)
    setTimeout(() => {
      router.push("/dashboard/lender")
    }, 1500)
  }

  const toggleLoanExpansion = (loanId: string) => {
    setExpandedLoans(prev => {
      const newSet = new Set(prev)
      if (newSet.has(loanId)) {
        newSet.delete(loanId)
      } else {
        newSet.add(loanId)
      }
      return newSet
    })
  }

  if (isLoading || isRoleSwitching) {
    return <DashboardLoader type="borrower" />
  }

  if (!user) return null

  // Calculate stats from API data
  const activeLoans = loans.filter((loan) => loan.status === "ACTIVE")
  const pendingLoans = loans.filter((loan) => loan.status === "PENDING")
  const totalBorrowed = borrowerStats?.total_borrowed || 0

  console.log('[BorrowerDashboard] Render data:', {
    borrowerStats,
    loansCount: loans.length,
    activeLoansCount: activeLoans.length,
    pendingLoansCount: pendingLoans.length
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge
            className="border"
            style={{
              backgroundColor: '#FFFBEB',
              color: '#B45309',
              borderColor: '#FDE68A',
              animation: 'smoothPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
          >
            ⏳ Pending
          </Badge>
        )
      case "ACTIVE":
        return (
          <Badge
            className="border"
            style={{
              backgroundColor: '#ECFDF5',
              color: '#047857',
              borderColor: '#A7F3D0'
            }}
          >
            ✓ Active
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader currentRole="borrower" onRoleSwitch={user.is_lender ? handleRoleSwitch : undefined} />

      <main className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-balance">Welcome back, {user.name}</h1>
          <p className="text-muted-foreground">Manage your notes and track your issuing activity</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button variant="outline" size="sm" onClick={refetch} className="ml-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <StatsCard
            title="Active Notes"
            value={borrowerStats?.active_loans || activeLoans.length}
            subtitle={`$${totalBorrowed.toLocaleString()} total issued`}
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          />
          <StatsCard
            title="Total Issued"
            value={`$${totalBorrowed.toLocaleString()}`}
            subtitle={`${loans.length} notes total`}
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          />
          <StatsCard
            title="Pending Requests"
            value={borrowerStats?.pending_requests || pendingLoans.length}
            subtitle="Awaiting note holder approval"
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* My Loans Table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>My Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {loans.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <DollarSign className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Create Your First Note</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                      Start raising capital by creating a promissory note and inviting holders to fund it
                    </p>
                    <Button size="lg" onClick={() => router.push("/dashboard/borrower/create-loan")}>
                      <Plus className="mr-2 h-5 w-5" />
                      Create New Note
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loans.map((loan) => {
                      const totalInvited = loan.funding_progress.total_invited || 0
                      const remaining = loan.amount - totalInvited
                      const fundingPercentage = loan.amount > 0 ? (totalInvited / loan.amount) * 100 : 0

                      const isExpanded = expandedLoans.has(loan.loan_id)
                      const participantCount = loan.participants?.length || 0
                      const acceptedCount = loan.accepted_participants || 0

                      return (
                        <Card key={loan.loan_id} className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/20">
                          <CardContent className="p-6">
                            <div className="space-y-4">
                              {/* Header Row */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold">{loan.loan_name}</h3>
                                    {getStatusBadge(loan.status)}
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      {loan.purpose === "Business" && "🏢"} {loan.purpose}
                                    </span>
                                    <span>•</span>
                                    <span>${loan.amount.toLocaleString()}</span>
                                    <span>•</span>
                                    <span>{loan.interest_rate}% APR</span>
                                  </div>
                                </div>
                              </div>

                              {/* Funding Progress Bar */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium">Invited Amount</span>
                                  <span className="text-muted-foreground">
                                    ${totalInvited.toLocaleString()} / ${loan.amount.toLocaleString()} ({fundingPercentage.toFixed(0)}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full transition-all duration-700 ease-out"
                                    style={{
                                      width: `${Math.min(fundingPercentage, 100)}%`,
                                      background: fundingPercentage >= 80
                                        ? 'linear-gradient(to right, #34D399, #14B8A6)'
                                        : fundingPercentage >= 50
                                        ? 'linear-gradient(to right, #FBBF24, #FB923C)'
                                        : 'linear-gradient(to right, #94A3B8, #64748B)'
                                    }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <span>{acceptedCount} of {participantCount} funded</span>
                                  {remaining > 0 && (
                                    <span>${remaining.toLocaleString()} remaining</span>
                                  )}
                                </div>
                              </div>

                              {/* Payment Progress (Active Loans Only) */}
                              {loan.status === "ACTIVE" && acceptedCount > 0 && loan.participants && loan.participants.length > 0 && (
                                <div className="space-y-2 pt-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Repayment Progress</span>
                                  </div>
                                  {loan.participants.map((participant: any) => (
                                    participant.status === 'ACCEPTED' && (
                                      <div key={participant.lender_id} className="space-y-1">
                                        <p className="text-xs font-medium">{participant.lender_name}</p>
                                        <PaymentProgressBar
                                          totalPaid={participant.total_paid || 0}
                                          totalAmount={participant.contribution_amount}
                                          showLabels={false}
                                          size="sm"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                          <span>Paid: ${(participant.total_paid || 0).toLocaleString()}</span>
                                          <span>Remaining: ${(participant.remaining_balance || participant.contribution_amount).toLocaleString()}</span>
                                        </div>
                                      </div>
                                    )
                                  ))}
                                </div>
                              )}

                              {/* Action Buttons Row */}
                              <div className="flex gap-2 pt-2">
                                {loan.status === "ACTIVE" && acceptedCount > 0 && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedLoan(loan)
                                      setIsPaymentModalOpen(true)
                                    }}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Receipt className="mr-2 h-4 w-4" />
                                    Record Payment
                                  </Button>
                                )}
                                {participantCount > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleLoanExpansion(loan.loan_id)}
                                    className="flex-1"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="mr-2 h-4 w-4" />
                                        Hide Holders ({participantCount})
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="mr-2 h-4 w-4" />
                                        Show Holders ({participantCount})
                                      </>
                                    )}
                                  </Button>
                                )}
                                {loan.status === "PENDING" && remaining > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedLoan(loan)
                                      setIsAddHoldersModalOpen(true)
                                    }}
                                  >
                                    <Users className="mr-2 h-4 w-4" />
                                    Add Holders
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/dashboard/loans/${loan.loan_id}`)}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Button>
                              </div>

                              {/* Collapsible Lenders List */}
                              {isExpanded && (
                                <div
                                  className="space-y-3 pt-4 border-t"
                                  style={{
                                    animation: 'slideInFromTop 300ms ease-out'
                                  }}
                                >
                                  {loan.participants && loan.participants.length > 0 ? (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Note Holders</span>
                                        <span className="text-sm text-muted-foreground">
                                          {acceptedCount} of {participantCount} funded
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        {loan.participants.map((participant, idx) => (
                                          <div
                                            key={participant.lender_id}
                                            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                                                {participant.lender_name?.charAt(0).toUpperCase() || (idx + 1)}
                                              </div>
                                              <div>
                                                <p className="text-sm font-medium">
                                                  {participant.lender_name || 'Pending Acceptance'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {participant.lender_email || 'Email not available'}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-sm font-semibold">
                                                ${participant.contribution_amount.toLocaleString()}
                                              </p>
                                              <Badge
                                                className="border text-xs"
                                                style={
                                                  participant.status === "ACCEPTED"
                                                    ? { backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
                                                    : { backgroundColor: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' }
                                                }
                                              >
                                                {participant.status === "ACCEPTED" ? "✓ Funded" : "⏳ Pending"}
                                              </Badge>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-center py-4 bg-muted/30 rounded-lg">
                                      <p className="text-sm text-muted-foreground">
                                        No holders invited yet
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Create New Loan */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full" size="lg" onClick={() => router.push("/dashboard/borrower/create-loan")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Note
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Add Holders Modal */}
      {selectedLoan && (
        <AddHoldersModal
          loan={selectedLoan}
          isOpen={isAddHoldersModalOpen}
          onClose={() => {
            setIsAddHoldersModalOpen(false)
            setSelectedLoan(null)
          }}
          onSuccess={() => {
            setIsAddHoldersModalOpen(false)
            setSelectedLoan(null)
            refetch()
          }}
        />
      )}

      {/* Record Payment Modal */}
      {selectedLoan && (
        <RecordPaymentModal
          open={isPaymentModalOpen}
          onOpenChange={setIsPaymentModalOpen}
          loanId={selectedLoan.loan_id}
          lenders={selectedLoan.participants?.filter((p: any) => p.status === 'ACCEPTED') || []}
          onSuccess={() => {
            refetch()
            setIsPaymentModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
