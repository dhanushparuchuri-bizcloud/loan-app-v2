# UbertejaS Ventures - Loan Management Platform

A Next.js 15 application for managing multi-lender loans with borrower and lender portals.

## Features

- **Borrower Portal**: Create loans, invite lenders, manage repayments
- **Lender Portal**: Review invitations, track investments, approve repayments
- **Admin Portal**: User management and system oversight
- **Google OAuth**: Secure authentication via AWS Cognito
- **Role-based Access**: Dynamic role switching and permissions

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_API_URL` - PostgREST API endpoint
- `NEXT_PUBLIC_COGNITO_DOMAIN` - AWS Cognito hosted UI domain
- `NEXT_PUBLIC_COGNITO_CLIENT_ID` - Cognito app client ID
- `NEXT_PUBLIC_COGNITO_REGION` - AWS region
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID` - Cognito user pool ID

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

This app is deployed on AWS Amplify. Make sure to configure environment variables in the Amplify console before deploying.
