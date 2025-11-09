"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FileText, Users, DollarSign, MoreVertical, AlertTriangle, UserX } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { AdminLoan } from "@/lib/types"

interface AdminLoanCardProps {
  loan: AdminLoan
  onClick?: () => void
  onViewAuditLog?: () => void
  onViewLenders?: () => void
  onViewRepayments?: () => void
  onDeactivateBorrower?: () => void
  onCancelLoan?: () => void
  onViewNotifications?: () => void
}

export function AdminLoanCard({
  loan,
  onClick,
  onViewAuditLog,
  onViewLenders,
  onViewRepayments,
  onDeactivateBorrower,
  onCancelLoan,
  onViewNotifications,
}: AdminLoanCardProps) {
  const showNoLendersWarning = (loan.accepted_lenders_count ?? 0) === 0
  const showInactiveBorrowerWarning = loan.borrower.is_active === false

  return (
    <Card
      className="p-6 cursor-pointer transition-shadow duration-200 hover:shadow-lg"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }}
      aria-label={`Admin loan card: ${loan.loan_name}, ${formatCurrency(loan.principal_amount)}, ${loan.status}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">{loan.loan_name}</h3>
            <span className="text-xs font-mono text-gray-500">#{loan.id.slice(0, 8)}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <StatusBadge type="loan" status={loan.status} size="sm" />
            {showNoLendersWarning && (
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs px-2 py-0.5 rounded-full border-0">
                <AlertTriangle className="w-3 h-3 mr-1" />
                No lenders
              </Badge>
            )}
            {showInactiveBorrowerWarning && (
              <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs px-2 py-0.5 rounded-full border-0">
                <UserX className="w-3 h-3 mr-1" />
                Inactive borrower
              </Badge>
            )}
            {loan.deleted_at && (
              <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 text-xs px-2 py-0.5 rounded-full border-0">
                Soft Deleted
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Borrower Info */}
      <div className="mb-4 pb-4 border-b border-gray-100">
        <button
          onClick={(e) => {
            e.stopPropagation()
            // Navigate to user detail
          }}
          className="text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          <div className="font-medium text-primary">{loan.borrower.full_name}</div>
          <div className="text-gray-600">{loan.borrower.email}</div>
        </button>
      </div>

      {/* Body - 3 Columns */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {/* Column 1: Loan Details */}
        <div className="space-y-3">
          <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Loan Details</div>
          <div>
            <div className="text-xs text-gray-600">Principal</div>
            <div className="text-lg font-bold text-gray-900">{formatCurrency(loan.principal_amount)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Interest</div>
            <div className="text-sm font-medium text-gray-900">{(loan.interest_rate * 100).toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Term</div>
            <div className="text-sm font-medium text-gray-900">{loan.term_months} months</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Created</div>
            <div className="text-sm font-medium text-gray-900">{formatDate(loan.created_at)}</div>
          </div>
        </div>

        {/* Column 2: Lender Stats */}
        <div className="space-y-3">
          <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Lender Stats</div>
          <div>
            <div className="text-xs text-gray-600">Accepted</div>
            <div className="text-sm font-medium text-gray-900">{loan.accepted_lenders_count ?? 0}</div>
          </div>
          <div className="text-xs text-gray-500 italic">View all lenders for detailed breakdown</div>
        </div>

        {/* Column 3: Financial */}
        <div className="space-y-3">
          <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Financial</div>
          <div>
            <div className="text-xs text-gray-600">Total Funded</div>
            <div className="text-sm font-medium text-gray-900">{formatCurrency(loan.total_funded_amount ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Total Repaid</div>
            <div className="text-sm font-medium text-green-600">{formatCurrency(loan.total_repaid_amount ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Remaining</div>
            <div className="text-sm font-medium text-gray-900">
              {formatCurrency((loan.total_funded_amount ?? 0) - (loan.total_repaid_amount ?? 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Admin Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
        <Button
          onClick={(e) => {
            e.stopPropagation()
            onViewAuditLog?.()
          }}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          <FileText className="w-3 h-3 mr-1.5" />
          Audit Log
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation()
            onViewLenders?.()
          }}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          <Users className="w-3 h-3 mr-1.5" />
          All Lenders
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation()
            onViewRepayments?.()
          }}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          <DollarSign className="w-3 h-3 mr-1.5" />
          Repayments
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button onClick={(e) => e.stopPropagation()} variant="outline" size="sm" className="text-xs ml-auto">
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDeactivateBorrower?.()
              }}
            >
              Deactivate Borrower
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onCancelLoan?.()
              }}
              className="text-red-600"
            >
              Cancel Loan
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onViewNotifications?.()
              }}
            >
              View Notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}
