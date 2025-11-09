import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Clock, Check, X, Pencil, CheckCircle, XCircle, PieChart, Hourglass, Ban, type LucideIcon } from "lucide-react"
import { CheckCheck } from "lucide-react"

interface StatusBadgeProps {
  type: "loan" | "invitation" | "repayment"
  status: string
  size?: "sm" | "md"
  showIcon?: boolean
}

interface StatusConfig {
  label: string
  colorClass: string
  icon: LucideIcon
  tooltip?: string
}

function getStatusConfig(type: "loan" | "invitation" | "repayment", status: string): StatusConfig | null {
  const configs: Record<string, Record<string, StatusConfig>> = {
    loan: {
      draft: {
        label: "Draft",
        colorClass: "bg-gray-100 text-gray-700 hover:bg-gray-100",
        icon: Pencil,
        tooltip: "Loan is being created",
      },
      pending: {
        label: "Pending",
        colorClass: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
        icon: Clock,
        tooltip: "Waiting for lenders to accept invitations",
      },
      active: {
        label: "Active",
        colorClass: "bg-blue-100 text-blue-700 hover:bg-blue-100",
        icon: CheckCircle,
        tooltip: "Loan is active and accepting repayments",
      },
      partially_completed: {
        label: "Partially Paid",
        colorClass: "bg-orange-100 text-orange-700 hover:bg-orange-100",
        icon: PieChart,
        tooltip:
          "All participating lenders have been fully repaid, but the original loan amount was not fully funded by lenders.",
      },
      completed: {
        label: "Completed",
        colorClass: "bg-green-100 text-green-700 hover:bg-green-100",
        icon: CheckCheck,
        tooltip: "Loan fully repaid",
      },
      cancelled: {
        label: "Cancelled",
        colorClass: "bg-red-100 text-red-700 hover:bg-red-100",
        icon: XCircle,
        tooltip: "Loan was cancelled",
      },
    },
    invitation: {
      pending: {
        label: "Pending",
        colorClass: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
        icon: Hourglass,
      },
      accepted: {
        label: "Accepted",
        colorClass: "bg-green-100 text-green-700 hover:bg-green-100",
        icon: Check,
      },
      declined: {
        label: "Declined",
        colorClass: "bg-red-100 text-red-700 hover:bg-red-100",
        icon: X,
      },
      revoked: {
        label: "Revoked",
        colorClass: "bg-gray-100 text-gray-700 hover:bg-gray-100",
        icon: Ban,
      },
    },
    repayment: {
      pending: {
        label: "Awaiting Approval",
        colorClass: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
        icon: Clock,
      },
      approved: {
        label: "Approved",
        colorClass: "bg-green-100 text-green-700 hover:bg-green-100",
        icon: CheckCircle,
      },
      rejected: {
        label: "Rejected",
        colorClass: "bg-red-100 text-red-700 hover:bg-red-100",
        icon: XCircle,
      },
    },
  }

  const config = configs[type]?.[status]

  if (!config) {
    console.warn(`Unknown ${type} status:`, status)
    return null
  }

  return config
}

export function StatusBadge({ type, status, size = "md", showIcon = true }: StatusBadgeProps) {
  const config = getStatusConfig(type, status)

  if (!config) {
    return (
      <Badge variant="secondary" className="font-medium tracking-wide">
        Unknown
      </Badge>
    )
  }

  const Icon = config.icon
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4"
  const iconMargin = size === "sm" ? "mr-1" : "mr-1.5"

  const badge = (
    <Badge
      className={`${config.colorClass} ${sizeClasses} font-medium tracking-wide rounded-full inline-flex items-center border-0`}
      role="status"
      aria-label={`${type} status: ${config.label}`}
    >
      {showIcon && <Icon className={`${iconSize} ${iconMargin}`} />}
      {config.label}
    </Badge>
  )

  if (config.tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{config.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
