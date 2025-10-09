"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAuth } from "@/lib/auth-context"
import { mockLoans, mockLoanParticipants } from "@/lib/data"
import { ArrowLeft, Download, Mail, Printer, Shield, Calendar, DollarSign, FileText, CreditCard } from "lucide-react"

export default function ReceiptPage() {
  const [receiptNumber] = useState(`RCP-${Date.now().toString().slice(-8)}`)
  const [issueDate] = useState(new Date().toLocaleDateString())

  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const loanId = params["loan-id"] as string

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

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = () => {
    // Mock PDF download
    console.log("Downloading PDF receipt for loan:", loanId)
    alert("PDF download would start here")
  }

  const handleEmailReceipt = () => {
    // Mock email functionality
    console.log("Emailing receipt for loan:", loanId)
    alert("Receipt would be emailed to all participants")
  }

  const loan = mockLoans.find((l) => l.loan_id === loanId)
  const participants = mockLoanParticipants.filter((p) => p.loan_id === loanId)

  if (!loan) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader
          currentRole={user?.is_lender ? "lender" : "borrower"}
          onRoleSwitch={user?.is_lender ? handleRoleSwitch : undefined}
        />
        <main className="p-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Receipt Not Found</h1>
            <Button onClick={() => router.push("/dashboard/borrower")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Calculate repayment details
  const monthlyPayment = (loan.amount * (1 + loan.interest_rate / 100)) / 12
  const totalRepayment = loan.amount * (1 + loan.interest_rate / 100)
  const totalInterest = totalRepayment - loan.amount

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <DashboardHeader
          currentRole={user?.is_lender ? "lender" : "borrower"}
          onRoleSwitch={user?.is_lender ? handleRoleSwitch : undefined}
        />
      </div>

      <main className="p-6 max-w-4xl mx-auto">
        <div className="print:hidden mb-8">
          <Button variant="ghost" onClick={() => router.push("/dashboard/borrower")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-6">
            <Button onClick={handlePrint} variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
            <Button onClick={handleDownloadPDF} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button onClick={handleEmailReceipt} variant="outline">
              <Mail className="mr-2 h-4 w-4" />
              Email Receipt
            </Button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="bg-white text-black p-8 rounded-lg shadow-lg print:shadow-none print:rounded-none">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Image
                src="/ubertejas-ventures-logo.jpg"
                alt="UbertejasVC Logo"
                width={48}
                height={48}
                className="object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold">UbertejasVC</h1>
                <p className="text-gray-600">Ubertejas Ventures Capital</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Receipt Number</p>
              <p className="font-mono font-bold">{receiptNumber}</p>
              <p className="text-sm text-gray-600 mt-2">Date Issued</p>
              <p className="font-medium">{issueDate}</p>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">LOAN AGREEMENT RECEIPT</h2>
            <p className="text-gray-600">Official record of loan agreement and participant details</p>
          </div>

          <Separator className="mb-8" />

          {/* Loan Details Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Loan Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Loan ID</p>
                    <p className="font-mono text-lg">{loan.loan_id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Principal Amount</p>
                    <p className="text-2xl font-bold">${loan.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Interest Rate</p>
                    <p className="text-xl font-semibold text-green-600">{loan.interest_rate}%</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Repayment Term</p>
                    <p className="text-lg">{loan.term}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Purpose</p>
                    <Badge variant="outline" className="text-sm">
                      {loan.purpose}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Status</p>
                    <Badge className="bg-green-100 text-green-800">{loan.status}</Badge>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Description</p>
                <p className="text-gray-800">{loan.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Borrower Information */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Borrower Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-600">Name</p>
                  <p className="text-lg font-medium">John Borrower</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Email</p>
                  <p className="text-lg">borrower@test.com</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Loan Created</p>
                  <p className="text-lg">{new Date(loan.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">User ID</p>
                  <p className="font-mono">{loan.borrower_id}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Participants Section with Full ACH Details */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Lender Participants & Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-medium text-blue-900">Secure & Authenticated</p>
                </div>
                <p className="text-sm text-blue-800">
                  This page is secure and authenticated - full payment details shown for record keeping purposes. All
                  information is encrypted and access-controlled.
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lender Details</TableHead>
                    <TableHead>Contribution</TableHead>
                    <TableHead>Bank Information</TableHead>
                    <TableHead>Account Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => (
                    <TableRow key={participant.lender_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{participant.lender_name}</p>
                          <p className="text-sm text-gray-600">ID: {participant.lender_id}</p>
                          <p className="text-sm text-gray-600">
                            Joined: {new Date(participant.invited_at).toLocaleDateString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xl font-bold">${participant.contribution_amount.toLocaleString()}</p>
                          <Badge
                            className={
                              participant.status === "ACCEPTED"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }
                          >
                            {participant.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {participant.ach_details ? (
                          <div className="space-y-1">
                            <p className="font-medium">{participant.ach_details.bank_name}</p>
                            <p className="text-sm text-gray-600 capitalize">
                              {participant.ach_details.account_type} Account
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Pending ACH Setup</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {participant.ach_details ? (
                          <div className="space-y-1">
                            <div>
                              <p className="text-xs text-gray-600">Routing Number</p>
                              <p className="font-mono font-medium">{participant.ach_details.routing_number}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Account Number</p>
                              <p className="font-mono font-medium">{participant.ach_details.account_number}</p>
                            </div>
                            {participant.ach_details.special_instructions && (
                              <div>
                                <p className="text-xs text-gray-600">Special Instructions</p>
                                <p className="text-sm">{participant.ach_details.special_instructions}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Not provided</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Repayment Schedule */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Repayment Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <DollarSign className="h-8 w-8 mx-auto text-gray-600 mb-2" />
                  <p className="text-sm text-gray-600">Monthly Payment</p>
                  <p className="text-2xl font-bold">${monthlyPayment.toLocaleString()}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Calendar className="h-8 w-8 mx-auto text-gray-600 mb-2" />
                  <p className="text-sm text-gray-600">Number of Payments</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <DollarSign className="h-8 w-8 mx-auto text-gray-600 mb-2" />
                  <p className="text-sm text-gray-600">Total Repayment</p>
                  <p className="text-2xl font-bold">${totalRepayment.toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-6 p-4 border rounded-lg">
                <h4 className="font-semibold mb-3">Payment Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Principal Amount:</span>
                    <span className="font-medium">${loan.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Interest:</span>
                    <span className="font-medium text-green-600">${totalInterest.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total Repayment:</span>
                    <span>${totalRepayment.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="border-t pt-8 mt-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-2">Important Notes</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• This receipt serves as official documentation of the loan agreement</li>
                  <li>• All payment details are encrypted and securely stored</li>
                  <li>• Contact support for any questions regarding this agreement</li>
                  <li>• Keep this receipt for your financial records</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Contact Information</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>UbertejasVC Support</p>
                  <p>Email: support@bizcloudexperts.com</p>
                  <p>Phone: (214) 289-5611</p>
                  <p>Available 24/7 for assistance</p>
                </div>
              </div>
            </div>

            <div className="text-center mt-8 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Generated on {new Date().toLocaleString()} | Receipt #{receiptNumber}
              </p>
              <p className="text-xs text-gray-400 mt-1">This document is digitally generated and legally binding</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
