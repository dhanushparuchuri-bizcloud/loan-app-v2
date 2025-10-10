"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { type Payment } from "@/lib/api-client"
import { Calendar, DollarSign, FileText, Receipt, CheckCircle, XCircle, Clock } from "lucide-react"

interface PaymentHistoryListProps {
  payments: Payment[]
  onPaymentClick?: (payment: Payment) => void
  emptyMessage?: string
  showLenderInfo?: boolean
  lenderName?: string
}

export function PaymentHistoryList({
  payments,
  onPaymentClick,
  emptyMessage = "No payments yet",
  showLenderInfo = false,
  lenderName
}: PaymentHistoryListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900">
            <CheckCircle className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-900">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-3 opacity-20" />
            <p>{emptyMessage}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <Card
          key={payment.payment_id}
          className={`transition-all ${onPaymentClick ? 'cursor-pointer hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900' : ''}`}
          onClick={() => onPaymentClick?.(payment)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              {/* Left side - Payment info */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {formatDate(payment.payment_date)}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>

                {payment.notes && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p className="line-clamp-2">{payment.notes}</p>
                  </div>
                )}

                {payment.rejection_reason && (
                  <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p className="line-clamp-2">{payment.rejection_reason}</p>
                  </div>
                )}

                {payment.approval_notes && (
                  <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p className="line-clamp-2">{payment.approval_notes}</p>
                  </div>
                )}

                {showLenderInfo && lenderName && (
                  <p className="text-xs text-muted-foreground">
                    To: {lenderName}
                  </p>
                )}
              </div>

              {/* Right side - Status and receipt */}
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(payment.status)}
                {payment.receipt_key && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Receipt className="h-3 w-3" />
                    <span>Has receipt</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
