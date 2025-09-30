# Deploy to AWS Amplify

## Step 1: Create Amplify App
```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Configure Amplify
amplify configure

# Initialize Amplify in your project
amplify init
```

## Step 2: Add Hosting
```bash
# Add hosting
amplify add hosting

# Choose options:
# - Select the plugin module to execute: Amazon CloudFront and S3
# - Select the environment setup: PROD (S3 with CloudFront using HTTPS)
# - hosting bucket name: (accept default)
```

## Step 3: Deploy
```bash
# Build and deploy
amplify publish
```

## Alternative: Manual Amplify Setup
1. Go to AWS Amplify Console
2. Click "New app" > "Host web app"
3. Connect your GitHub repository
4. Configure build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```
5. Deploy automatically on git push

## Environment Variables
Add in Amplify Console:
- `NEXT_PUBLIC_API_URL`: https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev