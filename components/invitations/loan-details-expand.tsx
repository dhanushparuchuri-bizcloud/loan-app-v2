"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Building2, FileText, Calendar, DollarSign } from "lucide-react"
import { formatCurrency, formatDate, maskTaxId } from "@/lib/utils"
import type { LoanDetail } from "@/lib/types"

interface LoanDetailsExpandProps {
  loan: LoanDetail
}

export function LoanDetailsExpand({ loan }: LoanDetailsExpandProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Loan Details</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="gap-2">
            {isExpanded ? (
              <>
                Collapse <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Expand <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Principal</p>
                  <p className="text-base font-semibold">
                    {formatCurrency(Number.parseFloat(loan.principal_amount), loan.currency_code)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Loan Type</p>
                  <p className="text-base font-semibold capitalize">{loan.loan_type}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Purpose */}
          {loan.purpose && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Purpose</h4>
              <p className="text-sm leading-relaxed">{loan.purpose}</p>
            </div>
          )}

          {/* Collateral */}
          {loan.collateral_description && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Collateral</h4>
              <p className="text-sm leading-relaxed">{loan.collateral_description}</p>
            </div>
          )}

          {/* Dates */}
          {(loan.origination_date || loan.maturity_date) && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Timeline</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loan.origination_date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Origination Date</p>
                      <p className="text-base font-semibold">{formatDate(loan.origination_date)}</p>
                    </div>
                  </div>
                )}
                {loan.maturity_date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Maturity Date</p>
                      <p className="text-base font-semibold">{formatDate(loan.maturity_date)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Business Details */}
          {loan.loan_type === "business" && loan.business_entity_name && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Business Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Entity Name</p>
                  <p className="text-base font-semibold">{loan.business_entity_name}</p>
                </div>
                {loan.business_entity_type && (
                  <div>
                    <p className="text-sm text-muted-foreground">Entity Type</p>
                    <p className="text-base font-semibold">{loan.business_entity_type}</p>
                  </div>
                )}
                {loan.business_tax_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tax ID</p>
                    <p className="text-base font-semibold font-mono">{maskTaxId(loan.business_tax_id)}</p>
                  </div>
                )}
                {loan.business_address && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Business Address</p>
                    <p className="text-base">{loan.business_address}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
