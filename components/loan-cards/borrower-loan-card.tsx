"use client"

import { Card } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, Users, Clock, Info } from "lucide-react"
import { formatCurrency, formatDate, calculateProgress } from "@/lib/utils"
import { toNumber } from "@/lib/type-utils"
import type { BorrowerLoan } from "@/lib/types"

interface BorrowerLoanCardProps {
  loan: BorrowerLoan
  onClick?: () => void
}

export function BorrowerLoanCard({ loan, onClick }: BorrowerLoanCardProps) {
  const fundingProgress = calculateProgress(loan.total_funded_amount, loan.principal_amount)
  const repaymentProgress = calculateProgress(loan.total_repaid_amount, loan.principal_amount)

  return (
    <Card
      className="p-6 cursor-pointer transition-shadow duration-200 hover:shadow-lg group relative"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }}
      aria-label={`Loan card: ${loan.loan_name}, ${formatCurrency(loan.principal_amount, loan.currency_code)}, ${loan.status}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 pr-4">{loan.loan_name}</h3>
        <StatusBadge type="loan" status={loan.status} />
      </div>

      {/* Body - Grid Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Principal Amount */}
          <div>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(loan.principal_amount, loan.currency_code)}
            </div>
            <div className="text-sm text-gray-600">{loan.currency_code}</div>
          </div>

          {/* Loan Details Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <div className="text-xs text-gray-600 uppercase tracking-wide">Interest Rate</div>
              <div className="text-sm font-medium text-gray-900">{(toNumber(loan.interest_rate) * 100).toFixed(2)}% APR</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 uppercase tracking-wide">Term</div>
              <div className="text-sm font-medium text-gray-900">{loan.term_months} months</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 uppercase tracking-wide">Created</div>
              <div className="text-sm font-medium text-gray-900">{formatDate(loan.created_at)}</div>
            </div>
            {loan.purpose && (
              <div className="col-span-2">
                <div className="text-xs text-gray-600 uppercase tracking-wide">Purpose</div>
                <div className="text-sm font-medium text-gray-900 line-clamp-2">{loan.purpose}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Funding Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 uppercase tracking-wide">Funded</span>
              <span className="text-xs font-medium text-gray-900">{fundingProgress.toFixed(0)}%</span>
            </div>
            <Progress value={fundingProgress} className="h-2 bg-gray-100" indicatorClassName="bg-blue-500" />
            <div className="text-sm text-gray-600 mt-1">
              {formatCurrency(loan.total_funded_amount, loan.currency_code)} /{" "}
              {formatCurrency(loan.principal_amount, loan.currency_code)}
            </div>
          </div>

          {/* Repayment Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 uppercase tracking-wide">Repaid</span>
              <span className="text-xs font-medium text-gray-900">{repaymentProgress.toFixed(0)}%</span>
            </div>
            <Progress value={repaymentProgress} className="h-2 bg-gray-100" indicatorClassName="bg-green-500" />
            <div className="text-sm text-gray-600 mt-1">
              {formatCurrency(loan.total_repaid_amount, loan.currency_code)} /{" "}
              {formatCurrency(loan.principal_amount, loan.currency_code)}
            </div>
          </div>

          {/* Lender Stats */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-sm text-gray-700">
              <Users className="w-4 h-4" />
              <span className="font-medium">{loan.accepted_lenders_count}</span>
              <span className="text-gray-600">lenders</span>
            </div>
            {loan.pending_invitations_count > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                  {loan.pending_invitations_count} pending
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draft Status Info */}
      {loan.status === "draft" && (
        <Alert className="mt-4 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            This loan is in draft status. Invite lenders and click "Activate Loan" to make it live.
          </AlertDescription>
        </Alert>
      )}

      {/* Hover Icon */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <Eye className="w-5 h-5 text-gray-400" />
      </div>
    </Card>
  )
}
