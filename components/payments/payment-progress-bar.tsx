import { Progress } from "@/components/ui/progress"

interface PaymentProgressBarProps {
  totalPaid: number
  totalAmount: number
  showLabels?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function PaymentProgressBar({
  totalPaid,
  totalAmount,
  showLabels = true,
  size = 'md'
}: PaymentProgressBarProps) {
  const percentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0
  const remaining = totalAmount - totalPaid

  // Height based on size
  const heightClass = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3'

  // Color based on progress
  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-green-500'
    if (percentage >= 75) return 'bg-blue-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-orange-500'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-2">
      {showLabels && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Paid: <span className="font-semibold text-foreground">{formatCurrency(totalPaid)}</span>
          </span>
          <span className="text-muted-foreground">
            Remaining: <span className="font-semibold text-foreground">{formatCurrency(remaining)}</span>
          </span>
        </div>
      )}
      <div className="relative">
        <Progress
          value={percentage}
          className={heightClass}
          indicatorClassName={getProgressColor()}
        />
        {showLabels && (
          <span className="absolute left-1/2 -translate-x-1/2 -top-1 text-xs font-medium">
            {percentage.toFixed(0)}%
          </span>
        )}
      </div>
      {showLabels && percentage >= 100 && (
        <p className="text-xs text-green-600 dark:text-green-400 font-medium text-center">
          ✓ Fully paid!
        </p>
      )}
    </div>
  )
}
