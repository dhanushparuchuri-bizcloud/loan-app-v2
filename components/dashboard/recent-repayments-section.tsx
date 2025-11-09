"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toNumber } from "@/lib/type-utils"
import { ArrowRight, Receipt } from "lucide-react"
import type { Repayment } from "@/lib/types"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface RecentRepaymentsSectionProps {
  repayments: Repayment[]
}

export function RecentRepaymentsSection({ repayments }: RecentRepaymentsSectionProps) {
  const router = useRouter()
  const displayRepayments = repayments.slice(0, 10)
  const hasMore = repayments.length > 10

  if (repayments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Repayments Yet</h3>
        <p className="text-sm text-gray-600">Repayments will appear here once borrowers submit payments.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {displayRepayments.map((repayment) => (
        <Card key={repayment.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-gray-900">{formatDate(repayment.payment_date)}</span>
                <span className="text-sm text-gray-600">•</span>
                <span className="text-sm text-gray-600">Loan ID: {repayment.loan_id.slice(0, 8)}...</span>
                <StatusBadge type="repayment" status={repayment.status} size="sm" />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total: </span>
                  <span className="font-semibold text-gray-900">{formatCurrency(toNumber(repayment.amount))}</span>
                </div>
                <div>
                  <span className="text-gray-600">Principal: </span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(toNumber(repayment.principal_portion))}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Interest: </span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(toNumber(repayment.interest_portion))}
                  </span>
                </div>
              </div>
            </div>
            {repayment.status === "pending" && (
              <Button
                onClick={() => router.push("/repayments/review")}
                size="sm"
                variant="outline"
                className="gap-2 ml-4"
              >
                Review
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Card>
      ))}

      {hasMore && (
        <div className="text-center pt-2">
          <Link href="/repayments/review">
            <Button variant="outline" className="gap-2 bg-transparent">
              View All Repayments
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
