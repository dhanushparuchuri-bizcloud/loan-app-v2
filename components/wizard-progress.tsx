"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  number: number
  label: string
  isCompleted: boolean
  isActive: boolean
  isClickable: boolean
}

interface WizardProgressProps {
  steps: Step[]
  onStepClick?: (stepNumber: number) => void
}

export function WizardProgress({ steps, onStepClick }: WizardProgressProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-center gap-2 sm:gap-4">
        {steps.map((step, index) => (
          <li key={step.number} className="flex items-center">
            <button
              type="button"
              onClick={() => step.isClickable && onStepClick?.(step.number)}
              disabled={!step.isClickable}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                step.isActive && "bg-primary text-primary-foreground font-semibold",
                step.isCompleted && "text-green-600 hover:bg-green-50",
                !step.isActive && !step.isCompleted && "text-muted-foreground",
                step.isClickable && "cursor-pointer",
                !step.isClickable && "cursor-not-allowed",
              )}
              aria-current={step.isActive ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium",
                  step.isActive && "border-primary-foreground bg-primary-foreground text-primary",
                  step.isCompleted && "border-green-600 bg-green-600 text-white",
                  !step.isActive && !step.isCompleted && "border-muted-foreground",
                )}
              >
                {step.isCompleted ? <Check className="w-4 h-4" /> : step.number}
              </span>
              <span className="hidden sm:inline text-sm">{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <div
                className={cn("w-8 sm:w-16 h-0.5 mx-1 sm:mx-2", step.isCompleted ? "bg-green-600" : "bg-muted")}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
