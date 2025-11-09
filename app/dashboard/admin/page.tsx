"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLoanCard } from "@/components/loan-cards/admin-loan-card"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, Users, DollarSign, TrendingUp, AlertCircle, Settings } from "lucide-react"
import { fetchAdminLoans, fetchUsers } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { useUser } from "@/lib/user-context"
import type { AdminLoan, SystemUser } from "@/lib/types"
import useSWR from "swr"

// Calculate dashboard statistics from loans
function calculateStats(loans: AdminLoan[], users: SystemUser[]) {
  const activeLoans = loans.filter((l) => l.status === "active").length
  const totalLoans = loans.length
  const totalBorrowed = loans.reduce((sum, l) => sum + Number.parseFloat(String(l.principal_amount)), 0)
  const totalRepaid = loans.reduce((sum, l) => sum + Number.parseFloat(String(l.total_repaid_amount || 0)), 0)

  const activeBorrowers = users.filter((u) => u.role === "borrower" && u.is_active).length
  const activeLenders = users.filter((u) => u.role === "lender" && u.is_active).length

  return {
    totalLoans,
    activeLoans,
    totalBorrowed,
    totalRepaid,
    activeBorrowers,
    activeLenders,
  }
}

// Get status counts for filter tabs
function getStatusCounts(loans: AdminLoan[]) {
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

function sortLoans(loans: AdminLoan[], sortBy: SortOption): AdminLoan[] {
  const sorted = [...loans]

  switch (sortBy) {
    case "newest":
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case "oldest":
      return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    case "amount-high":
      return sorted.sort((a, b) => Number.parseFloat(String(b.principal_amount)) - Number.parseFloat(String(a.principal_amount)))
    case "amount-low":
      return sorted.sort((a, b) => Number.parseFloat(String(a.principal_amount)) - Number.parseFloat(String(b.principal_amount)))
    default:
      return sorted
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, activeRole } = useUser()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<SortOption>("newest")

  const userEmail = user?.email || ""

  // Redirect if not using admin role
  useEffect(() => {
    if (user && activeRole !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, activeRole, router])

  // Fetch loans using SWR
  const {
    data: loansResponse,
    error: loansError,
    isLoading: loansLoading,
  } = useSWR(
    userEmail && activeRole ? ["adminLoans", userEmail, activeRole, statusFilter] : null,
    () => fetchAdminLoans(userEmail, activeRole || "admin", statusFilter)
  )

  // Fetch users using SWR
  const {
    data: usersResponse,
    error: usersError,
    isLoading: usersLoading,
  } = useSWR(
    userEmail && activeRole ? ["adminUsers", userEmail, activeRole] : null,
    () => fetchUsers(userEmail, activeRole || "admin")
  )

  const loans = loansResponse?.data || []
  const users = usersResponse?.data || []

  // Calculate stats and counts
  const stats = useMemo(() => calculateStats(loans, users), [loans, users])
  const counts = useMemo(() => getStatusCounts(loans), [loans])

  // Filter and sort loans
  const filteredAndSortedLoans = useMemo(() => {
    const filtered = statusFilter === "all" ? loans : loans.filter((loan) => loan.status === statusFilter)
    return sortLoans(filtered, sortBy)
  }, [loans, statusFilter, sortBy])

  // Loading state
  if (loansLoading || usersLoading) {
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
  if (loansError || loansResponse?.error || usersError || usersResponse?.error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load dashboard data. Please try again.</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  // Empty state - filtered results
  const showFilteredEmptyState = filteredAndSortedLoans.length === 0 && statusFilter !== "all"

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <Button size="lg" onClick={() => router.push("/admin/users")} className="w-full sm:w-auto">
          <Settings className="w-5 h-5 mr-2" />
          Manage Users
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Loans" value={stats.totalLoans} icon={FileText} subtext="All time" />
        <StatCard label="Active Loans" value={stats.activeLoans} icon={TrendingUp} subtext="Currently active" />
        <StatCard
          label="Total Volume"
          value={formatCurrency(stats.totalBorrowed, "USD")}
          icon={DollarSign}
          subtext="Principal borrowed"
        />
        <StatCard
          label="Active Users"
          value={`${stats.activeBorrowers}B / ${stats.activeLenders}L`}
          icon={Users}
          subtext="Borrowers / Lenders"
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
      ) : loans.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mb-4 mx-auto" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No loans yet</h3>
          <p className="text-gray-600">Loans will appear here once borrowers create them</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list" aria-label="Loans list">
          {filteredAndSortedLoans.map((loan) => (
            <div key={loan.id} role="listitem">
              <AdminLoanCard
                loan={loan}
                onClick={() => router.push(`/loans/${loan.id}`)}
                onViewAuditLog={() => router.push(`/loans/${loan.id}?tab=activity`)}
                onViewLenders={() => router.push(`/loans/${loan.id}?tab=lenders`)}
                onViewRepayments={() => router.push(`/loans/${loan.id}?tab=repayments`)}
                onDeactivateBorrower={() => router.push(`/admin/users?search=${encodeURIComponent(loan.borrower.email)}`)}
                onCancelLoan={() => router.push(`/loans/${loan.id}`)}
                onViewNotifications={() => router.push(`/loans/${loan.id}?tab=activity`)}
              />
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
