#!/bin/bash

# Private Lending Marketplace - S3 Static Website Deployment

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
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -e, --environment ENV    Set environment (dev, staging, production)"
      echo "  --skip-infrastructure   Skip S3 bucket creation"
      echo "  --skip-build           Skip build process"
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

echo -e "${GREEN}🚀 Starting S3 static website deployment for environment: ${ENVIRONMENT}${NC}"

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

# Deploy S3 infrastructure
if [ "$SKIP_INFRASTRUCTURE" = false ]; then
  echo -e "${YELLOW}🏗️  Creating S3 bucket for static hosting...${NC}"
  
  STACK_NAME="private-lending-s3-${ENVIRONMENT}"
  
  aws cloudformation deploy \
    --template-file s3-static-hosting.yaml \
    --stack-name "$STACK_NAME" \
    --parameter-overrides Environment="$ENVIRONMENT" \
    --region us-east-1
  
  echo -e "${GREEN}✅ S3 bucket created successfully${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping S3 bucket creation${NC}"
fi

# Get bucket name from CloudFormation
STACK_NAME="private-lending-s3-${ENVIRONMENT}"
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
  echo -e "${YELLOW}🔨 Building Next.js application for static export...${NC}"
  npm run build
  echo -e "${GREEN}✅ Build completed successfully${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping build process${NC}"
fi

# Deploy to S3
echo -e "${YELLOW}☁️  Uploading files to S3...${NC}"

# Sync all files to S3
aws s3 sync dist/ s3://"$BUCKET_NAME"/ \
  --delete \
  --region us-east-1

echo -e "${GREEN}✅ Files uploaded to S3 successfully${NC}"

# Get website URL
WEBSITE_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
  --output text \
  --region us-east-1 2>/dev/null || echo "")

echo -e "${GREEN}🎉 S3 static website deployment completed successfully!${NC}"

# Show deployment summary
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "Environment: ${ENVIRONMENT}"
echo "S3 Bucket: ${BUCKET_NAME}"
echo "API URL: ${API_URL}"
echo "Website URL: ${WEBSITE_URL}"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Open the website: ${WEBSITE_URL}"
echo "2. Test all functionality with the deployed frontend"
echo "3. Set up monitoring if needed"
echo "4. Consider adding CloudFront for better performance (optional)"

# Save deployment info
cat > s3-deployment-info.json << EOF
{
  "environment": "${ENVIRONMENT}",
  "bucket_name": "${BUCKET_NAME}",
  "api_url": "${API_URL}",
  "website_url": "${WEBSITE_URL}",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo -e "${GREEN}💾 Deployment info saved to s3-deployment-info.json${NC}"

# Test the website
echo -e "${YELLOW}🧪 Testing website accessibility...${NC}"
if curl -s -f "${WEBSITE_URL}" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Website is accessible${NC}"
else
  echo -e "${YELLOW}⚠️  Website might still be initializing. Try accessing it in a few minutes.${NC}"
fi