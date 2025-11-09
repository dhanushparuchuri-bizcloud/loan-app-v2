"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser } from "@/lib/user-context"
import { useAuth } from "@/lib/use-auth"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { activeRole, isLoading, user } = useUser()
  const { logout } = useAuth()

  useEffect(() => {
    console.log("[Dashboard] useEffect triggered with:", {
      pathname,
      activeRole,
      isLoading,
      hasUser: !!user
    })

    // ONLY redirect if we're on the exact /dashboard route
    // Don't redirect if we're on nested routes like /loans/[id] or /dashboard/admin, etc.
    if (pathname !== "/dashboard") {
      console.log("[Dashboard] ❌ NOT redirecting - pathname is:", pathname)
      return
    }

    console.log("[Dashboard] ✅ Pathname is /dashboard, checking if we should redirect...")

    // Don't redirect if we're still loading
    if (isLoading) {
      console.log("[Dashboard] ⏳ Still loading, not redirecting yet")
      return
    }

    // Check if user has no role assigned
    if (!user || !activeRole) {
      console.log("[Dashboard] User has no role, showing access denied")
      return
    }

    console.log("[Dashboard] 🔄 Redirecting to role-specific dashboard:", activeRole)

    // Use replace() instead of push() to avoid history pollution
    // This also prevents the intermediate /dashboard render
    if (activeRole === "borrower") {
      router.replace("/dashboard/borrower")
    } else if (activeRole === "lender") {
      router.replace("/dashboard/lender")
    } else if (activeRole === "admin") {
      router.replace("/dashboard/admin")
    }
  }, [pathname, activeRole, isLoading, user, router])

  // Show access denied if user has no role
  if (!isLoading && (!user || !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-yellow-200 dark:border-yellow-900">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-yellow-50 dark:bg-yellow-950/30 p-3">
                <AlertCircle className="h-10 w-10 text-yellow-600 dark:text-yellow-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Access Not Available</h1>
                <p className="text-muted-foreground">
                  We appreciate your interest! However, your account doesn't have access to this application at the moment.
                </p>
                <p className="text-sm text-muted-foreground pt-2">
                  This may be because your account hasn't been set up yet, or you need to be assigned a role by an administrator.
                </p>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground pt-2 bg-secondary/50 p-4 rounded-lg w-full">
                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-left">
                  Need help? Please reach out to us at{" "}
                  <a
                    href="mailto:support@bizcloudexperts.com"
                    className="text-primary hover:underline font-medium"
                  >
                    support@bizcloudexperts.com
                  </a>
                  {" "}and we'll be happy to assist you.
                </p>
              </div>
              <Button onClick={() => logout()} variant="outline" className="w-full mt-4">
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading state while checking roles and redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <div>
          <p className="text-lg font-medium">Loading your dashboard...</p>
          <p className="text-sm text-muted-foreground mt-1">Please wait a moment</p>
        </div>
      </div>
    </div>
  )
}
