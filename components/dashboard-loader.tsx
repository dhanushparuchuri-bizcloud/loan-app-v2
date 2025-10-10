"use client"

import Image from "next/image"

interface DashboardLoaderProps {
  type: "borrower" | "lender"
}

export function DashboardLoader({ type }: DashboardLoaderProps) {
  const gradientClass =
    type === "borrower"
      ? "bg-gradient-to-br from-blue-50 via-background to-purple-50"
      : "bg-gradient-to-br from-green-50 via-background to-blue-50"

  const loadingText = type === "borrower" ? "Loading your dashboard" : "Loading your lending portfolio"

  return (
    <div className={`min-h-screen flex items-center justify-center ${gradientClass}`}>
      <div className="text-center">
        {/* Animated logo */}
        <div className="mb-8 animate-pulse">
          <div className="w-20 h-20 mx-auto flex items-center justify-center">
            <Image
              src="/assets/ubertejas-ventures-logo.jpg"
              alt="UbertejasVC Logo"
              width={80}
              height={80}
              className="object-contain"
            />
          </div>
        </div>

        {/* Loading text with animated dots */}
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          {loadingText}
          <span className="animate-dots"></span>
        </h2>

        {/* Skeleton preview */}
        <div className="mt-12 space-y-4 opacity-30">
          <div className="h-20 w-80 bg-muted rounded animate-pulse"></div>
          <div className="h-20 w-80 bg-muted rounded animate-pulse"></div>
          <div className="h-32 w-80 bg-muted rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}
