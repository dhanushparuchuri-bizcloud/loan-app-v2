"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/status-badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, calculateProgress } from "@/lib/utils"
import { ArrowRight, Briefcase } from "lucide-react"
import type { LenderLoanPortfolio } from "@/lib/types"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface ActiveLoansSectionProps {
  loans: LenderLoanPortfolio[]
}

export function ActiveLoansSection({ loans }: ActiveLoansSectionProps) {
  const router = useRouter()
  const displayLoans = loans.slice(0, 5)
  const hasMore = loans.length > 5

  if (loans.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Active Loans</h3>
        <p className="text-sm text-gray-600">Accept an invitation to get started with your first loan.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {displayLoans.map((loan) => {
        const repaymentProgress = calculateProgress(loan.total_paid, loan.allocated_amount)
        const initials = loan.borrower_name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()

        return (
          <Card key={loan.loan_lender_id} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{loan.loan_name}</h3>
                  <p className="text-sm text-gray-600">From: {loan.borrower_name}</p>
                </div>
              </div>
              <StatusBadge type="loan" status={loan.loan_status} size="sm" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">Your Share</div>
                <div className="text-lg font-semibold text-gray-900">{formatCurrency(loan.allocated_amount)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">Remaining</div>
                <div className="text-lg font-semibold text-gray-900">{formatCurrency(loan.remaining_balance)}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600 uppercase tracking-wide">Repayment Progress</span>
                <span className="text-xs font-medium text-gray-900">{repaymentProgress.toFixed(1)}% repaid</span>
              </div>
              <Progress value={repaymentProgress} className="h-2 bg-gray-100" indicatorClassName="bg-green-500" />
            </div>

            <div className="flex items-center justify-end">
              <Button
                onClick={() => router.push(`/loans/${loan.loan_id}`)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                View Details
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )
      })}

      {hasMore && (
        <div className="text-center">
          <Link href="/dashboard/lender/loans">
            <Button variant="outline" className="gap-2 bg-transparent">
              View All Active Loans ({loans.length})
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
