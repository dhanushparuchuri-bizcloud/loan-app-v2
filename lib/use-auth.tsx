"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { jwtDecode } from "jwt-decode"

interface CognitoIdToken {
  sub: string
  email: string
  email_verified: boolean
  "cognito:username": string
  aud: string
  token_use: string
  auth_time: number
  iss: string
  exp: number
  iat: number
}

interface AuthContextType {
  userEmail: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (idToken: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    console.log("[Auth] Checking for stored token...")
    const storedToken = localStorage.getItem("cognito_id_token")

    if (storedToken) {
      try {
        const decoded = jwtDecode<CognitoIdToken>(storedToken)
        console.log("[Auth] Token decoded:", {
          email: decoded.email,
          exp: new Date(decoded.exp * 1000).toISOString(),
          isExpired: decoded.exp * 1000 <= Date.now(),
        })

        // Check if token is expired
        if (decoded.exp * 1000 > Date.now()) {
          console.log("[Auth] Token valid, setting user email:", decoded.email)
          setUserEmail(decoded.email)
        } else {
          console.log("[Auth] Token expired, clearing storage")
          localStorage.removeItem("cognito_id_token")
        }
      } catch (error) {
        console.error("[Auth] Failed to decode token:", error)
        localStorage.removeItem("cognito_id_token")
      }
    } else {
      console.log("[Auth] No stored token found")
    }

    setIsLoading(false)
  }, [])

  const login = (idToken: string) => {
    try {
      console.log("[Auth] Logging in with token...")
      const decoded = jwtDecode<CognitoIdToken>(idToken)
      console.log("[Auth] Token decoded:", {
        email: decoded.email,
        email_verified: decoded.email_verified,
        exp: new Date(decoded.exp * 1000).toISOString(),
      })

      if (!decoded.email_verified) {
        console.error("[Auth] Email not verified!")
        throw new Error("Email not verified")
      }

      setUserEmail(decoded.email)
      localStorage.setItem("cognito_id_token", idToken)
      console.log("[Auth] Login successful, email:", decoded.email)
    } catch (error) {
      console.error("[Auth] Login failed:", error)
      throw error
    }
  }

  const logout = () => {
    console.log("[Auth] Logging out...")
    setUserEmail(null)

    // Clear all auth-related storage
    localStorage.removeItem("cognito_id_token")
    sessionStorage.removeItem("used_auth_code")

    console.log("[Auth] Cleared local storage and session storage")

    // Redirect to Cognito logout URL
    // AWS Cognito /logout endpoint requires either logout_uri OR redirect_uri (not both)
    // Using logout_uri (simpler) - just redirects to URL after clearing Cognito session
    const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
    const logoutUri = window.location.origin

    if (cognitoDomain && clientId) {
      // Only use logout_uri and client_id (AWS Cognito Hosted UI logout endpoint)
      const logoutUrl = `https://${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`
      console.log("[Auth] Redirecting to Cognito logout:", logoutUrl)
      window.location.href = logoutUrl
    } else {
      console.log("[Auth] Missing Cognito config, redirecting to home")
      // Fallback: just redirect to home
      window.location.href = "/"
    }
  }

  return (
    <AuthContext.Provider
      value={{
        userEmail,
        isLoading,
        isAuthenticated: !!userEmail,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
