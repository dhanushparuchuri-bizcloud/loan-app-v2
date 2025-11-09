"use client"

import { StatCard } from "@/components/stat-card"
import { DollarSign, TrendingUp, Briefcase, Bell } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { LenderDashboardStats } from "@/lib/types"

interface PortfolioSummaryCardsProps {
  stats: LenderDashboardStats
}

export function PortfolioSummaryCards({ stats }: PortfolioSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Total Allocated"
        value={formatCurrency(stats.totalAllocated)}
        icon={DollarSign}
        subtext="Total amount invested"
      />
      <StatCard
        label="Total Repaid"
        value={formatCurrency(stats.totalRepaid)}
        icon={TrendingUp}
        subtext={`${stats.repaymentPercentage.toFixed(1)}% of allocated`}
      />
      <StatCard label="Active Loans" value={stats.activeLoansCount} icon={Briefcase} subtext="Currently active" />
      <StatCard
        label="Pending Invitations"
        value={stats.pendingInvitationsCount}
        icon={Bell}
        variant={stats.pendingInvitationsCount > 0 ? "warning" : "default"}
        subtext={stats.pendingInvitationsCount > 0 ? "Requires action" : "All caught up"}
      />
    </div>
  )
}
