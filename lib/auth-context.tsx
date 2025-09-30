"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { apiClient, type User } from "./api-client"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string) => Promise<boolean>
  logout: () => void
  updateUser: (updatedUser: User) => void
  activateInvitation: (token: string) => Promise<boolean>
  isLoading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check for stored user and token on mount
    const storedUser = localStorage.getItem("user")
    const storedToken = localStorage.getItem("auth_token")
    
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        apiClient.setToken(storedToken)
        
        // Verify token is still valid by fetching profile
        apiClient.getProfile()
          .then((response) => {
            if (response.success && response.data) {
              setUser(response.data)
              localStorage.setItem("user", JSON.stringify(response.data))
            } else {
              // Token is invalid, clear auth
              logout()
            }
          })
          .catch(() => {
            // Token is invalid, clear auth
            logout()
          })
          .finally(() => {
            setIsLoading(false)
          })
      } catch (error) {
        console.error('Error parsing stored user:', error)
        logout()
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiClient.login(email, password)
      
      if (response.success && response.data?.user) {
        setUser(response.data.user)
        localStorage.setItem("user", JSON.stringify(response.data.user))
        setIsLoading(false)
        return true
      } else {
        setError(response.message || 'Login failed')
        setIsLoading(false)
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      setError(error instanceof Error ? error.message : 'Login failed')
      setIsLoading(false)
      return false
    }
  }

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiClient.register(name, email, password)
      
      if (response.success && response.user) {
        setUser(response.user)
        localStorage.setItem("user", JSON.stringify(response.user))
        setIsLoading(false)
        return true
      } else {
        setError(response.message || 'Registration failed')
        setIsLoading(false)
        return false
      }
    } catch (error) {
      console.error('Registration error:', error)
      setError(error instanceof Error ? error.message : 'Registration failed')
      setIsLoading(false)
      return false
    }
  }

  const logout = () => {
    setUser(null)
    setError(null)
    localStorage.removeItem("user")
    apiClient.clearToken()
  }

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser)
    localStorage.setItem("user", JSON.stringify(updatedUser))
  }

  const activateInvitation = async (token: string): Promise<boolean> => {
    if (!user) return false

    try {
      // This would be implemented when we have an invitation activation endpoint
      // For now, we'll refresh the user profile to check if lender status changed
      const response = await apiClient.getProfile()
      if (response.success && response.data) {
        updateUser(response.data)
        return response.data.is_lender
      }
      return false
    } catch (error) {
      console.error('Invitation activation error:', error)
      return false
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        updateUser,
        activateInvitation,
        isLoading,
        error,
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
