import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { NumericString } from "./types"
import { toNumber } from "./type-utils"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a numeric value as currency
 * Handles both string (from PostgREST) and number types
 */
export function formatCurrency(amount: NumericString, currencyCode = "USD"): string {
  const num = toNumber(amount, 0)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date))
}

/**
 * Formats a decimal value as percentage
 * Handles both string (from PostgREST) and number types
 */
export function formatPercentage(value: NumericString, decimals = 1): string {
  const num = toNumber(value, 0)
  return `${(num * 100).toFixed(decimals)}%`
}

/**
 * Calculates progress percentage
 * Handles both string (from PostgREST) and number types
 */
export function calculateProgress(current: NumericString, total: NumericString): number {
  const currentNum = toNumber(current, 0)
  const totalNum = toNumber(total, 0)

  if (totalNum === 0) return 0
  return Math.min((currentNum / totalNum) * 100, 100)
}

export function formatACHRouting(routing: string): string {
  if (routing.length !== 9) return routing
  return `${routing.slice(0, 3)}-${routing.slice(3, 6)}-${routing.slice(6, 9)}`
}

export function maskACHAccount(account: string): string {
  if (account.length <= 4) return account
  return `****${account.slice(-4)}`
}

export function maskTaxId(taxId: string): string {
  const cleaned = taxId.replace(/\D/g, "")
  if (cleaned.length <= 4) return taxId
  return `XX-XXX-${cleaned.slice(-4)}`
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffInSeconds < 60) return "just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`

  return formatDate(date)
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date))
}
