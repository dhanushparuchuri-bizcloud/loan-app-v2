#!/bin/bash

# Private Lending Marketplace Frontend Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
SKIP_INFRASTRUCTURE=false
SKIP_BUILD=false
CUSTOM_DOMAIN=""
API_URL=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --skip-infrastructure)
      SKIP_INFRASTRUCTURE=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --domain)
      CUSTOM_DOMAIN="$2"
      shift 2
      ;;
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment ENV    Set environment (dev, staging, production)"
      echo "  --skip-infrastructure   Skip infrastructure deployment"
      echo "  --skip-build           Skip build process"
      echo "  --domain DOMAIN        Custom domain name"
      echo "  --api-url URL          API base URL"
      echo "  -h, --help             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🚀 Starting frontend deployment for environment: ${ENVIRONMENT}${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
  echo -e "${RED}❌ Invalid environment: $ENVIRONMENT. Must be dev, staging, or production${NC}"
  exit 1
fi

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI${NC}"
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

# Set API URL if not provided
if [ -z "$API_URL" ]; then
  if [ "$ENVIRONMENT" = "dev" ]; then
    API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"
  else
    echo -e "${YELLOW}⚠️  API URL not provided. Please set --api-url for non-dev environments${NC}"
    exit 1
  fi
fi

echo -e "${BLUE}🔧 Using API URL: ${API_URL}${NC}"

# Deploy infrastructure
if [ "$SKIP_INFRASTRUCTURE" = false ]; then
  echo -e "${YELLOW}🏗️  Deploying frontend infrastructure...${NC}"
  
  STACK_NAME="private-lending-frontend-${ENVIRONMENT}"
  
  PARAMETERS="ParameterKey=Environment,ParameterValue=${ENVIRONMENT}"
  
  if [ -n "$CUSTOM_DOMAIN" ]; then
    PARAMETERS="${PARAMETERS} ParameterKey=DomainName,ParameterValue=${CUSTOM_DOMAIN}"
  fi
  
  aws cloudformation deploy \
    --template-file frontend-infrastructure.yaml \
    --stack-name "$STACK_NAME" \
    --parameter-overrides $PARAMETERS \
    --capabilities CAPABILITY_IAM \
    --region us-east-1
  
  echo -e "${GREEN}✅ Infrastructure deployed successfully${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping infrastructure deployment${NC}"
fi

# Get bucket name from CloudFormation
STACK_NAME="private-lending-frontend-${ENVIRONMENT}"
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
  --output text \
  --region us-east-1 2>/dev/null || echo "")

if [ -z "$BUCKET_NAME" ]; then
  echo -e "${RED}❌ Could not get bucket name from CloudFormation stack${NC}"
  exit 1
fi

echo -e "${BLUE}📦 Using S3 bucket: ${BUCKET_NAME}${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Set environment variables for build
export NEXT_PUBLIC_API_URL="$API_URL"

# Build the application
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${YELLOW}🔨 Building application...${NC}"
  npm run build
  echo -e "${GREEN}✅ Build completed successfully${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping build process${NC}"
fi

# Deploy to S3
echo -e "${YELLOW}☁️  Deploying to S3...${NC}"

# Sync files to S3
aws s3 sync dist/ s3://"$BUCKET_NAME"/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html" \
  --region us-east-1

# Upload HTML files with shorter cache
aws s3 sync dist/ s3://"$BUCKET_NAME"/ \
  --delete \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" \
  --region us-east-1

echo -e "${GREEN}✅ Files uploaded to S3 successfully${NC}"

# Invalidate CloudFront cache
CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text \
  --region us-east-1 2>/dev/null || echo "")

if [ -n "$CLOUDFRONT_ID" ]; then
  echo -e "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" \
    --paths "/*" \
    --region us-east-1 > /dev/null
  echo -e "${GREEN}✅ CloudFront cache invalidated${NC}"
fi

# Get URLs
WEBSITE_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
  --output text \
  --region us-east-1 2>/dev/null || echo "")

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text \
  --region us-east-1 2>/dev/null || echo "")

CUSTOM_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`CustomDomainURL`].OutputValue' \
  --output text \
  --region us-east-1 2>/dev/null || echo "")

echo -e "${GREEN}🎉 Frontend deployment completed successfully!${NC}"

# Show deployment summary
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "Environment: ${ENVIRONMENT}"
echo "S3 Bucket: ${BUCKET_NAME}"
echo "API URL: ${API_URL}"

if [ -n "$WEBSITE_URL" ]; then
  echo "S3 Website URL: ${WEBSITE_URL}"
fi

if [ -n "$CLOUDFRONT_URL" ]; then
  echo "CloudFront URL: ${CLOUDFRONT_URL}"
fi

if [ -n "$CUSTOM_URL" ]; then
  echo "Custom Domain URL: ${CUSTOM_URL}"
fi

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Test the website using the URLs above"
echo "2. Set up monitoring and alerts"
echo "3. Configure custom domain (if not already done)"
echo "4. Set up CI/CD pipeline for automated deployments"

# Save deployment info
cat > deployment-info.json << EOF
{
  "environment": "${ENVIRONMENT}",
  "bucket_name": "${BUCKET_NAME}",
  "api_url": "${API_URL}",
  "website_url": "${WEBSITE_URL}",
  "cloudfront_url": "${CLOUDFRONT_URL}",
  "custom_url": "${CUSTOM_URL}",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo -e "${GREEN}💾 Deployment info saved to deployment-info.json${NC}"