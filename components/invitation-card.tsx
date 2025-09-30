"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, Copy, Check } from "lucide-react"
import { useState } from "react"

interface InvitationCardProps {
  recipientName: string
  recipientEmail: string
  invitationLink: string
  status: "pending" | "sent" | "activated"
  sentDate?: string
}

export function InvitationCard({
  recipientName,
  recipientEmail,
  invitationLink,
  status,
  sentDate,
}: InvitationCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy link:", err)
    }
  }

  const getStatusBadge = () => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        )
      case "sent":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Sent
          </Badge>
        )
      case "activated":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Activated
          </Badge>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{recipientName}</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Email</p>
          <p className="font-medium">{recipientEmail}</p>
        </div>

        {sentDate && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Sent</p>
            <p className="text-sm">{sentDate}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Invitation Link</p>
          <div className="flex gap-2">
            <div className="flex-1 p-2 bg-muted rounded text-sm font-mono truncate">{invitationLink}</div>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {status === "pending" && (
          <Button className="w-full bg-transparent" variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Send Invitation
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
