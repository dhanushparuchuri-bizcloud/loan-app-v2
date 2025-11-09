"use client"

import { useState } from "react"
import { Check, ChevronDown, Shield, User, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@/lib/user-context"
import type { UserRole } from "@/lib/types"
import { useRouter, usePathname } from "next/navigation"

const roleIcons = {
  admin: Shield,
  borrower: User,
  lender: Briefcase,
}

const roleLabels = {
  admin: "Admin",
  borrower: "Borrower",
  lender: "Lender",
}

export function RoleSwitcher() {
  const { userRoles, activeRole, setActiveRole } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  if (!userRoles || userRoles.available_roles.length <= 1) {
    return null
  }

  const CurrentIcon = roleIcons[activeRole]
  const isPrimaryRole = activeRole === userRoles.primary_role

  const handleRoleSwitch = async (role: UserRole) => {
    console.log('[RoleSwitcher] 🎯 handleRoleSwitch called with:', {
      newRole: role,
      currentRole: activeRole,
      currentPathname: pathname,
      startsWithDashboard: pathname.startsWith('/dashboard')
    })

    // Prevent switching if already in progress
    if (isSwitching) {
      console.log('[RoleSwitcher] ⚠️  Already switching roles, ignoring click')
      return
    }

    // Don't switch if already on this role
    if (role === activeRole) {
      console.log('[RoleSwitcher] ℹ️  Already on role:', role)
      setIsOpen(false)
      return
    }

    setIsSwitching(true)
    console.log('[RoleSwitcher] 🔄 Starting role switch from', activeRole, 'to', role)

    // Update the active role - this triggers cache invalidation in UserContext
    setActiveRole(role)
    setIsOpen(false)

    // Wait a brief moment for cache invalidation to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Only navigate to dashboard if we're ALREADY on a dashboard page
    // This keeps users on their current page (like loan details) when switching roles
    if (!pathname.startsWith('/dashboard')) {
      console.log('[RoleSwitcher] ✋ Role changed to', role, 'but staying on:', pathname, '(not a dashboard page)')
      console.log('[RoleSwitcher] 📄 Page will refetch data with new role automatically')
      setIsSwitching(false)
      return  // Don't navigate - just update the role
    }

    console.log('[RoleSwitcher] ✅ On dashboard page, navigating to new role dashboard...')

    // Navigate to appropriate dashboard for the new role
    // Use replace() instead of push() to avoid intermediate /dashboard rendering
    if (role === 'admin') {
      console.log('[RoleSwitcher] 🔄 Replacing route with /dashboard/admin')
      router.replace('/dashboard/admin')
    } else if (role === 'borrower') {
      console.log('[RoleSwitcher] 🔄 Replacing route with /dashboard/borrower')
      router.replace('/dashboard/borrower')
    } else if (role === 'lender') {
      console.log('[RoleSwitcher] 🔄 Replacing route with /dashboard/lender')
      router.replace('/dashboard/lender')
    } else {
      // Fallback to main dashboard router
      console.log('[RoleSwitcher] 🔄 Replacing route with /dashboard (fallback)')
      router.replace('/dashboard')
    }

    // Reset switching state after navigation
    setTimeout(() => setIsSwitching(false), 500)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 hover:bg-secondary"
          aria-label="Switch role"
          disabled={isSwitching}
        >
          <CurrentIcon className="h-4 w-4" />
          <span>{isSwitching ? "Switching..." : roleLabels[activeRole]}</span>
          {!isSwitching && isPrimaryRole && (
            <Badge variant="secondary" className="text-xs">
              Primary
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {userRoles.available_roles.map((role, index) => {
          const Icon = roleIcons[role]
          const isActive = role === activeRole
          const isPrimary = role === userRoles.primary_role
          const showSeparator = index === 0 && userRoles.available_roles.length > 1 && isPrimary

          return (
            <div key={role}>
              <DropdownMenuItem onClick={() => handleRoleSwitch(role)} className={isActive ? "bg-primary/10" : ""}>
                <div className="flex items-center gap-2 flex-1">
                  {isActive && <Check className="h-4 w-4" />}
                  {!isActive && <div className="w-4" />}
                  <Icon className="h-4 w-4" />
                  <span>{roleLabels[role]}</span>
                  {isPrimary && (
                    <Badge variant="outline" className="text-xs ml-auto">
                      Primary
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
              {showSeparator && <DropdownMenuSeparator />}
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
