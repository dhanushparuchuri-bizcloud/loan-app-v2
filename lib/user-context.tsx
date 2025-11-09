"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User, UserRole, UserRolesData } from "./types"
import { useAuth } from "./use-auth"
import { fetchUserRoles } from "./api"
import { useSWRConfig } from "swr"

interface UserContextType {
  user: User | null
  userRoles: UserRolesData | null
  activeRole: UserRole
  setActiveRole: (role: UserRole) => void
  setUser: (user: User | null) => void
  setUserRoles: (roles: UserRolesData | null) => void
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const { userEmail, isAuthenticated, isLoading: authLoading } = useAuth()
  const { mutate } = useSWRConfig()
  const [user, setUser] = useState<User | null>(null)
  const [userRoles, setUserRoles] = useState<UserRolesData | null>(null)
  const [activeRole, setActiveRole] = useState<UserRole>("borrower")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadUserData = async () => {
      console.log("[UserContext] Loading user data...")
      console.log("[UserContext] Auth loading:", authLoading, "Authenticated:", isAuthenticated, "Email:", userEmail)
      console.log("[UserContext] useEffect triggered. Dependencies:", { userEmail, isAuthenticated, authLoading })

      if (!authLoading && isAuthenticated && userEmail) {
        setIsLoading(true)
        try {
          console.log("[UserContext] Fetching user roles for:", userEmail)
          console.log("[UserContext] Calling fetchUserRoles WITHOUT role parameter (backend will use primary_role)")

          // Fetch user roles without specifying a role - let backend default to primary_role
          // Backend will automatically use the user's actual primary_role from database
          const result = await fetchUserRoles(userEmail)

          console.log("[UserContext] fetchUserRoles result:", result)

          if (result.data) {
            console.log("[UserContext] User roles fetched:", result.data)

            // Check if user has a valid primary_role
            if (!result.data.primary_role || !result.data.available_roles || result.data.available_roles.length === 0) {
              console.error("[UserContext] User has no roles assigned")
              setUser(null)
              setUserRoles(null)
              setIsLoading(false)
              return
            }

            // CRITICAL FIX: Fetch actual user UUID from users table
            // This is required because loan creation needs borrower_id as UUID, not email
            console.log("[UserContext] Fetching user profile to get UUID...")

            const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.ubertejas.vc"
            const userProfileResponse = await fetch(
              `${API_URL}/users?email=eq.${encodeURIComponent(userEmail)}&select=id,full_name,is_active`,
              {
                headers: {
                  "X-User-Email": userEmail,
                  "X-Active-Role": result.data.primary_role,
                  "Content-Type": "application/json",
                },
              }
            )

            if (!userProfileResponse.ok) {
              throw new Error(`Failed to fetch user profile: ${userProfileResponse.status}`)
            }

            const userProfiles = await userProfileResponse.json()
            console.log("[UserContext] User profile response:", userProfiles)

            if (!userProfiles || userProfiles.length === 0) {
              console.error("[UserContext] User profile not found in database")
              setUser(null)
              setUserRoles(null)
              setIsLoading(false)
              return
            }

            const userProfile = userProfiles[0]

            setUserRoles(result.data)
            setUser({
              id: userProfile.id, // ✅ FIXED: Use actual UUID from database
              email: userEmail,
              full_name: userProfile.full_name || userEmail.split("@")[0],
              primary_role: result.data.primary_role,
              is_active: userProfile.is_active ?? true,
            })

            console.log("[UserContext] User set with UUID:", userProfile.id)

            // Set active role to the primary_role from the response
            // This is the user's actual role (admin, borrower, or lender)
            console.log("[UserContext] Setting active role to primary_role:", result.data.primary_role)
            setActiveRole(result.data.primary_role)
          } else {
            console.error("[UserContext] Failed to fetch user roles:", result.error)
            setUser(null)
            setUserRoles(null)
          }
        } catch (error) {
          console.error("[UserContext] Error loading user data:", error)
          setUser(null)
          setUserRoles(null)
        } finally {
          setIsLoading(false)
        }
      } else if (!authLoading) {
        // Auth finished but not authenticated
        console.log("[UserContext] Not authenticated")
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [userEmail, isAuthenticated, authLoading])

  // CRITICAL: Invalidate ALL SWR cache when active role changes
  // This ensures no stale data from previous role is shown
  useEffect(() => {
    console.log("[UserContext] 🔄 Active role changed to:", activeRole)
    console.log("[UserContext] 🗑️  Clearing ALL SWR cache to prevent stale data from previous role")

    // Clear all SWR cache entries
    // revalidate: false means don't refetch immediately, let components refetch on their own
    mutate(
      () => true, // Match all cache keys
      undefined,  // Clear the data
      { revalidate: false } // Don't auto-refetch, components will refetch when they mount/update
    )

    console.log("[UserContext] ✅ SWR cache cleared successfully")
  }, [activeRole, mutate])

  return (
    <UserContext.Provider
      value={{
        user,
        userRoles,
        activeRole,
        setActiveRole,
        setUser,
        setUserRoles,
        isLoading,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
