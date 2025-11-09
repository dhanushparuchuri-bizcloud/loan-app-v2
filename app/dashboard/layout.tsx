import type React from "react"
import { AuthenticatedHeader } from "@/components/authenticated-header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <AuthenticatedHeader pageTitle="Dashboard" />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-8 py-8 bg-secondary/30 min-h-[calc(100vh-4rem)]">{children}</div>
      </main>
    </div>
  )
}
