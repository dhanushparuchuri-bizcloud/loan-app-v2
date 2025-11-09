"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import type { SystemUser, UserRole } from "@/lib/types"

interface UserFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    email: string
    full_name: string
    role: UserRole
    is_active: boolean
  }) => Promise<void>
  user?: SystemUser | null
  mode: "create" | "edit"
  existingUsers?: SystemUser[]
}

export function UserFormModal({ open, onClose, onSubmit, user, mode, existingUsers = [] }: UserFormModalProps) {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<UserRole>("borrower")
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRoleChangeWarning, setShowRoleChangeWarning] = useState(false)

  useEffect(() => {
    if (user && mode === "edit") {
      setEmail(user.email)
      setFullName(user.full_name)
      setRole(user.role)
      setIsActive(user.is_active)
    } else {
      setEmail("")
      setFullName("")
      setRole("borrower")
      setIsActive(true)
    }
    setError("")
    setShowRoleChangeWarning(false)
  }, [user, mode, open])

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Check if admin role is being removed
    if (mode === "edit" && user && user.role === "admin" && role !== "admin") {
      if (!showRoleChangeWarning) {
        setShowRoleChangeWarning(true)
        return
      }
    }

    // Client-side validation
    if (!email.trim()) {
      setError("Email is required")
      return
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return
    }

    // Check for duplicate email (only in create mode)
    if (mode === "create") {
      const emailExists = existingUsers.some(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase()
      )
      if (emailExists) {
        setError("A user with this email already exists")
        return
      }
    }

    if (!fullName.trim()) {
      setError("Full name is required")
      return
    }

    if (fullName.trim().length < 2) {
      setError("Name must be at least 2 characters")
      return
    }

    // Prevent spaces-only or numbers-only names
    const trimmedName = fullName.trim()
    if (!/[a-zA-Z]/.test(trimmedName)) {
      setError("Name must contain at least one letter")
      return
    }

    // Prevent names with only numbers
    if (/^\d+$/.test(trimmedName)) {
      setError("Name cannot be only numbers")
      return
    }

    if (!role) {
      setError("Please select a role")
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        email: email.trim(),
        full_name: fullName.trim(),
        role,
        is_active: isActive,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New User" : "Edit User"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {showRoleChangeWarning && (
              <Alert className="border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> You are removing admin privileges from this user. They will lose access to admin features. Click "Update User" again to confirm.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={mode === "edit"}
                required
                className={mode === "edit" ? "bg-muted" : ""}
              />
              {mode === "edit" && (
                <p className="text-xs text-muted-foreground">Email cannot be changed after creation</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrower">Borrower</SelectItem>
                  <SelectItem value="lender">Lender</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="isActive" checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
              <Label htmlFor="isActive" className="cursor-pointer font-normal">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "create" ? "Creating..." : "Updating..."}
                </>
              ) : mode === "create" ? (
                "Create User"
              ) : (
                "Update User"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
