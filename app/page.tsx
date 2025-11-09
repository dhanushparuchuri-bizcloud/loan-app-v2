"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { GoogleSignInButton } from "@/components/google-sign-in-button"
import { useAuth } from "@/lib/use-auth"

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    console.log("[Login] Checking auth status...")
    // If already authenticated, redirect to dashboard
    if (isAuthenticated) {
      console.log("[Login] User authenticated, redirecting to dashboard")
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  const handleGoogleSignIn = () => {
    console.log("[Login] Initiating Google sign-in...")
    const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
    const redirectUri =
      window.location.hostname === "localhost"
        ? "http://localhost:3000/callback"
        : "https://app.ubertejas.vc/callback"

    console.log("[Login] Cognito domain:", cognitoDomain)
    console.log("[Login] Client ID:", clientId)
    console.log("[Login] Redirect URI:", redirectUri)

    // Redirect to Cognito Hosted UI for Google OAuth
    const authUrl =
      `https://${cognitoDomain}/oauth2/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `scope=email+openid+profile&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `identity_provider=Google`

    console.log("[Login] Redirecting to:", authUrl)
    window.location.href = authUrl
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-card rounded-xl shadow-lg p-12">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="flex flex-col items-center justify-center mb-2">
              <div className="relative w-24 h-24 mb-3">
                <Image
                  src="/ubertejas-logo.jpg"
                  alt="UbertejaS Ventures Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold text-foreground">UbertejaS Ventures</h1>
            </div>
            <p className="text-sm text-muted-foreground">Multi-Lender Marketplace</p>
          </div>

          {/* Google SSO Button */}
          <GoogleSignInButton onClick={handleGoogleSignIn} isLoading={false} />
        </div>
      </div>
    </div>
  )
}
