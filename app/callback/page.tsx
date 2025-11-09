"use client"

import { Suspense, useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/use-auth"
import { useUser } from "@/lib/user-context"
import { RoleSelectionModal } from "@/components/role-selection-modal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import type { UserRole } from "@/lib/types"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, isAuthenticated } = useAuth()
  const { user, userRoles, setActiveRole, isLoading: userLoading } = useUser()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [tokensExchanged, setTokensExchanged] = useState(false)
  const [showRoleSelector, setShowRoleSelector] = useState(false)
  const hasProcessed = useRef(false)
  const hasRoutedRef = useRef(false)

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (hasProcessed.current || isProcessing) {
      console.log("[Callback] Already processed or processing, skipping...")
      return
    }

    const handleCallback = async () => {
      // Mark as processing immediately
      if (isProcessing) return
      setIsProcessing(true)
      hasProcessed.current = true

      console.log("[Callback] Starting callback handler...")
      const code = searchParams.get("code")
      const errorParam = searchParams.get("error")

      if (errorParam) {
        console.error("[Callback] Error from Cognito:", errorParam)
        setError(`Authentication failed: ${errorParam}`)
        setTimeout(() => router.push("/"), 3000)
        return
      }

      if (!code) {
        console.error("[Callback] No authorization code received")
        setError("No authorization code received")
        setTimeout(() => router.push("/"), 3000)
        return
      }

      // Check if we already have a token (user refreshed the page)
      const existingToken = localStorage.getItem("cognito_id_token")
      if (existingToken) {
        console.log("[Callback] Token already exists, redirecting to dashboard...")
        router.push("/dashboard")
        return
      }

      // Check if this code was already used
      const usedCode = sessionStorage.getItem("used_auth_code")
      if (usedCode === code) {
        console.log("[Callback] Code already used, redirecting to dashboard...")
        router.push("/dashboard")
        return
      }

      console.log("[Callback] Got authorization code:", code.substring(0, 10) + "...")

      try {
        // Exchange authorization code for tokens
        const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN
        const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
        const redirectUri =
          window.location.hostname === "localhost"
            ? "http://localhost:3000/callback"
            : "https://app.ubertejas.vc/callback"

        console.log("[Callback] Exchanging code for tokens...")
        console.log("[Callback] Cognito domain:", cognitoDomain)
        console.log("[Callback] Client ID:", clientId)
        console.log("[Callback] Redirect URI:", redirectUri)

        const tokenResponse = await fetch(`https://${cognitoDomain}/oauth2/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId!,
            code: code,
            redirect_uri: redirectUri,
          }),
        })

        console.log("[Callback] Token response status:", tokenResponse.status)

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json()
          console.error("[Callback] Token exchange failed:", errorData)

          // If code already used, check if we have a token and redirect
          if (errorData.error === "invalid_grant") {
            const token = localStorage.getItem("cognito_id_token")
            if (token) {
              console.log("[Callback] Code was already used but we have token, redirecting...")
              router.push("/dashboard")
              return
            }
          }

          throw new Error("Failed to exchange code for tokens")
        }

        const tokens = await tokenResponse.json()
        console.log("[Callback] Tokens received:", {
          hasIdToken: !!tokens.id_token,
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
        })

        // Mark code as used
        sessionStorage.setItem("used_auth_code", code)

        // Store token and extract user email
        login(tokens.id_token)

        console.log("[Callback] Login successful, waiting for role data...")
        // Mark that tokens have been exchanged
        setTokensExchanged(true)
      } catch (err) {
        console.error("[Callback] Error:", err)
        setError(err instanceof Error ? err.message : "Authentication failed")
        setTimeout(() => router.push("/"), 3000)
      }
    }

    handleCallback()
  }, [searchParams, login, router, isProcessing])

  // Handle role-based routing after successful authentication
  useEffect(() => {
    if (!tokensExchanged || !isAuthenticated) {
      return
    }

    if (hasRoutedRef.current) {
      console.log("[Callback] Already routed, skipping...")
      return
    }

    // Wait for user context to load roles
    if (userLoading) {
      console.log("[Callback] Waiting for user roles to load...")
      return
    }

    console.log("[Callback] User roles loaded:", userRoles)

    // Check if user has any roles
    if (!user || !userRoles || !userRoles.available_roles || userRoles.available_roles.length === 0) {
      console.log("[Callback] User has no roles, redirecting to dashboard (access denied)")
      hasRoutedRef.current = true
      router.push("/dashboard")
      return
    }

    const availableRoles = userRoles.available_roles
    const numRoles = availableRoles.length

    console.log("[Callback] User has", numRoles, "role(s):", availableRoles)

    // Check for stored preferred role
    const preferredRole = localStorage.getItem('preferredRole') as UserRole | null

    if (numRoles === 1) {
      // Single role - route directly
      const role = availableRoles[0]
      console.log("[Callback] Single role detected, routing to:", role)
      setActiveRole(role)
      hasRoutedRef.current = true
      router.push(`/dashboard/${role}`)
    } else if (preferredRole && availableRoles.includes(preferredRole)) {
      // User has preference and it's valid
      console.log("[Callback] Using preferred role:", preferredRole)
      setActiveRole(preferredRole)
      hasRoutedRef.current = true
      router.push(`/dashboard/${preferredRole}`)
    } else {
      // Multiple roles, no preference - show selector
      console.log("[Callback] Multiple roles, showing selector")
      setShowRoleSelector(true)
    }
  }, [tokensExchanged, isAuthenticated, userLoading, user, userRoles, router, setActiveRole])

  // Handle role selection
  const handleRoleSelect = (role: UserRole) => {
    console.log("[Callback] User selected role:", role)
    setActiveRole(role)
    localStorage.setItem('preferredRole', role)
    setShowRoleSelector(false)
    hasRoutedRef.current = true
    router.push(`/dashboard/${role}`)
  }

  if (showRoleSelector && userRoles) {
    return (
      <RoleSelectionModal
        roles={userRoles.available_roles}
        primaryRole={userRoles.primary_role}
        onSelect={handleRoleSelect}
      />
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[400px]">
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900">{error}</AlertDescription>
          </Alert>
          <p className="text-center text-sm text-muted-foreground mt-4">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg font-medium">Completing sign-in...</p>
        <p className="text-sm text-muted-foreground mt-2">Please wait</p>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg font-medium">Completing sign-in...</p>
            <p className="text-sm text-muted-foreground mt-2">Please wait</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
