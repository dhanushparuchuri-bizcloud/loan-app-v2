# Deploy to AWS App Runner

## Step 1: Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install

# Copy source code
COPY . .

# Set environment variables
ENV NEXT_PUBLIC_API_URL=https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev
ENV NODE_ENV=production

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
```

## Step 2: Create apprunner.yaml
```yaml
version: 1.0
runtime: docker
build:
  commands:
    build:
      - echo "Build completed"
run:
  runtime-version: latest
  command: pnpm start
  network:
    port: 3000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
    - name: NEXT_PUBLIC_API_URL
      value: https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev
```

## Step 3: Deploy via AWS Console
1. Go to AWS App Runner Console
2. Create service from source code
3. Connect to your GitHub repository
4. Configure build settings
5. Deploy automatically