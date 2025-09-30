# Design Document

## Overview

This document outlines the technical design for a serverless private lending marketplace backend built on AWS. The system uses a microservices architecture with Lambda functions, DynamoDB for data persistence, and API Gateway for HTTP routing. The design follows an "accept-only" MVP approach to minimize complexity while delivering core functionality.

The backend integrates with an existing Next.js frontend and provides REST APIs for user authentication, loan management, lender operations, and user data retrieval.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   API Gateway   │    │   Lambda        │
│   Frontend      │───▶│   REST API      │───▶│   Functions     │
│                 │    │   + CORS        │    │   (5 handlers)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │   DynamoDB      │
                                              │   (5 tables)    │
                                              │   + GSIs        │
                                              └─────────────────┘
```

### Technology Stack

- **API Layer**: AWS API Gateway (REST API)
- **Compute**: AWS Lambda (Python 3.11)
- **Database**: Amazon DynamoDB with Global Secondary Indexes
- **Authentication**: JWT tokens
- **Infrastructure**: AWS CloudFormation
- **Security**: IAM roles, DynamoDB encryption at rest

### Service Architecture

```
API Gateway Routes:
├── /auth/*          → auth-handler Lambda
├── /loans/*         → loan-handler Lambda  
├── /lender/*        → lender-handler Lambda
├── /user/*          → user-handler Lambda
└── OPTIONS /*       → CORS preflight
```

## Components and Interfaces

### 1. Authentication Handler (auth-handler)

**Purpose**: Manages user registration, login, and automatic lender activation

**Endpoints**:
- `POST /auth/register` - User registration with invitation checking
- `POST /auth/login` - User authentication with role updates

**Key Functions**:
```python
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class AuthResponse:
    success: bool
    token: Optional[str] = None
    user: Optional[Dict] = None
    error: Optional[str] = None

class AuthHandler:
    def register(self, name: str, email: str, password: str) -> AuthResponse:
        """Handle user registration with invitation checking"""
        pass
    
    def login(self, email: str, password: str) -> AuthResponse:
        """Handle user authentication with role updates"""
        pass
    
    def check_pending_invitations(self, email: str) -> List[Dict]:
        """Check for pending lender invitations"""
        pass
    
    def generate_jwt(self, user: Dict) -> str:
        """Generate JWT token for authenticated user"""
        pass
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        pass
```

**Business Logic**:
1. Registration checks for existing users and pending invitations
2. Auto-activates lender status if invitations exist
3. Login validates credentials and checks for new invitations
4. Returns JWT token with user roles for frontend state management

### 2. Loan Handler (loan-handler)

**Purpose**: Manages loan creation, viewing, and listing operations

**Endpoints**:
- `POST /loans` - Create new loan with lender invitations
- `GET /loans/{id}` - Get loan details with participants
- `GET /loans/my-loans` - List borrower's loans

**Key Functions**:
```python
from typing import Dict, List
from dataclasses import dataclass

@dataclass
class LoanRequest:
    amount: float
    interest_rate: float
    term: str
    purpose: str
    description: str

class LoanHandler:
    def create_loan(self, loan_data: LoanRequest, lenders: List[Dict]) -> Dict:
        """Create new loan with lender invitations"""
        pass
    
    def get_loan_details(self, loan_id: str, user_id: str) -> Dict:
        """Get loan details with participants"""
        pass
    
    def get_user_loans(self, user_id: str) -> List[Dict]:
        """List borrower's loans"""
        pass
    
    def create_invitations(self, lenders: List[Dict], loan_id: str) -> None:
        """Generate invitation records for new emails"""
        pass
    
    def validate_loan_access(self, loan_id: str, user_id: str) -> bool:
        """Validate user can view loan"""
        pass
```

**Business Logic**:
1. Creates loan records with PENDING status
2. Generates invitations for new emails and participant records
3. Validates user access (borrower or invited lender)
4. Returns funding progress and participant status

### 3. Lender Handler (lender-handler)

**Purpose**: Manages lender-specific operations including invitations and loan acceptance

**Endpoints**:
- `GET /lender/pending` - Get pending loan invitations
- `PUT /lender/accept/{loan_id}` - Accept loan invitation with ACH details

**Key Functions**:
```python
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class ACHDetails:
    bank_name: str
    account_type: str  # 'checking' or 'savings'
    routing_number: str
    account_number: str
    special_instructions: Optional[str] = None

class LenderHandler:
    def get_pending_invitations(self, user_id: str) -> List[Dict]:
        """Get pending loan invitations"""
        pass
    
    def accept_loan(self, user_id: str, loan_id: str, ach_details: ACHDetails) -> Dict:
        """Accept loan invitation with ACH details"""
        pass
    
    def update_loan_funding(self, loan_id: str, amount: float) -> None:
        """Update loan funding amount"""
        pass
    
    def check_fully_funded(self, loan_id: str) -> bool:
        """Check if loan is fully funded"""
        pass
```

**Business Logic**:
1. Retrieves pending invitations with loan details
2. Processes loan acceptance as atomic transaction
3. Updates funding status and activates fully funded loans
4. Stores ACH details securely per user per loan

### 4. User Handler (user-handler)

**Purpose**: Provides user profile information and dashboard statistics

**Endpoints**:
- `GET /user/profile` - Get user profile information
- `GET /user/dashboard` - Get dashboard statistics

**Key Functions**:
```python
from typing import Dict, Optional
from dataclasses import dataclass

@dataclass
class DashboardStats:
    borrower: Optional[Dict] = None
    lender: Optional[Dict] = None

class UserHandler:
    def get_user_profile(self, user_id: str) -> Dict:
        """Get user profile information"""
        pass
    
    def get_dashboard_stats(self, user_id: str) -> DashboardStats:
        """Get dashboard statistics"""
        pass
    
    def calculate_borrower_stats(self, user_id: str) -> Dict:
        """Calculate borrower statistics"""
        pass
    
    def calculate_lender_stats(self, user_id: str) -> Dict:
        """Calculate lender statistics"""
        pass
```

**Business Logic**:
1. Returns sanitized user profile (no sensitive data)
2. Calculates real-time statistics from database
3. Provides role-specific dashboard data
4. Supports dual-role users (borrower + lender)

## Data Models

### Database Schema (CloudFormation Managed)

The system uses 5 DynamoDB tables as defined in the provided CloudFormation template:

#### 1. Users Table (`marketplace-users`)
```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    user_id: str          # PK
    email: str           # GSI1-PK (unique)
    name: str            # GSI2-SK (for search)
    password_hash: str
    is_borrower: bool
    is_lender: bool
    user_type: str       # GSI2-PK ("BORROWER_ONLY" | "ACTIVE_LENDER")
    created_at: str
    status: str          # "ACTIVE" | "INACTIVE"
```

#### 2. Loans Table (`marketplace-loans`)
```python
@dataclass
class Loan:
    loan_id: str         # PK
    borrower_id: str     # GSI1-PK
    amount: float
    interest_rate: float
    term: str
    purpose: str
    description: str
    status: str          # GSI2-PK ("PENDING" | "ACTIVE" | "COMPLETED")
    total_funded: float
    created_at: str      # GSI1-SK, GSI2-SK
```

#### 3. Loan Participants Table (`marketplace-loan-participants`)
```python
@dataclass
class LoanParticipant:
    loan_id: str         # PK
    lender_id: str       # SK, GSI1-PK
    contribution_amount: float
    status: str          # GSI1-SK ("PENDING" | "ACCEPTED" | "DECLINED")
    invited_at: str
    responded_at: Optional[str] = None
```

#### 4. Invitations Table (`marketplace-invitations`)
```python
@dataclass
class Invitation:
    invitation_id: str   # PK
    inviter_id: str      # GSI2-PK
    invitee_email: str   # GSI1-PK
    status: str          # GSI1-SK ("PENDING" | "ACTIVATED")
    created_at: str      # GSI2-SK
    activated_at: Optional[str] = None
```

#### 5. ACH Details Table (`marketplace-ach-details`)
```python
@dataclass
class ACHDetailsRecord:
    user_id: str         # PK
    loan_id: str         # SK, GSI1-PK
    bank_name: str
    account_type: str
    routing_number: str
    account_number: str
    special_instructions: Optional[str] = None
    created_at: str
```

### Access Patterns and GSI Usage

1. **Login by email**: `users.email-index` (GSI1)
2. **Search lenders**: `users.lender-search-index` (GSI2)
3. **Get borrower's loans**: `loans.borrower-loans-index` (GSI1)
4. **Filter loans by status**: `loans.status-created-index` (GSI2)
5. **Get lender's invitations**: `loan-participants.lender-status-index` (GSI1)
6. **Check email invitations**: `invitations.invitee-email-index` (GSI1)
7. **Track sent invitations**: `invitations.inviter-created-index` (GSI2)
8. **Get loan ACH details**: `ach-details.loan-ach-index` (GSI1)

## Error Handling

### Error Response Format
```python
from dataclasses import dataclass
from typing import Optional, Any

@dataclass
class ErrorResponse:
    error: str           # Error code (e.g., "INVALID_CREDENTIALS")
    message: str         # Human-readable message
    details: Optional[Any] = None  # Additional error context
```

### Error Categories

1. **Authentication Errors**:
   - `INVALID_CREDENTIALS`: Wrong email/password
   - `USER_EXISTS`: Email already registered
   - `INVALID_TOKEN`: JWT validation failed

2. **Authorization Errors**:
   - `ACCESS_DENIED`: User not authorized for resource
   - `INSUFFICIENT_ROLE`: User lacks required role (borrower/lender)

3. **Validation Errors**:
   - `INVALID_INPUT`: Request data validation failed
   - `INVALID_AMOUNT`: Loan amount out of range
   - `INVALID_EMAIL`: Email format incorrect

4. **Business Logic Errors**:
   - `LOAN_NOT_FOUND`: Loan ID doesn't exist
   - `ALREADY_ACCEPTED`: Lender already accepted loan
   - `LOAN_FULLY_FUNDED`: Cannot accept, loan already funded

5. **System Errors**:
   - `DATABASE_ERROR`: DynamoDB operation failed
   - `INTERNAL_ERROR`: Unexpected system error

### Error Handling Strategy

- **Lambda Level**: Try-catch blocks with structured logging
- **API Gateway Level**: HTTP status code mapping
- **Frontend Level**: User-friendly error messages
- **Monitoring**: CloudWatch logs and metrics

## Testing Strategy

### Unit Testing
- **Lambda Functions**: Jest with mocked DynamoDB calls
- **Business Logic**: Isolated function testing
- **Data Validation**: Input/output validation testing
- **Error Scenarios**: Exception handling verification

### Integration Testing
- **API Endpoints**: Postman/Newman test suites
- **Database Operations**: DynamoDB Local testing
- **Authentication Flow**: JWT generation/validation
- **Cross-Function Workflows**: End-to-end scenarios

### Load Testing
- **Concurrent Users**: Simulate multiple simultaneous requests
- **Database Performance**: GSI query optimization
- **Lambda Cold Starts**: Warm-up strategies
- **API Gateway Limits**: Rate limiting validation

### Security Testing
- **JWT Security**: Token expiration and validation
- **Input Sanitization**: SQL injection prevention
- **Access Control**: Role-based authorization
- **Data Encryption**: DynamoDB encryption verification

## Deployment and Infrastructure

### Complete CloudFormation Architecture

The system requires two CloudFormation stacks:

1. **Database Stack**: Your existing DynamoDB template
2. **Application Stack**: Lambda functions, API Gateway, and IAM roles

### Application Stack Components

#### Lambda Functions (4 handlers)
```yaml
# auth-handler
AuthHandlerFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: marketplace-auth-handler
    Runtime: python3.11
    Handler: index.lambda_handler
    Code: ./src/auth-handler
    MemorySize: 512
    Timeout: 30
    Environment:
      Variables:
        USERS_TABLE: !Ref UsersTable
        INVITATIONS_TABLE: !Ref InvitationsTable
        JWT_SECRET: !Ref JWTSecret

# loan-handler  
LoanHandlerFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: marketplace-loan-handler
    Runtime: python3.11
    Handler: index.lambda_handler
    Code: ./src/loan-handler
    MemorySize: 512
    Timeout: 30
    Environment:
      Variables:
        LOANS_TABLE: !Ref LoansTable
        LOAN_PARTICIPANTS_TABLE: !Ref LoanParticipantsTable
        INVITATIONS_TABLE: !Ref InvitationsTable

# lender-handler
LenderHandlerFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: marketplace-lender-handler
    Runtime: python3.11
    Handler: index.lambda_handler
    Code: ./src/lender-handler
    MemorySize: 512
    Timeout: 30
    Environment:
      Variables:
        LOAN_PARTICIPANTS_TABLE: !Ref LoanParticipantsTable
        LOANS_TABLE: !Ref LoansTable
        ACH_DETAILS_TABLE: !Ref ACHDetailsTable

# user-handler
UserHandlerFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: marketplace-user-handler
    Runtime: python3.11
    Handler: index.lambda_handler
    Code: ./src/user-handler
    MemorySize: 512
    Timeout: 30
    Environment:
      Variables:
        USERS_TABLE: !Ref UsersTable
        LOANS_TABLE: !Ref LoansTable
        LOAN_PARTICIPANTS_TABLE: !Ref LoanParticipantsTable
```

#### API Gateway Configuration
```yaml
# REST API
MarketplaceAPI:
  Type: AWS::ApiGateway::RestApi
  Properties:
    Name: marketplace-api
    Description: Private Lending Marketplace API
    EndpointConfiguration:
      Types:
        - REGIONAL

# Resources and Methods
AuthResource:
  Type: AWS::ApiGateway::Resource
  Properties:
    RestApiId: !Ref MarketplaceAPI
    ParentId: !GetAtt MarketplaceAPI.RootResourceId
    PathPart: auth

RegisterResource:
  Type: AWS::ApiGateway::Resource
  Properties:
    RestApiId: !Ref MarketplaceAPI
    ParentId: !Ref AuthResource
    PathPart: register

LoginResource:
  Type: AWS::ApiGateway::Resource
  Properties:
    RestApiId: !Ref MarketplaceAPI
    ParentId: !Ref AuthResource
    PathPart: login

# POST /auth/register
RegisterMethod:
  Type: AWS::ApiGateway::Method
  Properties:
    RestApiId: !Ref MarketplaceAPI
    ResourceId: !Ref RegisterResource
    HttpMethod: POST
    AuthorizationType: NONE
    Integration:
      Type: AWS_PROXY
      IntegrationHttpMethod: POST
      Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${AuthHandlerFunction.Arn}/invocations'

# Similar configuration for all other endpoints...
```

#### IAM Roles and Policies
```yaml
# Lambda Execution Role
LambdaExecutionRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: lambda.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    Policies:
      - PolicyName: DynamoDBAccess
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - dynamodb:GetItem
                - dynamodb:PutItem
                - dynamodb:UpdateItem
                - dynamodb:DeleteItem
                - dynamodb:Query
                - dynamodb:Scan
              Resource:
                - !GetAtt UsersTable.Arn
                - !GetAtt LoansTable.Arn
                - !GetAtt LoanParticipantsTable.Arn
                - !GetAtt InvitationsTable.Arn
                - !GetAtt ACHDetailsTable.Arn
                - !Sub '${UsersTable.Arn}/index/*'
                - !Sub '${LoansTable.Arn}/index/*'
                - !Sub '${LoanParticipantsTable.Arn}/index/*'
                - !Sub '${InvitationsTable.Arn}/index/*'
                - !Sub '${ACHDetailsTable.Arn}/index/*'
```

### Deployment Strategy

#### 1. Infrastructure Deployment
```bash
# Deploy database stack first
aws cloudformation deploy \
  --template-file database-stack.yaml \
  --stack-name marketplace-database \
  --capabilities CAPABILITY_IAM

# Build Lambda functions
npm run build

# Package Lambda code
sam build

# Deploy application stack
aws cloudformation deploy \
  --template-file application-stack.yaml \
  --stack-name marketplace-application \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    DatabaseStackName=marketplace-database
```

#### 2. Environment Configuration
- **JWT Secret**: Stored in AWS Systems Manager Parameter Store
- **CORS Origins**: Configurable for different environments
- **Table Names**: Imported from database stack outputs
- **API Gateway Domain**: Custom domain for production

#### 3. Security Configuration

**Lambda Security**:
- Least privilege IAM roles
- Environment variable encryption
- VPC configuration (if required)
- Dead letter queues for error handling

**API Gateway Security**:
- CORS configuration for frontend domain
- Request validation
- Rate limiting and throttling
- CloudWatch logging enabled

**DynamoDB Security**:
- Encryption at rest (KMS)
- Point-in-time recovery
- Backup policies
- Access logging

### Monitoring and Observability

#### CloudWatch Integration
```yaml
# Lambda Log Groups
AuthHandlerLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Sub '/aws/lambda/${AuthHandlerFunction}'
    RetentionInDays: 14

# API Gateway Logging
APIGatewayAccount:
  Type: AWS::ApiGateway::Account
  Properties:
    CloudWatchRoleArn: !GetAtt APIGatewayCloudWatchRole.Arn

# Custom Metrics
ErrorMetricFilter:
  Type: AWS::Logs::MetricFilter
  Properties:
    LogGroupName: !Ref AuthHandlerLogGroup
    FilterPattern: 'ERROR'
    MetricTransformations:
      - MetricNamespace: Marketplace
        MetricName: AuthErrors
        MetricValue: '1'
```

#### Alarms and Notifications
- Lambda error rates
- API Gateway 4xx/5xx errors
- DynamoDB throttling
- High latency alerts

### Development Workflow

#### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
pytest

# Local DynamoDB
docker run -p 8000:8000 amazon/dynamodb-local

# SAM local development
sam local start-api --port 3001
```

#### CI/CD Pipeline
1. **Code Commit**: Trigger build pipeline
2. **Unit Tests**: Run pytest test suite
3. **Build**: Package Python Lambda functions with dependencies
4. **Deploy to Staging**: CloudFormation stack update
5. **Integration Tests**: API endpoint testing
6. **Deploy to Production**: Manual approval + deployment

### Cost Optimization

#### Lambda Optimization
- Right-size memory allocation based on performance testing
- Use provisioned concurrency for consistent performance
- Implement connection pooling for DynamoDB

#### DynamoDB Optimization
- Use on-demand billing for variable workloads
- Implement efficient access patterns with GSIs
- Monitor and optimize hot partitions

#### API Gateway Optimization
- Enable caching for read-heavy operations
- Use regional endpoints for better performance
- Implement request/response compression