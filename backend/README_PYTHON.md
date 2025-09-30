# Python Backend Setup

This document describes the Python 3.11 backend implementation for the private lending marketplace.

## Project Structure

```
backend/
├── src/
│   ├── shared/                    # Shared utilities
│   │   ├── dynamodb_client.py     # DynamoDB helper functions
│   │   ├── jwt_auth.py            # JWT authentication utilities
│   │   ├── password_helper.py     # Password hashing with bcrypt
│   │   ├── uuid_helper.py         # UUID generation utilities
│   │   ├── date_helper.py         # Date/time utilities
│   │   ├── response_helper.py     # API response helpers
│   │   ├── validation_schemas.py  # Pydantic validation models
│   │   └── types.py               # Type definitions and data models
│   └── handlers/                  # Lambda function handlers
│       ├── auth_handler/          # Authentication endpoints
│       ├── loan_handler/          # Loan management endpoints
│       ├── lender_handler/        # Lender operations endpoints
│       └── user_handler/          # User profile endpoints
├── requirements.txt               # Python dependencies
├── pytest.ini                    # Pytest configuration
├── pyproject.toml                # Python project configuration
├── .flake8                       # Flake8 linting configuration
├── template.yaml                 # SAM template (updated for Python)
└── test_setup.py                 # Setup verification script
```

## Dependencies

### Core Dependencies
- **boto3**: AWS SDK for Python
- **PyJWT**: JWT token handling
- **bcrypt**: Password hashing
- **pydantic**: Data validation and serialization
- **email-validator**: Email format validation
- **python-dateutil**: Date/time utilities

### Development Dependencies
- **pytest**: Testing framework
- **pytest-asyncio**: Async testing support
- **pytest-mock**: Mocking utilities
- **moto**: AWS service mocking for tests
- **black**: Code formatting
- **flake8**: Code linting
- **mypy**: Type checking

## Setup Instructions

### 1. Create Virtual Environment
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Verify Setup
```bash
python3 test_setup.py
```

## Development Commands

### Testing
```bash
# Run all tests
pytest

# Run tests with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest src/shared/test_validation_schemas.py
```

### Code Quality
```bash
# Format code
black src/

# Lint code
flake8 src/

# Type checking
mypy src/
```

### Deployment
```bash
# Deploy database stack
npm run deploy:database

# Deploy application stack
sam build && sam deploy --guided

# Local development
sam local start-api --port 3001
```

## Environment Variables

The following environment variables are required:

### Runtime Variables
- `JWT_SECRET`: Secret key for JWT token generation
- `USERS_TABLE`: DynamoDB users table name
- `LOANS_TABLE`: DynamoDB loans table name
- `LOAN_PARTICIPANTS_TABLE`: DynamoDB loan participants table name
- `INVITATIONS_TABLE`: DynamoDB invitations table name
- `ACH_DETAILS_TABLE`: DynamoDB ACH details table name

### Optional Variables
- `AWS_REGION`: AWS region (defaults to us-east-1)
- `ENVIRONMENT`: Environment name (dev, staging, production)

## Shared Utilities

### DynamoDBHelper
Provides common DynamoDB operations:
- `get_item()`: Retrieve single item
- `put_item()`: Store item
- `update_item()`: Update existing item
- `delete_item()`: Delete item
- `query_items()`: Query with conditions
- `scan_items()`: Scan table

### JWTAuth
JWT authentication utilities:
- `generate_token()`: Create JWT token
- `verify_token()`: Validate JWT token
- `authenticate_user()`: Extract user from API Gateway event
- `require_role()`: Check user permissions
- `with_auth()`: Authentication decorator

### PasswordHelper
Password security:
- `hash_password()`: Hash password with bcrypt
- `verify_password()`: Verify password against hash

### ValidationHelper
Request validation:
- `validate_request_body()`: Validate against Pydantic model
- `validate_path_param()`: Validate path parameters
- `validate_uuid_param()`: Validate UUID format
- `validate_email_format()`: Validate and normalize email

### ResponseHelper
API response formatting:
- `success_response()`: Create success response
- `error_response()`: Create error response
- `validation_error_response()`: Validation error response
- `unauthorized_response()`: 401 response
- `not_found_response()`: 404 response

## Lambda Handler Structure

Each handler follows this pattern:

```python
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for [handler purpose].
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    try:
        # Extract path and method
        path = event.get('path', '')
        method = event.get('httpMethod', '')
        
        # Route to appropriate function
        if method == 'POST' and path.endswith('/register'):
            return handle_register(event)
        elif method == 'POST' and path.endswith('/login'):
            return handle_login(event)
        else:
            return ResponseHelper.not_found_response("Endpoint not found")
            
    except Exception as e:
        logger.error(f"Handler error: {e}")
        return ResponseHelper.handle_exception(e)
```

## Testing Strategy

### Unit Tests
- Test individual functions and classes
- Mock external dependencies (DynamoDB, etc.)
- Use pytest fixtures for common setup

### Integration Tests
- Test API endpoints end-to-end
- Use moto for AWS service mocking
- Test authentication flows

### Example Test
```python
def test_password_hashing():
    password = 'TestPassword123'
    hashed = PasswordHelper.hash_password(password)
    verified = PasswordHelper.verify_password(password, hashed)
    assert verified is True
```

## Migration from TypeScript

The following TypeScript components have been converted:

### Completed
- ✅ Project structure and configuration
- ✅ Shared utilities (DynamoDB, JWT, validation, etc.)
- ✅ SAM template updated for Python runtime
- ✅ Testing framework setup
- ✅ Development tooling (linting, formatting)

### Pending (Next Tasks)
- ⏳ Auth handler implementation
- ⏳ Loan handler implementation  
- ⏳ Lender handler implementation
- ⏳ User handler implementation
- ⏳ Integration testing
- ⏳ Deployment and monitoring

## Next Steps

1. **Task 2**: Implement authentication handler (register/login)
2. **Task 3**: Implement loan management handler
3. **Task 4**: Implement lender operations handler
4. **Task 5**: Implement user profile handler
5. **Task 6**: Deploy and integrate with frontend
6. **Task 7**: Add business logic validation
7. **Task 8**: Add monitoring and production readiness