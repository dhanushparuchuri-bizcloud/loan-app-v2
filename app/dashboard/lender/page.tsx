"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { fetchLenderPortfolio, fetchLenderRepayments, fetchUnreadNotificationCount } from "@/lib/api"
import { PortfolioSummaryCards } from "@/components/dashboard/portfolio-summary-cards"
import { PendingInvitationsSection } from "@/components/dashboard/pending-invitations-section"
import { ActiveLoansSection } from "@/components/dashboard/active-loans-section"
import { RecentRepaymentsSection } from "@/components/dashboard/recent-repayments-section"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"
import type { LenderLoanPortfolio, Repayment, LenderDashboardStats } from "@/lib/types"
import { toNumber } from "@/lib/type-utils"

export default function LenderDashboardPage() {
  const router = useRouter()
  const { user, activeRole } = useUser()
  const [portfolio, setPortfolio] = useState<LenderLoanPortfolio[]>([])
  const [repayments, setRepayments] = useState<Repayment[]>([])
  const [stats, setStats] = useState<LenderDashboardStats>({
    totalAllocated: 0,
    totalRepaid: 0,
    repaymentPercentage: 0,
    activeLoansCount: 0,
    pendingInvitationsCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check role access
  useEffect(() => {
    if (user && activeRole !== "lender") {
      router.push("/dashboard")
    }
  }, [user, activeRole, router])

  // Fetch dashboard data
  useEffect(() => {
    async function loadDashboard() {
      if (!user?.email) return

      setLoading(true)
      setError(null)

      try {
        // Fetch portfolio data
        const portfolioResult = await fetchLenderPortfolio(user.email, user.email, activeRole)

        if (portfolioResult.error) {
          throw new Error(portfolioResult.error)
        }

        const portfolioData = portfolioResult.data || []
        setPortfolio(portfolioData)

        // Calculate stats
        const accepted = portfolioData.filter((p) => p.invitation_status === "accepted")
        const pending = portfolioData.filter((p) => p.invitation_status === "pending")
        const active = accepted.filter((p) => p.loan_status === "active")

        const totalAllocated = accepted.reduce((sum, p) => sum + toNumber(p.allocated_amount), 0)
        const totalRepaid = accepted.reduce((sum, p) => sum + toNumber(p.total_paid), 0)
        const repaymentPercentage = totalAllocated > 0 ? (totalRepaid / totalAllocated) * 100 : 0

        setStats({
          totalAllocated,
          totalRepaid,
          repaymentPercentage,
          activeLoansCount: active.length,
          pendingInvitationsCount: pending.length,
        })

        // Fetch recent repayments
        const repaymentsResult = await fetchLenderRepayments(user.email, user.email, activeRole, 10)

        if (!repaymentsResult.error) {
          setRepayments(repaymentsResult.data || [])
        }
      } catch (err) {
        console.error("[v0] Failed to load lender dashboard:", err)
        setError(err instanceof Error ? err.message : "Failed to load dashboard")
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [user, activeRole])

  // Periodic notification refresh
  useEffect(() => {
    if (!user?.email) return

    const interval = setInterval(async () => {
      await fetchUnreadNotificationCount(user.email, activeRole)
    }, 60000) // Every 60 seconds

    return () => clearInterval(interval)
  }, [user, activeRole])

  if (!user || activeRole !== "lender") {
    return null
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        <div className="space-y-8">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const pendingInvitations = portfolio.filter((p) => p.invitation_status === "pending")
  const activeLoans = portfolio.filter((p) => p.invitation_status === "accepted" && p.loan_status === "active")

  // Empty state for new lenders
  if (portfolio.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Lender Dashboard</h1>
          <p className="text-gray-600">Welcome to your lending portfolio</p>
        </div>

        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Loan Invitations Yet</h2>
            <p className="text-gray-600 mb-6">
              You'll see loan invitations here once borrowers invite you to fund loans. Your portfolio will appear on
              this dashboard.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lender Dashboard</h1>
        <p className="text-gray-600">Manage your loan portfolio and track repayments</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8">
        <PortfolioSummaryCards stats={stats} />
      </div>

      {/* Pending Invitations Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Pending Invitations ({stats.pendingInvitationsCount})</h2>
          {pendingInvitations.length > 3 && (
            <Button onClick={() => router.push("/invitations")} variant="ghost" size="sm" className="gap-2">
              View All
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          )}
        </div>
        <PendingInvitationsSection invitations={pendingInvitations} />
      </div>

      {/* Active Loans Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Active Loans ({stats.activeLoansCount})</h2>
          {activeLoans.length > 5 && (
            <Button onClick={() => router.push("/dashboard/lender/loans")} variant="ghost" size="sm" className="gap-2">
              View All
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          )}
        </div>
        <ActiveLoansSection loans={activeLoans} />
      </div>

      {/* Recent Repayments Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Recent Repayments</h2>
          {repayments.length > 10 && (
            <Button onClick={() => router.push("/repayments/review")} variant="ghost" size="sm" className="gap-2">
              View All
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          )}
        </div>
        <RecentRepaymentsSection repayments={repayments} />
      </div>
    </div>
  )
}
