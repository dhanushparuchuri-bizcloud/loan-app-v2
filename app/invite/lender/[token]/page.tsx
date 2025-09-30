"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { Check, Loader2, Users, ArrowRight, Eye } from "lucide-react"

type ActivationStatus = "loading" | "success" | "error"

export default function InvitationActivationPage() {
  const [status, setStatus] = useState<ActivationStatus>("loading")
  const [inviterName, setInviterName] = useState("John Borrower")
  const { user, updateUser } = useAuth()
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  useEffect(() => {
    const activateInvitation = async () => {
      setStatus("loading")

      try {
        // Simulate activation process
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Mock token validation and user update
        if (token && user) {
          // Update user to have lender access
          const updatedUser = { ...user, is_lender: true }
          updateUser(updatedUser)

          setStatus("success")
        } else {
          setStatus("error")
        }
      } catch (error) {
        setStatus("error")
      }
    }

    if (user) {
      activateInvitation()
    }
  }, [token, user, updateUser])

  const handleGoToDashboard = () => {
    router.push("/dashboard/lender")
  }

  const handleViewInvitations = () => {
    router.push("/dashboard/lender")
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/30">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Please log in to activate your invitation</p>
            <Button onClick={() => router.push("/login")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-background to-blue-50 p-4">
      <div className="w-full max-w-lg">
        {/* Loading State */}
        {status === "loading" && (
          <Card className="text-center shadow-lg">
            <CardContent className="pt-12 pb-12">
              <div className="mb-8">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-foreground mb-2">
                Activating your lender access
                <span className="animate-dots"></span>
              </h2>

              <div className="w-64 h-2 bg-muted rounded-full mx-auto mb-4">
                <div className="h-2 bg-gradient-to-r from-primary to-green-500 rounded-full animate-pulse w-3/4"></div>
              </div>

              <p className="text-muted-foreground">Please wait while we set up your lending privileges...</p>
            </CardContent>
          </Card>
        )}

        {/* Success State */}
        {status === "success" && (
          <Card className="text-center shadow-lg animate-fadeIn">
            <CardContent className="pt-12 pb-12">
              {/* Animated Success Checkmark */}
              <div className="mb-8">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 bg-green-100 rounded-full animate-pulse"></div>
                  <div className="absolute inset-2 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <Check className="h-12 w-12 text-white" strokeWidth={3} />
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-foreground mb-2 text-balance">Welcome to the Lending Network!</h1>

              <p className="text-xl text-green-600 font-semibold mb-4">Your lender access has been activated</p>

              <div className="bg-muted/50 rounded-lg p-6 mb-6">
                <p className="text-muted-foreground mb-4 text-balance">
                  You can now review loan opportunities and manage your lending portfolio. Start building your
                  investment portfolio today.
                </p>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Invited by {inviterName}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button onClick={handleGoToDashboard} size="lg" className="w-full">
                  Go to Lender Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <Button onClick={handleViewInvitations} variant="outline" className="w-full bg-transparent">
                  <Eye className="mr-2 h-4 w-4" />
                  View Pending Invitations
                </Button>
              </div>

              {/* Additional Info */}
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
                <ul className="text-sm text-blue-800 space-y-1 text-left">
                  <li>• Review pending loan invitations</li>
                  <li>• Set up your investment preferences</li>
                  <li>• Start earning returns on your investments</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {status === "error" && (
          <Card className="text-center shadow-lg border-red-200">
            <CardContent className="pt-12 pb-12">
              <div className="mb-8">
                <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">!</span>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-foreground mb-2">Activation Failed</h2>

              <p className="text-muted-foreground mb-6">
                We couldn't activate your lender access. The invitation link may be invalid or expired.
              </p>

              <div className="space-y-3">
                <Button onClick={() => setStatus("loading")} className="w-full">
                  <Loader2 className="mr-2 h-4 w-4" />
                  Try Again
                </Button>

                <Button onClick={() => router.push("/dashboard/borrower")} variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
