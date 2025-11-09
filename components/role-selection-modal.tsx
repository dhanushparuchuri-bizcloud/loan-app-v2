"use client"

import { Shield, User, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { UserRole } from "@/lib/types"

interface RoleSelectionModalProps {
  roles: UserRole[]
  primaryRole: UserRole
  onSelect: (role: UserRole) => void
}

const roleConfig = {
  admin: {
    icon: Shield,
    label: "Admin",
    description: "Manage users, view all loans, and oversee the platform",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30"
  },
  borrower: {
    icon: User,
    label: "Borrower",
    description: "Create loans, invite lenders, and manage repayments",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30"
  },
  lender: {
    icon: Briefcase,
    label: "Lender",
    description: "View loan invitations, invest, and track repayments",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30"
  }
}

export function RoleSelectionModal({ roles, primaryRole, onSelect }: RoleSelectionModalProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome!</h1>
          <p className="text-muted-foreground text-lg">
            You have access to multiple roles. Please select how you'd like to continue.
          </p>
        </div>

        <div className={`grid gap-6 ${roles.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {roles.map((role) => {
            const config = roleConfig[role]
            const Icon = config.icon
            const isPrimary = role === primaryRole

            return (
              <Card
                key={role}
                className="cursor-pointer hover:border-primary transition-all hover:shadow-lg relative overflow-hidden group"
                onClick={() => onSelect(role)}
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-full ${config.bgColor} ${config.color} transition-transform group-hover:scale-110`}>
                      <Icon className="h-10 w-10" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <h3 className="text-xl font-semibold">{config.label}</h3>
                        {isPrimary && (
                          <Badge variant="secondary" className="text-xs">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground min-h-[40px]">
                        {config.description}
                      </p>
                    </div>
                    <Button className="w-full mt-2">
                      Continue as {config.label}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          You can switch roles anytime from the header menu.
        </p>
      </div>
    </div>
  )
}
