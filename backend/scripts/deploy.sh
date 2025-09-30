#!/bin/bash

# Private Lending Marketplace Backend Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
SKIP_DATABASE=false
SKIP_APP=false
SKIP_TESTS=false
JWT_SECRET=""
CORS_ORIGIN="http://localhost:3000"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --skip-database)
      SKIP_DATABASE=true
      shift
      ;;
    --skip-app)
      SKIP_APP=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --jwt-secret)
      JWT_SECRET="$2"
      shift 2
      ;;
    --cors-origin)
      CORS_ORIGIN="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment ENV    Set environment (dev, staging, production)"
      echo "  --skip-database         Skip database stack deployment"
      echo "  --skip-app             Skip application stack deployment"
      echo "  --skip-tests           Skip running tests"
      echo "  --jwt-secret SECRET    JWT secret for token generation"
      echo "  --cors-origin URL      CORS origin URL"
      echo "  -h, --help             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🚀 Starting deployment for environment: ${ENVIRONMENT}${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
  echo -e "${RED}❌ Invalid environment: $ENVIRONMENT. Must be dev, staging, or production${NC}"
  exit 1
fi

# Generate JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  echo -e "${BLUE}🔐 Generated JWT secret${NC}"
fi

# Set CORS origin based on environment
if [ "$ENVIRONMENT" = "production" ] && [ "$CORS_ORIGIN" = "http://localhost:3000" ]; then
  echo -e "${YELLOW}⚠️  Warning: Using localhost CORS origin for production. Consider setting --cors-origin${NC}"
fi

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI${NC}"
  exit 1
fi

if ! command -v sam &> /dev/null; then
  echo -e "${RED}❌ SAM CLI not found. Please install SAM CLI${NC}"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm not found. Please install Node.js and npm${NC}"
  exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
  echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure'${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Run tests
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${YELLOW}🧪 Running tests...${NC}"
  if ! npm test; then
    echo -e "${RED}❌ Tests failed. Deployment aborted.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ All tests passed${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping tests${NC}"
fi

# Install Python dependencies
echo -e "${YELLOW}🐍 Installing Python dependencies...${NC}"
pip install -r requirements.txt

# Prepare Lambda packages
echo -e "${YELLOW}📦 Preparing Lambda packages...${NC}"
./scripts/prepare-lambda-packages.sh

# Deploy database stack
if [ "$SKIP_DATABASE" = false ]; then
  echo -e "${YELLOW}🗄️  Deploying database stack...${NC}"
  
  DATABASE_STACK_NAME="marketplace-database"
  if [ "$ENVIRONMENT" != "dev" ]; then
    DATABASE_STACK_NAME="marketplace-database-${ENVIRONMENT}"
  fi
  
  aws cloudformation deploy \
    --template-file cloudformation/database-stack.yaml \
    --stack-name "$DATABASE_STACK_NAME" \
    --parameter-overrides Environment="$ENVIRONMENT" \
    --capabilities CAPABILITY_IAM \
    --region us-east-1
  
  echo -e "${GREEN}✅ Database stack deployed successfully${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping database stack deployment${NC}"
fi

# Deploy application stack
if [ "$SKIP_APP" = false ]; then
  echo -e "${YELLOW}🚀 Deploying application stack...${NC}"
  
  # Build SAM application
  echo -e "${BLUE}🔨 Building SAM application...${NC}"
  sam build
  
  # Set database stack name
  DATABASE_STACK_NAME="marketplace-database"
  if [ "$ENVIRONMENT" != "dev" ]; then
    DATABASE_STACK_NAME="marketplace-database-${ENVIRONMENT}"
  fi
  
  # Deploy based on environment
  if [ "$ENVIRONMENT" = "production" ]; then
    sam deploy \
      --config-env production \
      --no-confirm-changeset \
      --parameter-overrides \
        "JWTSecret=${JWT_SECRET}" \
        "CorsOrigin=${CORS_ORIGIN}" \
        "DatabaseStackName=${DATABASE_STACK_NAME}"
  else
    sam deploy \
      --no-confirm-changeset \
      --parameter-overrides \
        "JWTSecret=${JWT_SECRET}" \
        "CorsOrigin=${CORS_ORIGIN}" \
        "DatabaseStackName=${DATABASE_STACK_NAME}"
  fi
  
  echo -e "${GREEN}✅ Application stack deployed successfully${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping application stack deployment${NC}"
fi

# Get API endpoint
if [ "$SKIP_APP" = false ]; then
  STACK_NAME="marketplace-backend-${ENVIRONMENT}"
  if [ "$ENVIRONMENT" = "dev" ]; then
    STACK_NAME="marketplace-backend-dev"
  fi
  
  API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`MarketplaceApiUrl`].OutputValue' \
    --output text \
    --region us-east-1 2>/dev/null || echo "")
  
  if [ -n "$API_URL" ]; then
    echo -e "${GREEN}🌐 API URL: ${API_URL}${NC}"
  fi
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"

# Test API endpoints
if [ "$SKIP_APP" = false ] && [ -n "$API_URL" ]; then
  echo -e "${YELLOW}🧪 Testing API endpoints...${NC}"
  
  # Test health endpoint (if exists) or basic connectivity
  if curl -s -f "${API_URL}auth/login" -X POST -H "Content-Type: application/json" -d '{}' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API is responding${NC}"
  else
    echo -e "${YELLOW}⚠️  API might still be initializing. Check CloudWatch logs if issues persist.${NC}"
  fi
fi

# Show configuration summary
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "Environment: ${ENVIRONMENT}"
echo "Database Stack: ${DATABASE_STACK_NAME:-marketplace-database}"
echo "CORS Origin: ${CORS_ORIGIN}"
if [ -n "$API_URL" ]; then
  echo "API URL: ${API_URL}"
fi

# Show next steps
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Update your frontend environment variables with the API URL"
echo "2. Test all API endpoints with your frontend"
echo "3. Set up monitoring and alerts in CloudWatch"
echo "4. Review CloudWatch logs for any issues"
echo "5. Configure custom domain (production only)"

# Save deployment info
cat > deployment-info.json << EOF
{
  "environment": "${ENVIRONMENT}",
  "api_url": "${API_URL}",
  "cors_origin": "${CORS_ORIGIN}",
  "database_stack": "${DATABASE_STACK_NAME:-marketplace-database}",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo -e "${GREEN}💾 Deployment info saved to deployment-info.json${NC}"