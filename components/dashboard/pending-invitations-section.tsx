"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"
import { toNumber } from "@/lib/type-utils"
import { ArrowRight, Mail } from "lucide-react"
import type { LenderLoanPortfolio } from "@/lib/types"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface PendingInvitationsSectionProps {
  invitations: LenderLoanPortfolio[]
}

export function PendingInvitationsSection({ invitations }: PendingInvitationsSectionProps) {
  const router = useRouter()
  const displayInvitations = invitations.slice(0, 3)
  const hasMore = invitations.length > 3

  if (invitations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Pending Invitations</h3>
        <p className="text-sm text-gray-600">All caught up! You'll see new invitations here.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {displayInvitations.map((invitation) => {
        const initials = invitation.borrower_name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()

        return (
          <Card key={invitation.loan_lender_id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{invitation.loan_name}</h3>
                  <p className="text-sm text-gray-600">From: {invitation.borrower_name}</p>
                </div>
              </div>
              <StatusBadge type="invitation" status={invitation.invitation_status} size="sm" />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100">
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">Amount</div>
                <div className="text-sm font-medium text-gray-900">{formatCurrency(invitation.allocated_amount)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">Interest Rate</div>
                <div className="text-sm font-medium text-gray-900">{(toNumber(invitation.interest_rate) * 100).toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">Term</div>
                <div className="text-sm font-medium text-gray-900">{invitation.term_months} months</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Invited {invitation.invited_at ? formatRelativeTime(invitation.invited_at) : "recently"}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => router.push(`/invitations/${invitation.loan_lender_id}`)}
                  variant="outline"
                  size="sm"
                >
                  View
                </Button>
                <Button
                  onClick={() => router.push(`/invitations/${invitation.loan_lender_id}`)}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Accept
                </Button>
                <Button
                  onClick={() => router.push(`/invitations/${invitation.loan_lender_id}`)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Decline
                </Button>
              </div>
            </div>
          </Card>
        )
      })}

      {hasMore && (
        <div className="text-center">
          <Link href="/invitations">
            <Button variant="outline" className="gap-2 bg-transparent">
              View All Invitations ({invitations.length})
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
