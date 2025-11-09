"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/status-badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, calculateProgress } from "@/lib/utils"
import { toNumber } from "@/lib/type-utils"
import type { LenderLoanPortfolio } from "@/lib/types"

interface LenderLoanCardProps {
  loan: LenderLoanPortfolio
  onClick?: () => void
  onAccept?: () => void
  onDecline?: () => void
}

export function LenderLoanCard({ loan, onClick, onAccept, onDecline }: LenderLoanCardProps) {
  const repaymentProgress = calculateProgress(loan.total_paid, loan.allocated_amount)
  const initials = loan.borrower_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <Card
      className="p-6 cursor-pointer transition-shadow duration-200 hover:shadow-lg"
      onClick={loan.invitation_status === "accepted" ? onClick : undefined}
      role={loan.invitation_status === "accepted" ? "button" : undefined}
      tabIndex={loan.invitation_status === "accepted" ? 0 : undefined}
      onKeyDown={(e) => {
        if (loan.invitation_status === "accepted" && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onClick?.()
        }
      }}
      aria-label={`Loan card: ${loan.loan_name}, ${formatCurrency(loan.allocated_amount)}, ${loan.invitation_status}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 pr-4">{loan.loan_name}</h3>
        <div className="flex gap-2 flex-wrap justify-end">
          <StatusBadge type="invitation" status={loan.invitation_status} size="sm" />
          <StatusBadge type="loan" status={loan.loan_status} size="sm" />
        </div>
      </div>

      {/* Borrower Info */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium text-gray-900">{loan.borrower_name}</div>
          <div className="text-sm text-gray-600">{loan.borrower_email}</div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4">
        {/* Your Investment */}
        <div>
          <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Your Contribution</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(loan.allocated_amount)}</div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 uppercase tracking-wide">Received</span>
            <span className="text-xs font-medium text-gray-900">{repaymentProgress.toFixed(1)}%</span>
          </div>
          <Progress value={repaymentProgress} className="h-2 bg-gray-100" indicatorClassName="bg-green-500" />
          <div className="text-sm text-gray-600 mt-1">
            {formatCurrency(loan.total_paid)} / {formatCurrency(loan.allocated_amount)}
          </div>
        </div>

        {/* Investment Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <div className="text-xs text-gray-600 uppercase tracking-wide">Received</div>
            <div className="text-sm font-medium text-gray-900">{formatCurrency(loan.total_paid)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 uppercase tracking-wide">Remaining</div>
            <div className="text-sm font-medium text-gray-900">{formatCurrency(loan.remaining_balance)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 uppercase tracking-wide">Interest Rate</div>
            <div className="text-sm font-medium text-gray-900">{(toNumber(loan.interest_rate) * 100).toFixed(2)}% APR</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 uppercase tracking-wide">Term</div>
            <div className="text-sm font-medium text-gray-900">{loan.term_months} months</div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        {loan.invitation_status === "pending" ? (
          <div className="flex gap-3">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onAccept?.()
              }}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Accept
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onDecline?.()
              }}
              variant="outline"
              className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
            >
              Decline
            </Button>
          </div>
        ) : loan.invitation_status === "accepted" ? (
          <Button onClick={onClick} variant="outline" className="w-full bg-transparent">
            View Details
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
