import { Card } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  subtext?: string
  variant?: "default" | "warning"
  className?: string
}

export function StatCard({ label, value, icon: Icon, subtext, variant = "default", className }: StatCardProps) {
  return (
    <Card className={cn("p-6 border border-gray-200 shadow-sm", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-5 h-5 text-gray-600" />
            <p className="text-sm font-medium text-gray-600">{label}</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {variant === "warning" && typeof value === "number" && value > 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                Action needed
              </span>
            )}
          </div>
          {subtext && <p className="text-sm text-gray-600 mt-1">{subtext}</p>}
        </div>
      </div>
    </Card>
  )
}
