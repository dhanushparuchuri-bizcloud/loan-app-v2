"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DashboardLoader } from "@/components/dashboard-loader"
import { DashboardHeader } from "@/components/dashboard-header"
import { StatsCard } from "@/components/stats-card"
import { useAuth } from "@/lib/auth-context"
import { useDashboard } from "@/hooks/use-dashboard"
import { DollarSign, TrendingUp, Clock, Plus, Eye, AlertCircle } from "lucide-react"
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Interest Rate</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Funded</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loans.map((loan) => (
                        <TableRow key={loan.loan_id}>
                          <TableCell className="font-medium">${loan.amount.toLocaleString()}</TableCell>
                          <TableCell>{loan.interest_rate}%</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {loan.purpose === "Business" && "🏢"} {loan.purpose}
                              </div>
                              {loan.purpose === "Business" && loan.entity_name && (
                                <div className="text-xs text-muted-foreground">
                                  {loan.entity_name} ({loan.entity_type})
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(loan.status)}</TableCell>
                          <TableCell>
                            ${loan.total_funded.toLocaleString()} / ${loan.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/dashboard/loans/${loan.loan_id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
