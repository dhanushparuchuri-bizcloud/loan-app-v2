"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { BorrowerLoanCard } from "@/components/loan-cards/borrower-loan-card"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, FileText, UserPlus, DollarSign, TrendingUp, AlertCircle } from "lucide-react"
import { fetchBorrowerLoans } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { toNumber } from "@/lib/type-utils"
import type { BorrowerLoan, DashboardStats, StatusCounts } from "@/lib/types"
import useSWR from "swr"

// Calculate dashboard statistics from loans array
function calculateStats(loans: BorrowerLoan[]): DashboardStats {
  const activeLoans = loans.filter((l) => l.status === "active").length
  const pendingInvitations = loans.reduce((sum, l) => sum + l.pending_invitations_count, 0)
  // Use type-safe toNumber() to handle both string and number types from PostgREST
  const totalBorrowed = loans.reduce((sum, l) => sum + toNumber(l.principal_amount), 0)
  const totalRepaid = loans.reduce((sum, l) => sum + toNumber(l.total_repaid_amount), 0)
  const repaidPercentage = totalBorrowed === 0 ? 0 : Math.round((totalRepaid / totalBorrowed) * 100)

  return {
    activeLoans,
    pendingInvitations,
    totalBorrowed,
    totalRepaid,
    repaidPercentage,
  }
}

// Get status counts for filter tabs
function getStatusCounts(loans: BorrowerLoan[]): StatusCounts {
  return {
    all: loans.length,
    draft: loans.filter((l) => l.status === "draft").length,
    pending: loans.filter((l) => l.status === "pending").length,
    active: loans.filter((l) => l.status === "active").length,
    completed: loans.filter((l) => l.status === "completed").length,
  }
}

// Sort options
type SortOption = "newest" | "oldest" | "amount-high" | "amount-low"

function sortLoans(loans: BorrowerLoan[], sortBy: SortOption): BorrowerLoan[] {
  const sorted = [...loans]

  switch (sortBy) {
    case "newest":
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case "oldest":
      return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    case "amount-high":
      // Use toNumber() to handle both string and number types from PostgREST
      return sorted.sort((a, b) => toNumber(b.principal_amount) - toNumber(a.principal_amount))
    case "amount-low":
      return sorted.sort((a, b) => toNumber(a.principal_amount) - toNumber(b.principal_amount))
    default:
      return sorted
  }
}

export default function BorrowerDashboard() {
  const router = useRouter()
  const { user, activeRole } = useUser()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<SortOption>("newest")

  const userEmail = user?.email || ""

  // Redirect if not using borrower role
  useEffect(() => {
    if (user && activeRole !== 'borrower') {
      router.push('/dashboard')
    }
  }, [user, activeRole, router])

  // Fetch loans using SWR
  const {
    data: response,
    error,
    isLoading,
  } = useSWR(
    userEmail && activeRole ? ["borrowerLoans", userEmail, activeRole] : null,
    () => fetchBorrowerLoans(userEmail, activeRole || "borrower")
  )

  const loans = response?.data || []

  // Calculate stats and counts
  const stats = useMemo(() => calculateStats(loans), [loans])
  const counts = useMemo(() => getStatusCounts(loans), [loans])

  // Filter and sort loans
  const filteredAndSortedLoans = useMemo(() => {
    const filtered = statusFilter === "all" ? loans : loans.filter((loan) => loan.status === statusFilter)
    return sortLoans(filtered, sortBy)
  }, [loans, statusFilter, sortBy])

  // Loading state
  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error || response?.error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load loans. Please try again.</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  // Empty state - no loans at all
  if (loans.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Loans</h1>
          <Button size="lg" onClick={() => router.push("/dashboard/borrower/create")} className="w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-2" />
            Create New Loan
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <FileText className="w-16 h-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No loans yet</h2>
          <p className="text-gray-600 mb-6 text-center max-w-md">
            Create your first loan to start connecting with lenders
          </p>
          <Button size="lg" onClick={() => router.push("/dashboard/borrower/create")}>
            <Plus className="w-5 h-5 mr-2" />
            Create New Loan
          </Button>
        </div>
      </div>
    )
  }

  // Empty state - filtered results
  const showFilteredEmptyState = filteredAndSortedLoans.length === 0 && statusFilter !== "all"

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Loans</h1>
        <Button size="lg" onClick={() => router.push("/dashboard/borrower/create")} className="w-full sm:w-auto">
          <Plus className="w-5 h-5 mr-2" />
          Create New Loan
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard label="Active Loans" value={stats.activeLoans} icon={FileText} subtext="Currently active" />
        <StatCard
          label="Pending Invitations"
          value={stats.pendingInvitations}
          icon={UserPlus}
          subtext="Awaiting lender response"
          variant={stats.pendingInvitations > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Total Borrowed"
          value={formatCurrency(stats.totalBorrowed, "USD")}
          icon={DollarSign}
          subtext="Principal amount"
        />
        <StatCard
          label="Total Repaid"
          value={formatCurrency(stats.totalRepaid, "USD")}
          icon={TrendingUp}
          subtext={`${stats.repaidPercentage}% complete`}
        />
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-5 w-full sm:w-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="draft" className="text-xs sm:text-sm">
              Draft ({counts.draft})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs sm:text-sm">
              Pending ({counts.pending})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs sm:text-sm">
              Active ({counts.active})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs sm:text-sm">
              Completed ({counts.completed})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="amount-high">Amount: High to Low</SelectItem>
            <SelectItem value="amount-low">Amount: Low to High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loans List */}
      {showFilteredEmptyState ? (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No {statusFilter} loans found</h3>
          <p className="text-gray-600 mb-4">Try a different filter</p>
          <Button variant="link" onClick={() => setStatusFilter("all")}>
            View all loans
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list" aria-label="Loans list">
          {filteredAndSortedLoans.map((loan) => (
            <div key={loan.id} role="listitem">
              <BorrowerLoanCard loan={loan} onClick={() => router.push(`/loans/${loan.id}`)} />
            </div>
          ))}
        </div>
      )}

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Showing {filteredAndSortedLoans.length} {statusFilter === "all" ? "" : statusFilter} loans
      </div>
    </div>
  )
}
