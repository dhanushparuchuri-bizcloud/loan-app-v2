# Private Lending Marketplace Backend

A serverless backend for a private lending marketplace built with AWS Lambda, DynamoDB, and API Gateway.

## Architecture

- **AWS Lambda**: Serverless compute for API endpoints
- **Amazon DynamoDB**: NoSQL database for data storage
- **API Gateway**: RESTful API management
- **CloudFormation**: Infrastructure as Code
- **TypeScript**: Type-safe development

## Project Structure

```
backend/
├── src/
│   ├── handlers/           # Lambda function handlers
│   │   ├── auth-handler/   # Authentication endpoints
│   │   ├── loan-handler/   # Loan management endpoints
│   │   ├── lender-handler/ # Lender-specific endpoints
│   │   └── user-handler/   # User profile endpoints
│   └── shared/             # Shared utilities and types
│       ├── dynamodb-client.ts
│       ├── jwt-auth.ts
│       ├── validation-schemas.ts
│       ├── response-helper.ts
│       ├── password-helper.ts
│       ├── uuid-helper.ts
│       ├── date-helper.ts
│       └── types.ts
├── cloudformation/         # CloudFormation templates
│   └── database-stack.yaml
├── template.yaml          # SAM template for Lambda functions
├── samconfig.toml         # SAM configuration
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Prerequisites

- Node.js 18+
- AWS CLI configured
- AWS SAM CLI
- TypeScript

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Deployment

### 1. Deploy Database Stack

First, deploy the DynamoDB tables:

```bash
npm run deploy:database
```

### 2. Deploy Application Stack

For development:
```bash
npm run deploy:app
```

For production:
```bash
npm run deploy:app:prod
```

## Development

### Local Development

Start the API locally:
```bash
npm run local
```

The API will be available at `http://localhost:3001`

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test:watch
```

### Linting

Check code style:
```bash
npm run lint
```

Fix linting issues:
```bash
npm run lint:fix
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login

### Loans
- `POST /loans` - Create new loan request
- `GET /loans/{id}` - Get loan details
- `GET /loans/my-loans` - Get user's loans

### Lender Operations
- `GET /lender/pending` - Get pending loan invitations
- `PUT /lender/accept/{loan_id}` - Accept loan invitation

### User Management
- `GET /user/profile` - Get user profile
- `GET /user/dashboard` - Get user dashboard

## Environment Variables

The following environment variables are automatically set by the CloudFormation template:

- `NODE_ENV` - Environment (dev/staging/production)
- `JWT_SECRET` - Secret for JWT token generation
- `USERS_TABLE` - DynamoDB Users table name
- `LOANS_TABLE` - DynamoDB Loans table name
- `LOAN_PARTICIPANTS_TABLE` - DynamoDB Loan Participants table name
- `INVITATIONS_TABLE` - DynamoDB Invitations table name
- `ACH_DETAILS_TABLE` - DynamoDB ACH Details table name

## Database Schema

### Users Table
- Primary Key: `user_id`
- GSI: `email`

### Loans Table
- Primary Key: `loan_id`
- GSI: `borrower_id`, `status`

### Loan Participants Table
- Primary Key: `loan_id`, `lender_id`
- GSI: `lender_id`, `status`

### Invitations Table
- Primary Key: `invitation_id`
- GSI: `invitee_email`, `status`

### ACH Details Table
- Primary Key: `user_id`, `loan_id`

## Security

- JWT-based authentication
- Password hashing with bcrypt
- Input validation with Zod schemas
- CORS enabled for cross-origin requests
- Environment-based configuration

## Monitoring

- CloudWatch logs for all Lambda functions
- DynamoDB streams enabled for audit trails
- Point-in-time recovery enabled for all tables

## Contributing

1. Follow TypeScript best practices
2. Add tests for new functionality
3. Update documentation as needed
4. Use conventional commit messages

## License

MIT