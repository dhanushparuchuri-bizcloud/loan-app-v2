# Frontend Integration Test Guide

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Environment Variables**
   - The `.env.local` file is already configured with the API URL
   - API URL: `https://a2dztkus2g.execute-api.us-east-1.amazonaws.com/dev`

3. **Start Development Server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

4. **Access the Application**
   - Open http://localhost:3000
   - You should be redirected to the login page

## Test Scenarios

### 1. User Registration
- Navigate to `/register`
- Create a new account with:
  - Name: Test User
  - Email: test@example.com
  - Password: Password123! (must meet requirements)
- Should redirect to borrower dashboard on success

### 2. User Login
- Navigate to `/login`
- Login with existing credentials
- Should redirect to borrower dashboard

### 3. Borrower Dashboard
- View dashboard stats (should load from real API)
- Check "My Loans" section
- Click "Create New Loan" button

### 4. Create Loan
- Fill out loan details:
  - Amount: $50,000
  - Interest Rate: 8.5%
  - Term: Monthly
  - Purpose: Business
  - Description: Test loan
- Add lenders with email addresses
- Assign amounts to each lender
- Submit loan request

### 5. Lender Registration
- Register with an email that was invited to a loan
- Should automatically activate lender role
- Should redirect to borrower dashboard (can switch to lender)

### 6. Lender Dashboard
- Switch to lender role
- View pending invitations
- Accept loan invitations with ACH details

## API Integration Points

✅ **Completed Integrations:**
- User authentication (login/register)
- Dashboard stats loading
- Loan creation
- Real-time error handling
- Token management

🔄 **In Progress:**
- Loan details view
- Lender invitation acceptance
- ACH details form

## Error Handling

The frontend now includes:
- API error display with retry buttons
- Form validation
- Loading states
- Toast notifications for success/error messages

## Next Steps

1. Test the complete user flow
2. Add loan details page integration
3. Complete lender invitation flow
4. Add proper error boundaries
5. Implement real-time updates