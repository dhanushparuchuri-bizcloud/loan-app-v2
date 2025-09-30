import { useState, useEffect } from 'react'
import { apiClient, type BorrowerStats, type LenderStats, type LoanSummary } from '@/lib/api-client'

export function useDashboard() {
  const [borrowerStats, setBorrowerStats] = useState<BorrowerStats | null>(null)
  const [lenderStats, setLenderStats] = useState<LenderStats | null>(null)
  const [loans, setLoans] = useState<LoanSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('[useDashboard] Fetching dashboard data...')

      const [statsResponse, loansResponse] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getMyLoans()
      ])

      console.log('[useDashboard] Stats response:', statsResponse)
      console.log('[useDashboard] Loans response:', loansResponse)

      if (statsResponse.success && statsResponse.data) {
        setBorrowerStats(statsResponse.data.borrower || null)
        setLenderStats(statsResponse.data.lender || null)
      }

      if (loansResponse.success && loansResponse.data) {
        setLoans(loansResponse.data.loans)
      }
    } catch (err) {
      console.error('[useDashboard] Dashboard data fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  return {
    borrowerStats,
    lenderStats,
    loans,
    isLoading,
    error,
    refetch: fetchDashboardData
  }
}

export function useLenderDashboard() {
  const [lenderStats, setLenderStats] = useState<LenderStats | null>(null)
  const [invitations, setInvitations] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLenderData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('[useLenderDashboard] Fetching lender data...')

      const [statsResponse, invitationsResponse, portfolioResponse] = await Promise.all([
        apiClient.getLenderDashboard(),
        apiClient.getPendingInvitations(),
        apiClient.getLenderPortfolio()
      ])

      console.log('[useLenderDashboard] Stats response:', statsResponse)
      console.log('[useLenderDashboard] Invitations response:', invitationsResponse)
      console.log('[useLenderDashboard] Portfolio response:', portfolioResponse)

      if (statsResponse.success && statsResponse.data) {
        setLenderStats(statsResponse.data.lender || null)
      }

      if (invitationsResponse.success && invitationsResponse.data) {
        setInvitations(invitationsResponse.data.invitations)
      }

      if (portfolioResponse.success && portfolioResponse.data) {
        setPortfolio(portfolioResponse.data.portfolio)
        setPortfolioSummary(portfolioResponse.data.summary)
      }
    } catch (err) {
      console.error('[useLenderDashboard] Lender dashboard data fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load lender data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLenderData()
  }, [])

  return {
    lenderStats,
    invitations,
    portfolio,
    portfolioSummary,
    isLoading,
    error,
    refetch: fetchLenderData
  }
}