"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, AlertCircle, Users, ArrowLeft } from "lucide-react"
import { useUser } from "@/lib/user-context"
import { fetchUsers, createUser, updateUser, softDeleteUser } from "@/lib/api"
import { UserFilters } from "@/components/admin/user-filters"
import { UsersTable } from "@/components/admin/users-table"
import { UserFormModal } from "@/components/admin/user-form-modal"
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog"
import type { SystemUser, UserRole } from "@/lib/types"

export default function UserManagementPage() {
  const router = useRouter()
  const { user, activeRole } = useUser()
  const { toast } = useToast()

  const [users, setUsers] = useState<SystemUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  // Filters
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchInput, setSearchInput] = useState("") // Immediate input value
  const [searchTerm, setSearchTerm] = useState("") // Debounced value for API calls

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const USERS_PER_PAGE = 20

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null)

  // Check if user is admin
  useEffect(() => {
    if (!user || activeRole !== "admin") {
      router.push("/dashboard")
    }
  }, [user, activeRole, router])

  // Debounce search input to prevent API spam
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const loadUsers = useCallback(async () => {
    if (!user?.email) return

    setIsLoading(true)
    setError("")

    const filters: {
      role?: UserRole
      isActive?: boolean
      searchTerm?: string
    } = {}

    if (roleFilter !== "all") {
      filters.role = roleFilter as UserRole
    }

    if (statusFilter !== "all") {
      filters.isActive = statusFilter === "active"
    }

    if (searchTerm.trim()) {
      filters.searchTerm = searchTerm.trim()
    }

    const result = await fetchUsers(user.email, activeRole, filters)

    if (result.error) {
      if (result.data && result.data.length === 0) {
        setError("You do not have permission to manage users")
      } else {
        setError(result.error)
      }
    } else {
      setUsers(result.data || [])
    }

    setIsLoading(false)
  }, [user?.email, activeRole, roleFilter, statusFilter, searchTerm])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [roleFilter, statusFilter, searchTerm])

  // Calculate pagination
  const totalPages = Math.ceil(users.length / USERS_PER_PAGE)
  const startIndex = (currentPage - 1) * USERS_PER_PAGE
  const endIndex = startIndex + USERS_PER_PAGE
  const paginatedUsers = users.slice(startIndex, endIndex)

  const handleCreateUser = async (data: {
    email: string
    full_name: string
    role: UserRole
    is_active: boolean
  }) => {
    if (!user?.email) return

    const result = await createUser(
      {
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        is_active: data.is_active,
      },
      user.email,
      activeRole,
    )

    if (result.error) {
      // Parse specific errors
      if (result.error.includes("users_email_key") || result.error.includes("duplicate")) {
        throw new Error("A user with this email already exists")
      } else if (result.error.includes("valid_email")) {
        throw new Error("Please enter a valid email address")
      } else if (result.error.includes("not-null")) {
        throw new Error("Please fill in all required fields")
      } else if (result.error.includes("enum")) {
        throw new Error("Invalid role selected")
      } else {
        throw new Error("Unable to create user. Please try again.")
      }
    }

    toast({
      title: "User created successfully",
      description: "They will receive a notification with login instructions.",
    })

    loadUsers()
  }

  const handleEditUser = async (data: {
    email: string
    full_name: string
    role: UserRole
    is_active: boolean
  }) => {
    if (!user?.email || !selectedUser) return

    const result = await updateUser(
      selectedUser.id,
      {
        full_name: data.full_name,
        role: data.role,
        is_active: data.is_active,
      },
      user.email,
      activeRole,
    )

    if (result.error) {
      if (result.error.includes("enum")) {
        throw new Error("Invalid role selected")
      } else if (!result.data) {
        throw new Error("User not found or you don't have permission to update")
      } else {
        throw new Error("Unable to update user. Please try again.")
      }
    }

    toast({
      title: "User updated successfully",
    })

    loadUsers()
  }

  const handleDeleteUser = async () => {
    if (!user?.email || !selectedUser) return

    // Prevent self-deletion
    if (selectedUser.email === user.email) {
      toast({
        title: "Cannot delete your own account",
        variant: "destructive",
      })
      setIsDeleteDialogOpen(false)
      return
    }

    // Prevent deleting last active admin
    if (selectedUser.role === "admin") {
      const activeAdmins = users.filter(
        (u) => u.role === "admin" && u.is_active && !u.deleted_at
      )
      if (activeAdmins.length <= 1) {
        toast({
          title: "Cannot delete last admin",
          description: "At least one active admin must remain in the system",
          variant: "destructive",
        })
        setIsDeleteDialogOpen(false)
        return
      }
    }

    const result = await softDeleteUser(selectedUser.id, user.email, activeRole)

    if (result.error) {
      toast({
        title: "Failed to delete user",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "User deleted",
      })
      loadUsers()
    }

    setIsDeleteDialogOpen(false)
    setSelectedUser(null)
  }

  const openEditModal = (user: SystemUser) => {
    setSelectedUser(user)
    setIsEditModalOpen(true)
  }

  const openDeleteDialog = (user: SystemUser) => {
    setSelectedUser(user)
    setIsDeleteDialogOpen(true)
  }

  if (!user || activeRole !== "admin") {
    return null
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/admin")}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-2">Create and manage borrowers, lenders, and administrators</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {isLoading ? "Loading..." : `Showing ${users.length} user${users.length !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <UserFilters
            roleFilter={roleFilter}
            statusFilter={statusFilter}
            searchTerm={searchInput}
            onRoleFilterChange={setRoleFilter}
            onStatusFilterChange={setStatusFilter}
            onSearchChange={setSearchInput}
          />

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : users.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchInput || roleFilter !== "all" || statusFilter !== "all" ? "No users found" : "No Users Yet"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                {searchInput || roleFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters or search criteria."
                  : "Get started by adding your first user to the system."}
              </p>
              {!searchInput && roleFilter === "all" && statusFilter === "all" && (
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              )}
            </div>
          ) : (
            <>
              <UsersTable
                users={paginatedUsers}
                onEdit={openEditModal}
                onDelete={openDeleteDialog}
                currentUserEmail={user.email}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, users.length)} of {users.length} users
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <UserFormModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateUser}
        mode="create"
        existingUsers={users}
      />

      <UserFormModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedUser(null)
        }}
        onSubmit={handleEditUser}
        user={selectedUser}
        mode="edit"
      />

      <DeleteUserDialog
        open={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false)
          setSelectedUser(null)
        }}
        onConfirm={handleDeleteUser}
        user={selectedUser}
      />
    </div>
  )
}
