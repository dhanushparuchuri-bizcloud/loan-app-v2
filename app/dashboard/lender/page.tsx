"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardLoader } from "@/components/dashboard-loader"
import { DashboardHeader } from "@/components/dashboard-header"
import { StatsCard } from "@/components/stats-card"
import { useAuth } from "@/lib/auth-context"
import { useLenderDashboard } from "@/hooks/use-dashboard"
import { DollarSign, TrendingUp, Clock, Bell, Eye, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LenderDashboard() {
  const [isRoleSwitching, setIsRoleSwitching] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const { user } = useAuth()
  const { lenderStats, invitations, portfolio, portfolioSummary, isLoading, error, refetch } = useLenderDashboard()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    if (!user.is_lender) {
      router.push("/dashboard/borrower")
      return
    }
  }, [user, router])

  const handleRoleSwitch = () => {
    setIsRoleSwitching(true)
    setTimeout(() => {
      router.push("/dashboard/borrower")
    }, 1500)
  }

  if (isLoading || isRoleSwitching) {
    return <DashboardLoader type="lender" />
  }

  if (!user) return null

  console.log('[LenderDashboard] Render data:', {
    lenderStats,
    invitationsCount: invitations.length,
    portfolioCount: portfolio.length,
    portfolioSummary,
    error
  })

  // Filter portfolio based on status filter
  const filteredPortfolio = portfolio.filter(item => {
    if (statusFilter === "all") return true
    if (statusFilter === "pending") return item.participation_status === "PENDING"
    if (statusFilter === "active") return item.participation_status === "ACCEPTED"
    return true
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        )
      case "ACCEPTED":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Accepted
          </Badge>
        )
      case "ACTIVE":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Active
          </Badge>
        )
      case "DECLINED":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Declined
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader currentRole="lender" onRoleSwitch={handleRoleSwitch} />

      <main className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-balance">Lending Portfolio</h1>
          <p className="text-muted-foreground">Manage your investments and review loan opportunities</p>
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

        {/* Pending Invitations - Priority Section */}
        {invitations.length > 0 && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-yellow-600" />
                Pending Invitations
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {invitations.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {invitations.map((invitation) => (
                  <Card key={invitation.loan_id} className="border-yellow-200">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">Loan Request</h4>
                          <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                            {invitation.loan_purpose || 'Business'}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Amount:</span>
                            <span className="font-medium">${invitation.loan_amount?.toLocaleString() || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Your Contribution:</span>
                            <span className="font-bold text-primary">
                              ${invitation.contribution_amount?.toLocaleString() || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Interest Rate:</span>
                            <span className="font-medium">{invitation.interest_rate || 'N/A'}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Borrower:</span>
                            <span className="font-medium">{invitation.borrower_name || 'Unknown'}</span>
                          </div>
                        </div>
                        <div className="pt-2">
                          <p className="text-sm text-muted-foreground mb-3">
                            {invitation.loan_description || 'No description available'}
                          </p>
                          <Button
                            className="w-full"
                            onClick={() => router.push(`/dashboard/lender/review/${invitation.loan_id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Review Loan
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <StatsCard
            title="Pending Invitations"
            value={lenderStats?.pending_invitations || 0}
            subtitle="Loans to review"
            icon={<Bell className="h-4 w-4 text-muted-foreground" />}
          />
          <StatsCard
            title="Active Investments"
            value={lenderStats?.active_investments || 0}
            subtitle="Current loans"
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          />
          <StatsCard
            title="Total Lent"
            value={`$${(lenderStats?.total_lent || 0).toLocaleString()}`}
            subtitle="Principal invested"
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* My Lending Portfolio */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>My Lending Portfolio</CardTitle>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Accepted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredPortfolio.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                      {invitations.length > 0 ? (
                        <AlertCircle className="h-8 w-8 text-yellow-600" />
                      ) : (
                        <DollarSign className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {invitations.length > 0 ? "Review Pending Invitations" : "No investments yet"}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {invitations.length > 0
                        ? "You have pending loan invitations to review above"
                        : "Start lending to build your investment portfolio"}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Interest</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Returns</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPortfolio.map((item) => (
                        <TableRow key={item.loan_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.borrower_name}</p>
                              <p className="text-sm text-muted-foreground">{item.purpose}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">${item.contribution_amount.toLocaleString()}</p>
                              <p className="text-sm text-muted-foreground">
                                of ${item.loan_amount.toLocaleString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.interest_rate}%</p>
                              <p className="text-sm text-muted-foreground">{item.term}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {getStatusBadge(item.participation_status)}
                              <p className="text-xs text-muted-foreground">
                                Loan: {item.loan_status}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-green-600">
                                ${item.expected_annual_return.toLocaleString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                ${item.expected_monthly_return.toLocaleString()}/mo
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/dashboard/loans/${item.loan_id}`)}
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

          {/* Quick Stats */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Invested</span>
                  <span className="font-medium">${(portfolioSummary?.total_invested || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expected Returns</span>
                  <span className="font-medium text-green-600">${(portfolioSummary?.total_expected_returns || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Investments</span>
                  <span className="font-medium">{portfolioSummary?.active_investments || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Reviews</span>
                  <span className="font-medium">{invitations.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}