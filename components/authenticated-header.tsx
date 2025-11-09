"use client"

import Link from "next/link"
import Image from "next/image"
import { RoleSwitcher } from "./role-switcher"
import { NotificationsDropdown } from "./notifications-dropdown"
import { UserMenu } from "./user-menu"

interface AuthenticatedHeaderProps {
  pageTitle: string
}

export function AuthenticatedHeader({ pageTitle }: AuthenticatedHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative w-10 h-10">
              <Image
                src="/ubertejas-logo.jpg"
                alt="UbertejaS Ventures Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="font-bold text-lg text-foreground">UbertejaS Ventures</span>
          </Link>

          <div className="w-px h-6 bg-border" />

          <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <RoleSwitcher />
          <NotificationsDropdown />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
