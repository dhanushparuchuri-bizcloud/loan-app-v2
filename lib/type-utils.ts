/**
 * Type conversion utilities for handling PostgREST numeric responses
 *
 * PostgREST returns PostgreSQL NUMERIC types as strings to preserve precision.
 * These utilities safely convert between string and number types.
 */

import type { NumericString } from "./types"

/**
 * Converts a NumericString (string | number) to a number
 * Handles both string and number inputs safely
 *
 * @param value - The value to convert (can be string or number)
 * @param defaultValue - Default value if conversion fails (default: 0)
 * @returns Parsed number
 */
export function toNumber(value: NumericString | null | undefined, defaultValue: number = 0): number {
  if (value === null || value === undefined) {
    return defaultValue
  }

  if (typeof value === "number") {
    return isNaN(value) ? defaultValue : value
  }

  const parsed = Number.parseFloat(value)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Converts a NumericString to a formatted currency string
 *
 * @param value - The numeric value
 * @param currencyCode - Currency code (default: "USD")
 * @returns Formatted currency string (e.g., "$50,000.00")
 */
export function toCurrency(
  value: NumericString | null | undefined,
  currencyCode: string = "USD"
): string {
  const num = toNumber(value, 0)

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Converts a NumericString to a percentage string
 *
 * @param value - The decimal value (e.g., 0.085 for 8.5%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "8.50%")
 */
export function toPercentage(
  value: NumericString | null | undefined,
  decimals: number = 2
): string {
  const num = toNumber(value, 0)
  return `${(num * 100).toFixed(decimals)}%`
}

/**
 * Safely calculates a percentage (numerator / denominator * 100)
 *
 * @param numerator - The numerator value
 * @param denominator - The denominator value
 * @returns Percentage as a number (0-100), or 0 if denominator is 0
 */
export function calculatePercentage(
  numerator: NumericString | null | undefined,
  denominator: NumericString | null | undefined
): number {
  const num = toNumber(numerator, 0)
  const denom = toNumber(denominator, 0)

  if (denom === 0) {
    return 0
  }

  return (num / denom) * 100
}

/**
 * Formats a number with commas (e.g., 50000 -> "50,000")
 *
 * @param value - The numeric value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export function toFormattedNumber(
  value: NumericString | null | undefined,
  decimals: number = 2
): string {
  const num = toNumber(value, 0)

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}
