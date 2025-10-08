"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardLoader } from "@/components/dashboard-loader"
import { DashboardHeader } from "@/components/dashboard-header"
import { StatsCard } from "@/components/stats-card"
import { useAuth } from "@/lib/auth-context"
import { useDashboard } from "@/hooks/use-dashboard"
import { DollarSign, TrendingUp, Clock, Plus, Eye, AlertCircle, Users } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function BorrowerDashboard() {
  const [isRoleSwitching, setIsRoleSwitching] = useState(false)
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
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        )
      case "ACTIVE":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Active
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
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                      <DollarSign className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No notes yet</h3>
                    <p className="text-muted-foreground mb-4">Create your first note to get started</p>
                    <Button onClick={() => router.push("/dashboard/borrower/create-loan")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Note
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loans.map((loan) => {
                      const totalInvited = loan.funding_progress.total_invited || 0
                      const remaining = loan.amount - totalInvited
                      const fundingPercentage = loan.amount > 0 ? (totalInvited / loan.amount) * 100 : 0

                      return (
                        <Card key={loan.loan_id} className="overflow-hidden">
                          <CardContent className="p-6">
                            <div className="space-y-4">
                              {/* Header Row */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-xl font-semibold">{loan.loan_name}</h3>
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
                                <div className="flex gap-2">
                                  {loan.status === "PENDING" && remaining > 0 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => router.push(`/dashboard/loans/${loan.loan_id}#add-lenders`)}
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
                              </div>

                              {/* Funding Progress Bar */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium">Invited Amount</span>
                                  <span className="text-muted-foreground">
                                    ${totalInvited.toLocaleString()} / ${loan.amount.toLocaleString()}
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${Math.min(fundingPercentage, 100)}%` }}
                                  />
                                </div>
                                {remaining > 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    ${remaining.toLocaleString()} remaining to invite
                                  </p>
                                )}
                              </div>

                              {/* Lenders List */}
                              {loan.participants && loan.participants.length > 0 ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Note Holders</span>
                                    <span className="text-sm text-muted-foreground">
                                      {loan.accepted_participants} of {loan.participant_count} funded
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
                                            variant="secondary"
                                            className={
                                              participant.status === "ACCEPTED"
                                                ? "bg-green-100 text-green-800 text-xs"
                                                : "bg-yellow-100 text-yellow-800 text-xs"
                                            }
                                          >
                                            {participant.status === "ACCEPTED" ? "✓ Funded" : "⏳ Pending"}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-4 bg-muted/30 rounded-lg">
                                  <p className="text-sm text-muted-foreground">
                                    No holders invited yet
                                  </p>
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
    </div>
  )
}
