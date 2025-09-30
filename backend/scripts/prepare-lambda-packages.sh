#!/bin/bash

# Script to prepare Lambda packages by copying shared modules

set -e

echo "🔧 Preparing Lambda packages..."

# List of handler directories
HANDLERS=(
  "src/handlers/auth_handler"
  "src/handlers/user_handler"
  "src/handlers/loan_handler"
  "src/handlers/lender_handler"
)

# Copy shared modules to each handler directory
for handler in "${HANDLERS[@]}"; do
  echo "📦 Preparing $handler..."
  
  # Create shared directory in handler if it doesn't exist
  mkdir -p "$handler/shared"
  
  # Copy shared modules
  cp -r src/shared/* "$handler/shared/"
  
  # Remove test files from shared directory in handlers
  rm -f "$handler/shared/test_*.py"
  
  echo "✅ $handler prepared"
done

echo "🎉 All Lambda packages prepared successfully!"