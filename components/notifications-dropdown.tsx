"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Bell, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@/lib/user-context"
import { fetchNotifications, markNotificationRead } from "@/lib/api"
import type { Notification } from "@/lib/types"
import { useRouter } from "next/navigation"

const notificationIcons = {
  loan_invitation: Bell,
  invitation_accepted: Check,
  repayment_submitted: AlertCircle,
  repayment_approved: Check,
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "Just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  return `${Math.floor(diffInSeconds / 86400)} days ago`
}

export function NotificationsDropdown() {
  const { user, activeRole } = useUser()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.email) {
      loadNotifications()
      // Poll every 30 seconds
      const interval = setInterval(loadNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [user?.email, activeRole])

  const loadNotifications = async () => {
    if (!user?.email) return

    setIsLoading(true)
    setError(null)

    const result = await fetchNotifications(user.email, activeRole)

    if (result.error) {
      setError(result.error)
    } else {
      setNotifications(result.data || [])
    }

    setIsLoading(false)
  }

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!user?.email) return

    const result = await markNotificationRead(notificationId, user.email, activeRole)

    if (!result.error) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      // Announce to screen readers
      const announcement = document.createElement("div")
      announcement.setAttribute("role", "status")
      announcement.setAttribute("aria-live", "polite")
      announcement.className = "sr-only"
      announcement.textContent = "Notification marked as read"
      document.body.appendChild(announcement)
      setTimeout(() => document.body.removeChild(announcement), 1000)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // Navigate based on notification type
    // TODO: Implement navigation logic
    setIsOpen(false)
  }

  const unreadCount = notifications.length
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-secondary"
          aria-label={mounted ? `Notifications, ${unreadCount} unread` : "Notifications"}
          suppressHydrationWarning
        >
          <Bell className="h-5 w-5" />
          {mounted && unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-3 py-2">
          <h3 className="font-semibold text-sm">Notifications</h3>
        </div>
        <DropdownMenuSeparator />

        {error && (
          <div className="px-3 py-4 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm text-muted-foreground">Failed to load</p>
          </div>
        )}

        {!error && notifications.length === 0 && (
          <div className="px-3 py-8 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No new notifications</p>
          </div>
        )}

        {!error &&
          notifications.map((notification) => {
            const Icon = notificationIcons[notification.notification_type]
            const truncatedBody =
              notification.body.length > 60 ? notification.body.substring(0, 60) + "..." : notification.body

            return (
              <DropdownMenuItem
                key={notification.id}
                className="px-3 py-3 cursor-pointer flex-col items-start gap-1"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-2 w-full">
                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{notification.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{truncatedBody}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(notification.created_at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => handleMarkAsRead(notification.id, e)}
                    aria-label="Mark as read"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            )
          })}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-primary cursor-pointer"
              onClick={() => {
                router.push("/notifications")
                setIsOpen(false)
              }}
            >
              View All
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
