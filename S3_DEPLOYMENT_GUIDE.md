# S3 Static Website Deployment Guide

## Quick Deployment Steps

### 1. Make the deployment script executable
```bash
chmod +x deploy-s3.sh
```

### 2. Deploy the S3 infrastructure and website
```bash
./deploy-s3.sh --environment dev
```

### 3. Alternative: Manual deployment steps

If you prefer to deploy manually:

#### Step 1: Deploy S3 Bucket
```bash
aws cloudformation deploy \
  --template-file s3-static-hosting.yaml \
  --stack-name private-lending-s3-dev \
  --parameter-overrides Environment=dev \
  --region us-east-1
```

#### Step 2: Get the bucket name
```bash
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name private-lending-s3-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
  --output text \
  --region us-east-1)

echo "Bucket name: $BUCKET_NAME"
```

#### Step 3: Install dependencies and build
```bash
npm install
export NEXT_PUBLIC_API_URL="https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev"
npm run build
```

#### Step 4: Upload to S3
```bash
aws s3 sync dist/ s3://$BUCKET_NAME/ --delete --region us-east-1
```

#### Step 5: Get the website URL
```bash
aws cloudformation describe-stacks \
  --stack-name private-lending-s3-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
  --output text \
  --region us-east-1
```

## What Gets Created

### S3 Bucket Configuration:
- **Public read access** for website hosting
- **Static website hosting** enabled
- **Index document**: `index.html`
- **Error document**: `index.html` (for SPA routing)
- **CORS configuration** for API calls
- **Versioning enabled** for backup

### Expected Output:
- **Bucket Name**: `private-lending-frontend-dev-{account-id}`
- **Website URL**: `http://private-lending-frontend-dev-{account-id}.s3-website-us-east-1.amazonaws.com`

## Environment Variables

The build process uses these environment variables:
- `NEXT_PUBLIC_API_URL`: Set to your backend API URL

## Testing

After deployment, test these key features:
1. **Login/Register**: User authentication
2. **Borrower Dashboard**: Loan creation and management
3. **Lender Dashboard**: Portfolio and invitations
4. **Loan Details**: View loan information
5. **Loan Review**: Accept/decline invitations

## Troubleshooting

### Common Issues:

1. **403 Forbidden**: Check bucket policy allows public read
2. **404 Not Found**: Verify files uploaded correctly
3. **API Errors**: Check CORS configuration and API URL
4. **Routing Issues**: Ensure error document is set to `index.html`

### Debug Commands:
```bash
# Check bucket contents
aws s3 ls s3://$BUCKET_NAME/ --recursive

# Check bucket website configuration
aws s3api get-bucket-website --bucket $BUCKET_NAME

# Check bucket policy
aws s3api get-bucket-policy --bucket $BUCKET_NAME
```

## Security Notes

- The S3 bucket is configured for **public read access** (required for static hosting)
- No sensitive data should be included in the frontend build
- API keys and secrets should only be in the backend
- The frontend only contains the public API URL

## Cost Estimation

S3 static hosting costs:
- **Storage**: ~$0.023 per GB per month
- **Requests**: ~$0.0004 per 1,000 GET requests
- **Data Transfer**: First 1 GB free, then ~$0.09 per GB

For a typical frontend (~50MB), expect costs under $1/month.

## Next Steps

After successful deployment:
1. **Test thoroughly** with real user workflows
2. **Set up monitoring** (optional)
3. **Configure custom domain** (optional)
4. **Set up CI/CD pipeline** for automated deployments
5. **Add CloudFront** for better performance (optional)