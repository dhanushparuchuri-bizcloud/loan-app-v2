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
import { DollarSign, TrendingUp, Clock, Bell, Eye, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LenderDashboard() {
  const [isRoleSwitching, setIsRoleSwitching] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
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

  const toggleItemExpansion = (loanId: string) => {
    setExpandedItems(prev => {
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
      case "ACCEPTED":
        return (
          <Badge
            className="border"
            style={{
              backgroundColor: '#ECFDF5',
              color: '#047857',
              borderColor: '#A7F3D0'
            }}
          >
            ✓ Accepted
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
      case "DECLINED":
        return (
          <Badge
            className="border"
            style={{
              backgroundColor: '#FFF1F2',
              color: '#BE123C',
              borderColor: '#FECDD3'
            }}
          >
            ✗ Declined
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
          <h1 className="text-3xl font-bold text-balance">Note Portfolio</h1>
          <p className="text-muted-foreground">Manage your investments and review note opportunities</p>
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
                          <h4 className="font-semibold">Note Offering</h4>
                          <Badge variant="outline" className="text-yellow-700 border-yellow-300 flex items-center gap-1">
                            {invitation.loan_purpose === "Business" && "🏢"} {invitation.loan_purpose || 'Business'}
                          </Badge>
                        </div>
                        {invitation.loan_purpose === "Business" && invitation.entity_name && (
                          <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-xs text-blue-700">
                              <div className="font-medium">{invitation.entity_name}</div>
                              <div className="text-blue-600">{invitation.entity_type}</div>
                            </div>
                          </div>
                        )}
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
                            <span className="text-muted-foreground">Issuer:</span>
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
                            Review Note
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
            subtitle="Notes to review"
            icon={<Bell className="h-4 w-4 text-muted-foreground" />}
          />
          <StatsCard
            title="Active Investments"
            value={lenderStats?.active_investments || 0}
            subtitle="Current notes"
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
                  <CardTitle>My Note Portfolio</CardTitle>
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
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 bg-primary/10">
                      {invitations.length > 0 ? (
                        <Bell className="h-10 w-10 text-yellow-600" />
                      ) : (
                        <TrendingUp className="h-10 w-10 text-primary" />
                      )}
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      {invitations.length > 0 ? "Review Pending Invitations" : "Start Building Your Portfolio"}
                    </h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                      {invitations.length > 0
                        ? "You have pending note invitations to review above. Accept invitations to start earning returns."
                        : "You haven't accepted any note invitations yet. When you do, they'll appear here in your portfolio."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPortfolio.map((item) => {
                      const isExpanded = expandedItems.has(item.loan_id)
                      const contributionPercentage = item.loan_amount > 0
                        ? ((item.contribution_amount / item.loan_amount) * 100).toFixed(1)
                        : '0'

                      return (
                        <Card key={item.loan_id} className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/20">
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              {/* Header */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold">{item.borrower_name}</h4>
                                    {getStatusBadge(item.participation_status)}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      {item.purpose === "Business" && "🏢"} {item.purpose}
                                    </span>
                                    {item.purpose === "Business" && item.entity_name && (
                                      <>
                                        <span>•</span>
                                        <span className="text-blue-600">{item.entity_name}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Key Metrics */}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Your Share</p>
                                  <p className="font-semibold text-lg">
                                    ${item.contribution_amount.toLocaleString()}
                                    <span className="text-sm text-muted-foreground ml-1">
                                      ({contributionPercentage}%)
                                    </span>
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    of ${item.loan_amount.toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Expected Returns</p>
                                  {item.payment_amount ? (
                                    <>
                                      <p className="font-semibold text-lg text-green-600">
                                        ${item.payment_amount.toLocaleString()}/mo
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        ${item.total_interest?.toLocaleString() || '0'} total
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-semibold text-lg text-green-600">
                                        ${item.expected_annual_return.toLocaleString()}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        ${item.expected_monthly_return.toLocaleString()}/mo
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="text-sm">
                                <span className="font-medium">{item.interest_rate}% APR</span>
                                <span className="text-muted-foreground"> • </span>
                                <span className="text-muted-foreground">Note: {item.loan_status}</span>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 pt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleItemExpansion(item.loan_id)}
                                  className="flex-1"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="mr-2 h-4 w-4" />
                                      Less Info
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="mr-2 h-4 w-4" />
                                      More Info
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/dashboard/loans/${item.loan_id}`)}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Receipt
                                </Button>
                              </div>

                              {/* Expandable Details */}
                              {isExpanded && (
                                <div
                                  className="pt-3 border-t space-y-2 text-sm"
                                  style={{
                                    animation: 'slideInFromTop 300ms ease-out'
                                  }}
                                >
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-muted-foreground">Total Loan Amount</p>
                                      <p className="font-medium">${item.loan_amount.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Your Contribution</p>
                                      <p className="font-medium">{contributionPercentage}%</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Term</p>
                                      <p className="font-medium">{item.term}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Payment Frequency</p>
                                      <p className="font-medium">
                                        {item.maturity_terms?.payment_frequency || 'Monthly'}
                                      </p>
                                    </div>
                                  </div>
                                  {item.purpose === "Business" && item.entity_name && (
                                    <div className="pt-2">
                                      <p className="text-muted-foreground">Business Entity</p>
                                      <p className="font-medium">
                                        {item.entity_name} ({item.entity_type})
                                      </p>
                                    </div>
                                  )}
                                  <div className="pt-2">
                                    <p className="text-muted-foreground">Description</p>
                                    <p className="text-sm">{item.description || 'No description provided'}</p>
                                  </div>
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