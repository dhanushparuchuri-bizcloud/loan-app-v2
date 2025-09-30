"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardHeader } from "@/components/dashboard-header"
import { InvitationCard } from "@/components/invitation-card"
import { useAuth } from "@/lib/auth-context"
import { Plus, Users, Send, UserCheck } from "lucide-react"

interface Invitation {
  id: string
  recipientName: string
  recipientEmail: string
  invitationLink: string
  status: "pending" | "sent" | "activated"
  sentDate?: string
}

export default function InvitationsPage() {
  const [newInviteName, setNewInviteName] = useState("")
  const [newInviteEmail, setNewInviteEmail] = useState("")
  const [invitations, setInvitations] = useState<Invitation[]>([])
  
  // Initialize invitations after component mounts to avoid SSR issues
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    const initialInvitations: Invitation[] = [
      {
        id: "1",
        recipientName: "Alice Johnson",
        recipientEmail: "alice@example.com",
        invitationLink: `${origin}/invite/lender/abc123`,
        status: "activated",
        sentDate: "2024-01-15",
      },
      {
        id: "2",
        recipientName: "Bob Wilson",
        recipientEmail: "bob@example.com",
        invitationLink: `${origin}/invite/lender/def456`,
        status: "sent",
        sentDate: "2024-01-20",
      },
      {
        id: "3",
        recipientName: "Carol Davis",
        recipientEmail: "carol@example.com",
        invitationLink: `${origin}/invite/lender/ghi789`,
        status: "pending",
      },
    ]
    setInvitations(initialInvitations)
  }, [])

  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  const handleRoleSwitch = () => {
    if (user?.is_lender) {
      router.push("/dashboard/lender")
    } else {
      router.push("/dashboard/borrower")
    }
  }

  const handleCreateInvitation = (e: React.FormEvent) => {
    e.preventDefault()

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    const newInvitation: Invitation = {
      id: Date.now().toString(),
      recipientName: newInviteName,
      recipientEmail: newInviteEmail,
      invitationLink: `${origin}/invite/lender/${Math.random().toString(36).substr(2, 9)}`,
      status: "pending",
    }

    setInvitations([...invitations, newInvitation])
    setNewInviteName("")
    setNewInviteEmail("")
  }

  if (!user) return null

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending")
  const sentInvitations = invitations.filter((inv) => inv.status === "sent")
  const activatedInvitations = invitations.filter((inv) => inv.status === "activated")

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        currentRole={user.is_lender ? "lender" : "borrower"}
        onRoleSwitch={user.is_lender ? handleRoleSwitch : undefined}
      />

      <main className="p-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-balance">Manage Invitations</h1>
          <p className="text-muted-foreground">Invite new lenders to join your lending network</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Create New Invitation */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create Invitation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateInvitation} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-name">Full Name</Label>
                    <Input
                      id="invite-name"
                      value={newInviteName}
                      onChange={(e) => setNewInviteName(e.target.value)}
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email Address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={newInviteEmail}
                      onChange={(e) => setNewInviteEmail(e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Users className="mr-2 h-4 w-4" />
                    Create Invitation
                  </Button>
                </form>

                {/* Stats */}
                <div className="mt-6 pt-6 border-t space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Invitations</span>
                    <span className="font-medium">{invitations.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Activated</span>
                    <span className="font-medium text-green-600">{activatedInvitations.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <span className="font-medium text-yellow-600">{pendingInvitations.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invitations List */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All ({invitations.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingInvitations.length})</TabsTrigger>
                <TabsTrigger value="sent">Sent ({sentInvitations.length})</TabsTrigger>
                <TabsTrigger value="activated">Active ({activatedInvitations.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {invitations.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No invitations yet</h3>
                      <p className="text-muted-foreground">
                        Create your first invitation to start building your network
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  invitations.map((invitation) => <InvitationCard key={invitation.id} {...invitation} />)
                )}
              </TabsContent>

              <TabsContent value="pending" className="space-y-4">
                {pendingInvitations.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No pending invitations</h3>
                      <p className="text-muted-foreground">All invitations have been sent</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingInvitations.map((invitation) => <InvitationCard key={invitation.id} {...invitation} />)
                )}
              </TabsContent>

              <TabsContent value="sent" className="space-y-4">
                {sentInvitations.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No sent invitations</h3>
                      <p className="text-muted-foreground">Invitations you've sent will appear here</p>
                    </CardContent>
                  </Card>
                ) : (
                  sentInvitations.map((invitation) => <InvitationCard key={invitation.id} {...invitation} />)
                )}
              </TabsContent>

              <TabsContent value="activated" className="space-y-4">
                {activatedInvitations.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No activated invitations</h3>
                      <p className="text-muted-foreground">Activated lenders will appear here</p>
                    </CardContent>
                  </Card>
                ) : (
                  activatedInvitations.map((invitation) => <InvitationCard key={invitation.id} {...invitation} />)
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}
