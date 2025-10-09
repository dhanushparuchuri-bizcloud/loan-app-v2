"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function HomePage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.push("/dashboard/borrower")
    } else {
      router.push("/login")
    }
  }, [user, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse">
        <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
          <img 
            src="/ubertejas-ventures-logo.jpg" 
            alt="UbertejasVC Logo" 
            className="w-20 h-20 object-contain"
          />
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
